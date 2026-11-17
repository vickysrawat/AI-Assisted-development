"""
Draws an architecture / technical recovery diagram (a PNG) for any application.

Nothing about a particular application lives in this script. Everything on the picture comes
from a small spec file (YAML or JSON) written for the application:
  - zones       where things run: a data centre, a failover site, a cloud region, the company
                network, the CI/CD tooling, the users
  - components  what runs in each zone: a Kubernetes cluster and its pods, an Azure App Service,
                an IIS server and its sites, databases, secrets, pipelines ... Components can
                contain other components (cluster -> pods, IIS server -> sites).
  - flows       the arrows: runtime traffic, deployment, data replication, recovery / failover

The script sizes the boxes, places them and routes every arrow around the other boxes, so the
same script works whether the application runs in Kubernetes, Docker, on a Node.js or Linux
server, in Azure or AWS, or on IIS.

Usage:
    python architecture-diagram.py <spec.yaml | spec.json> <output.png> [--dpi 150] [--check]

    --check  after drawing, checks the picture: no overlapping boxes, every box inside its
             parent, arrows made of straight horizontal / vertical lines that start and end on
             their boxes and cross no other box. Prints one "check:" line per problem.

Exit codes: 0 drawn (and, with --check, no problems) · 1 spec error (nothing drawn) or --check
found problems (the PNG is still written) · 2 wrong command-line arguments.

Needs matplotlib (pip install matplotlib). YAML specs also need PyYAML (pip install pyyaml);
JSON specs need nothing else. Keep both out of the application's requirements files.
Fonts: Segoe UI (Windows), falling back to DejaVu Sans.
Example specs (Kubernetes, Azure App Service, on-prem IIS, Docker Compose, Node.js server) are
in skills/arch-diagram/references/examples/ in the plugin.

SPEC FORMAT (YAML shown; JSON uses the same keys)

    title: "MyApp — Production Technical Recovery Architecture"
    subtitle: "Optional second line"
    width: 140                    # optional canvas width; 140 units = 14 inches (~2100 px)

    zones:                        # rows top to bottom; zones in the same row sit side by side
      - id: primary               # optional; defaults to the name
        name: "Primary data centre"
        row: 1                    # default: the row after the previous zone
        span: 3                   # share of the row width (default 1)
        style: site               # site | failover | cloud | shared | plain
        columns: 2                # components per line inside the zone (default: automatic)
        note: "Firm firewall"     # optional caption along the bottom edge
        details: ["..."]          # optional lines under the zone name
        components:
          - id: web01
            name: "WEB01"
            type: iis-server      # sets colours and the small type label (see TYPES below)
            details: ["Windows Server 2022", "IIS 10"]
            standby: true         # used only during recovery: dashed red border
            todo: true            # not confirmed from the code or documents yet: amber dashed
                                  # border and a "⚠ unverified" label (also allowed on zones)
            tag: "Custom label"   # replaces the type label; "" hides it
            color: "#5C2D91"      # optional border colour override
            fill: "#FFFFFF"       # optional fill colour override
            columns: 1            # child components per line
            children: [ ... ]     # components inside this one (same keys)

    flows:
      - from: users               # a component id or zone id
        to: web01
        label: "HTTPS 443"
        kind: runtime             # runtime | deploy | data | recovery (default runtime)
        id: "R1"                  # optional badge text; default numbering is 1, 2, 3 ... and
                                  # R1, R2 ... for recovery flows
        todo: true                # not confirmed yet: the arrow is drawn grey

    When any box or arrow has todo: true, the legend gains an "Unverified (⚠ TODO)" entry.

    A component with type "stack" draws nothing itself. Use it to stack components on top of
    each other in one column of a zone (for example a database above its backups).
"""

import argparse
import heapq
import json
import math
import re
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle

plt.rcParams["font.family"] = ["Segoe UI", "DejaVu Sans"]

INK = "#1F2937"
MUTED = "#4B5563"
BLUE = "#2354E8"
RED = "#D92D20"
GREEN = "#1E7B34"
PURPLE = "#6941C6"
K8S = "#326CE5"
AZURE = "#0078D4"
IIS = "#5C2D91"
AMBER = "#C98A00"
GREY = "#6B7280"

# AC-F14 — items marked todo: true (D-1 Option A, ADO-8001): shown on the picture as not yet confirmed.
TODO_EDGE = "#D98E04"  # amber border
TODO_FLOW = "#9E9E9E"  # grey arrow
TODO_TAG = "⚠ unverified"
TODO_LEGEND = "Unverified (⚠ TODO)"

# Component types: (fill, border, header band colour when it contains children, type label, icon)
TYPES = {
    # Kubernetes
    "kubernetes": ("#FFFFFF", K8S, K8S, "Kubernetes cluster", None),
    "aks": ("#FFFFFF", K8S, K8S, "Azure Kubernetes Service", None),
    "namespace": ("#FFFFFF", K8S, None, "Namespace", None),
    "ingress": ("#F3F6FD", K8S, None, "Ingress", None),
    "pod": ("#F3F6FD", K8S, None, "Pod", None),
    "container": ("#F3F6FD", K8S, None, "Container", None),
    "secret": ("#FFF8E6", AMBER, None, "Secret", None),
    "config": ("#FFF8E6", AMBER, None, "Configuration", None),
    "volume": ("#FFF8E6", AMBER, None, "Volume", None),
    # Azure
    "app-service": ("#FFFFFF", AZURE, AZURE, "Azure App Service", None),
    "function-app": ("#F2F8FD", AZURE, None, "Azure Functions", None),
    "front-door": ("#F2F8FD", AZURE, None, "Azure Front Door", None),
    "app-gateway": ("#F2F8FD", AZURE, None, "Application Gateway", None),
    "key-vault": ("#FFF8E6", AZURE, None, "Azure Key Vault", None),
    "storage": ("#F2F8FD", AZURE, None, "Storage account", "db"),
    "azure-sql": ("#FFFFFF", AZURE, None, "Azure SQL Database", "db"),
    "app-insights": ("#F2F8FD", AZURE, None, "Application Insights", None),
    "identity": ("#FFFFFF", AZURE, None, "Identity provider", None),
    # On-prem / Windows
    "iis-server": ("#FFFFFF", IIS, IIS, "Windows Server · IIS", None),
    "iis-site": ("#F6F2FB", IIS, None, "IIS website", None),
    "app-pool": ("#F6F2FB", IIS, None, "IIS application pool", None),
    "windows-service": ("#F6F2FB", IIS, None, "Windows service", None),
    "vm": ("#FFFFFF", GREY, GREY, "Virtual machine", None),
    "server": ("#FFFFFF", GREY, GREY, "Server", None),
    "file-share": ("#FFFFFF", GREY, None, "File share", "db"),
    "load-balancer": ("#FFFFFF", INK, None, "Load balancer", None),
    "firewall": ("#FFFFFF", INK, None, "Firewall", None),
    # AC-F3 — containers and servers outside Kubernetes (colours reuse the families above)
    "docker-host": ("#FFFFFF", K8S, K8S, "Docker host", None),
    "compose-service": ("#F3F6FD", K8S, None, "Compose service", None),
    "node-server": ("#FFFFFF", INK, None, "Node.js", None),
    "process-manager": ("#FFFFFF", INK, None, "Process manager", None),
    "reverse-proxy": ("#F3F6FD", K8S, None, "Reverse proxy", None),
    "linux-server": ("#FFFFFF", GREY, GREY, "Linux server", None),
    "app-server": ("#FFFFFF", GREY, GREY, "App server", None),
    "container-apps": ("#FFFFFF", AZURE, AZURE, "Azure Container Apps", None),
    # AWS
    "aws-ecs": ("#FFFFFF", K8S, K8S, "AWS ECS", None),
    "aws-lambda": ("#F2F8FD", AZURE, None, "AWS Lambda", None),
    "aws-rds": ("#FFFFFF", BLUE, None, "Amazon RDS", "db"),
    "s3": ("#F2F8FD", AZURE, None, "Amazon S3", "db"),
    # Data
    "database": ("#FFFFFF", BLUE, None, "Database", "db"),
    "sql-server": ("#FFFFFF", BLUE, None, "SQL Server", "db"),
    "backup": ("#FFFFFF", BLUE, None, "Backup", None),
    "queue": ("#FFFFFF", INK, None, "Message queue", None),
    # Delivery and operations
    "pipeline": ("#FFFFFF", BLUE, None, "CI/CD pipeline", None),
    "registry": ("#FFFFFF", BLUE, None, "Container registry", None),
    "artifact": ("#FFFFFF", BLUE, None, "Artifact feed", None),
    "monitoring": ("#FFFFFF", INK, None, "Monitoring / logging", None),
    "dns": ("#FFFFFF", INK, None, "DNS", None),
    # Generic
    "users": ("#FFFFFF", "#1F4FB0", None, "Users", "user"),
    "service": ("#FFFFFF", INK, None, None, None),
    "external": ("#FFFFFF", "#9AA4B2", None, "External system", None),
    "stack": (None, None, None, None, None),
}

# Zone styles: (fill, border, dashed border)
ZONE_STYLES = {
    "site": ("#EAF4FA", "#5B8DB8", False),
    "failover": ("#FBF1F0", "#D98880", True),
    "cloud": ("#F4F6F8", "#9AA4B2", False),
    "shared": ("#F4F6F8", "#9AA4B2", False),
    "plain": ("#FFFFFF", "#FFFFFF", False),
}

# Flow kinds: (line colour, dashed, badge colour, legend text)
KINDS = {
    "runtime": (INK, False, GREEN, "Runtime traffic"),
    "deploy": (BLUE, False, BLUE, "Deployment (CI/CD)"),
    "data": (PURPLE, False, PURPLE, "Data replication / sync"),
    "recovery": (RED, True, RED, "Recovery / failover path"),
}

# Layout units: 1 unit = 0.1 inch = 7.2 pt, so the canvas is (width / 10) inches wide.
PT_PER_UNIT = 7.2
MARGIN = 3.0
PAD = 1.2  # space inside a box
GAP = 3.0  # space between boxes in a zone; arrows run through these gaps
ZGAP = 4.0  # space between zones
MIN_LEAF_W = 20.0  # narrowest box used when choosing columns automatically
MIN_H = 5.0
ICON_W = 4.5

BIG_SIZE, SUB_SIZE, ZONE_SIZE, TITLE_SIZE = 15, 9, 10.5, 9.3
DETAIL_SIZE, TAG_SIZE, NOTE_SIZE, TABLE_SIZE, LEGEND_SIZE = 7.6, 6.6, 7.4, 7.8, 8.2

# Arrow routing: a grid search that prefers straight lines and avoids shared tracks.
RES = 0.5  # grid spacing
CLEAR = 0.6  # arrows keep this distance from boxes they do not start or end at
TURN = 6.0  # cost of a bend
OVERLAP = 4.0  # cost of running along a track another arrow already uses
CROSS = 0.5  # cost of crossing another arrow
NEAR = 1.5  # cost of running right next to another arrow in the same direction
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
OPPOSITE = [1, 0, 3, 2]


class SpecError(Exception):
    """A mistake in the spec file, reported without a stack trace."""


def todo_flag(d, what):  # AC-F14
    """Reads the optional todo flag of a zone, component or flow; it must be true or false."""
    value = d.get("todo", False)
    if not isinstance(value, bool):
        raise SpecError(f"todo must be true or false ({what})")
    return value


# ---------------------------------------------------------------- text helpers


def char_width(size, bold=False):
    """Average width of one character at this font size, in layout units."""
    return size * (0.58 if bold else 0.52) / PT_PER_UNIT


def text_width(text, size, bold=False):
    """Approximate width of a piece of text, in layout units."""
    return len(text) * char_width(size, bold)


def wrap(text, width, size, bold=False):
    """Splits text into lines that fit the given width. A name too long for one line breaks
    after a ".", "-" or "/" (Contoso.Orders. / Web), then between camelCase parts, and only
    in the middle of a word when it has none of those. camelCase detection is ASCII-only.
    """
    limit = max(6, int(width / char_width(size, bold)))
    lines, line = [], ""
    for word in str(text).split():
        pieces = (
            [word] if len(word) <= limit else re.findall(r"[^./-]*[./-]+|[^./-]+", word)
        )
        for k, piece in enumerate(pieces):
            gap = " " if k == 0 and line else ""
            if len(line) + len(gap) + len(piece) <= limit:
                line += gap + piece
                continue
            if line:
                lines.append(line)
            while len(piece) > limit:
                # last camelCase boundary that fits (RealEstate|Tracker), else a hard cut
                cuts = [
                    m.start() for m in re.finditer(r"(?<=[a-z0-9])(?=[A-Z])", piece)
                ]
                cut = max([c for c in cuts if 3 <= c <= limit], default=limit)
                lines.append(piece[:cut])
                piece = piece[cut:]
            line = piece
    if line:
        lines.append(line)
    return lines or [""]


def line_height(size):
    """Height of one line of text at this font size, in layout units."""
    return size * 1.45 / PT_PER_UNIT


def lines_height(lines):
    """Total height of a list of styled lines."""
    return sum(line_height(line[1]) for line in lines)


def styled(texts, size, bold, color, italic=False):
    """Attaches one font style to a list of text lines."""
    return [(t, size, bold, color, italic) for t in texts]


# ---------------------------------------------------------------- spec model


class Node:
    """One zone or component from the spec, plus the rectangle it is drawn in."""

    def __init__(self, d, parent=None, zone=False):
        if not isinstance(d, dict):
            raise SpecError(f"expected a mapping for a zone or component, got {d!r}")
        self.zone = zone
        self.parent = parent
        self.type = str(d.get("type", "zone" if zone else "service")).lower()
        self.name = str(d.get("name", ""))
        if not self.name and self.type != "stack" and not zone:
            raise SpecError(f"component without a name: {d!r}")
        self.id = str(d.get("id", self.name))
        self.explicit_id = "id" in d
        self.details = [str(x) for x in d.get("details", []) or []]
        self.note = d.get("note")
        self.columns = d.get("columns")
        self.row = d.get("row")
        self.span = float(d.get("span", 1))
        self.todo = todo_flag(d, f"{'zone' if zone else 'component'} {self.id}")
        kids = d.get("components" if zone else "children", []) or []
        self.children = [Node(c, self) for c in kids]
        self.rect = None

        if zone:
            style = d.get("style", "site")
            if style not in ZONE_STYLES:
                raise SpecError(
                    f"zone '{self.name}': unknown style '{style}' "
                    f"(use one of {', '.join(ZONE_STYLES)})"
                )
            self.face, self.edge, self.dashed = ZONE_STYLES[style]
            self.header = self.tag = self.icon = None
            if self.todo:  # AC-F14: unverified zone, amber dashed border
                self.edge, self.dashed = TODO_EDGE, True
            return
        if self.type not in TYPES:
            print(
                f"warning: '{self.name}' has unknown type '{self.type}', drawn as a plain box. "
                f"Known types: {', '.join(TYPES)}",
                file=sys.stderr,
            )
        face, edge, header, tag, icon = TYPES.get(self.type, TYPES["service"])
        self.face = d.get("fill", face)
        self.edge = d.get("color", edge)
        self.header = header if self.children else None
        self.tag = d.get("tag", tag)
        self.icon = icon
        self.dashed = bool(d.get("standby", False))
        if self.dashed:
            self.edge = RED
        # DECISION: What a box shows when it is both standby and todo
        # Options considered:
        #   A) Keep the red standby border and add the "unverified" label — rejected: red dashed
        #      and amber dashed would mean two things on one border; readers can't tell them apart
        #   B) Unverified wins (amber dashed + "⚠ unverified") — chosen: a box nobody could confirm
        #      is the bigger risk in a recovery plan; its details still say what it is for
        # Zones accept todo too (border only), so a whole site that is only in the documents
        # (for example a failover site with no deployment files) can be shown as unverified.
        # AC-F14: not confirmed yet: amber dashed border, "unverified" label.
        if self.todo:
            self.edge, self.dashed, self.tag = TODO_EDGE, True, TODO_TAG

    def chain(self):
        """This node and every node it sits inside."""
        node = self
        while node is not None:
            yield node
            node = node.parent

    def walk(self):
        """This node and every node inside it."""
        yield self
        for child in self.children:
            yield from child.walk()


class Flow:
    """One arrow from the spec, plus the corner points it is drawn through."""

    def __init__(self, src, dst, label, kind, badge, todo=False):
        self.src, self.dst, self.label, self.kind, self.badge = (
            src,
            dst,
            label,
            kind,
            badge,
        )
        self.todo = todo
        self.points = []
        self.badge_xy = None  # where its number badge is drawn


def load_spec(path):
    """Reads a YAML or JSON spec file."""
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError:
            raise SpecError(
                "YAML specs need PyYAML (pip install pyyaml), or use a .json spec"
            )
        spec = yaml.safe_load(text)
    else:
        spec = json.loads(text)
    if not isinstance(spec, dict) or not spec.get("zones"):
        raise SpecError("the spec needs a 'zones' list")
    return spec


def build(spec):
    """Turns the spec into zone nodes and flows, checking every flow points at a real box."""
    zones, row = [], 0
    for zd in spec["zones"]:
        zone = Node(zd, zone=True)
        row = int(zone.row) if zone.row is not None else row + 1
        zone.row = row
        zones.append(zone)

    index, ambiguous = {}, set()
    for node in (n for z in zones for n in z.walk()):
        if not node.id:
            continue
        if node.id in index:
            if node.explicit_id and index[node.id].explicit_id:
                raise SpecError(f"id '{node.id}' is used twice")
            ambiguous.add(node.id)
        index[node.id] = node

    def find(ref, end):
        ref = str(ref)
        if ref in ambiguous:
            raise SpecError(
                f"flow {end} '{ref}': several boxes share that name, give them ids"
            )
        if ref not in index:
            raise SpecError(f"flow {end} '{ref}': no zone or component has that id")
        return index[ref]

    flows, number, recovery = [], 0, 0
    for fd in spec.get("flows", []) or []:
        kind = fd.get("kind", "runtime")
        if kind not in KINDS:
            raise SpecError(f"flow kind '{kind}' is not one of {', '.join(KINDS)}")
        if "id" in fd:
            badge = str(fd["id"])
        elif kind == "recovery":
            recovery += 1
            badge = f"R{recovery}"
        else:
            number += 1
            badge = str(number)
        flows.append(
            Flow(
                find(fd.get("from"), "from"),
                find(fd.get("to"), "to"),
                str(fd.get("label", "")),
                kind,
                badge,
                todo_flag(fd, f"flow {fd.get('from')} -> {fd.get('to')}"),
            )
        )
    return zones, flows


# ---------------------------------------------------------------- box sizes and positions


def icon_space(node, width):
    """Width kept free on the left of a box for its icon (0 when it has none)."""
    return ICON_W if node.icon and width >= 16 else 0.0


def leaf_lines(node, width):
    """The text lines inside a box that has no children: type label, name, details."""
    tw = width - 2 * PAD - icon_space(node, width)
    lines = (
        styled(wrap(node.tag, tw, TAG_SIZE), TAG_SIZE, False, node.edge, True)
        if node.tag
        else []
    )
    lines += styled(wrap(node.name, tw, TITLE_SIZE, True), TITLE_SIZE, True, INK)
    return lines + detail_lines(node.details, tw)


def detail_lines(details, tw):
    """The grey detail lines of a box; an empty string in the spec becomes a small spacer."""
    lines = []
    for d in details:
        if d:
            lines += styled(wrap(d, tw, DETAIL_SIZE), DETAIL_SIZE, False, MUTED)
        else:
            lines.append(("", DETAIL_SIZE * 0.6, False, MUTED, False))
    return lines


def band_lines(node, width):
    """The heading text of a zone or of a box that contains other boxes."""
    tw = width - 2 * PAD
    if node.zone:
        return (
            styled(wrap(node.name, tw, ZONE_SIZE, True), ZONE_SIZE, True, INK)
            if node.name
            else []
        )
    on_band = "white" if node.header else None
    lines = (
        styled(
            wrap(node.tag, tw, TAG_SIZE), TAG_SIZE, False, on_band or node.edge, True
        )
        if node.tag
        else []
    )
    return lines + styled(
        wrap(node.name, tw, TITLE_SIZE, True), TITLE_SIZE, True, on_band or INK
    )


def band_height(node, width):
    """Height of the heading band at the top of a zone or container box."""
    band = band_lines(node, width)
    return lines_height(band) + PAD if band else 0.0


def head_height(node, width):
    """Height above the first row of children: heading band, details and a gap."""
    if node.type == "stack":
        return 0.0
    h = band_height(node, width)
    details = detail_lines(node.details, width - 2 * PAD)
    if details:
        h += lines_height(details) + PAD * 0.5
    return h + PAD


def inner_pad(node):
    """Space between a container's border and its children."""
    return 0.0 if node.type == "stack" else PAD


def foot_height(node):
    """Space at the bottom of a zone for its note caption."""
    return line_height(NOTE_SIZE) + PAD * 0.5 if node.note else 0.0


def grid(node, width):
    """Splits the children into lines of equal-width columns; returns column width and lines."""
    items = node.children
    n = len(items)
    if node.columns:
        cols = int(node.columns)
    elif node.type == "stack":
        cols = 1
    else:
        cols = max(1, min(n, int((width + GAP) // (MIN_LEAF_W + GAP))))
        cols = math.ceil(
            n / math.ceil(n / cols)
        )  # balance the lines: 4 items -> 2 + 2, not 3 + 1
    cols = max(1, min(cols, n))
    col_w = (width - (cols - 1) * GAP) / cols
    return col_w, [items[i : i + cols] for i in range(0, n, cols)]


def grid_height(node, width):
    """Total height of a container's children laid out in their grid."""
    if not node.children:
        return 0.0
    col_w, lines = grid(node, width)
    return sum(max(measure(i, col_w) for i in line) for line in lines) + GAP * (
        len(lines) - 1
    )


def measure(node, width):
    """How tall a box needs to be at the given width."""
    if not node.children and not node.zone:
        if node.type == "stack":
            return 0.0
        return max(MIN_H, lines_height(leaf_lines(node, width)) + 2 * PAD)
    p = inner_pad(node)
    return (
        head_height(node, width)
        + grid_height(node, width - 2 * p)
        + p
        + foot_height(node)
    )


def place(node, x0, y0, width, height):
    """Gives the box its rectangle and places its children inside it (y grows downward)."""
    node.rect = (x0, y0, x0 + width, y0 + height)
    if not node.children:
        return
    p = inner_pad(node)
    col_w, lines = grid(node, width - 2 * p)
    y = y0 + head_height(node, width)
    for line in lines:
        line_h = max(measure(i, col_w) for i in line)
        # Simple boxes only grow to match other simple boxes on their line, so a box that holds
        # children does not stretch its plain neighbours into tall empty boxes.
        leaf_h = max(
            (measure(i, col_w) for i in line if not i.children), default=line_h
        )
        for k, item in enumerate(line):
            place(
                item,
                x0 + p + k * (col_w + GAP),
                y,
                col_w,
                line_h if item.children else leaf_h,
            )
        y += line_h + GAP


def layout(zones, width, top):
    """Places the zones row by row; returns the y of the bottom of the last row."""
    rows = {}
    for zone in zones:
        rows.setdefault(zone.row, []).append(zone)
    y = top
    for r in sorted(rows):
        row = rows[r]
        avail = width - 2 * MARGIN - ZGAP * (len(row) - 1)
        total = sum(z.span for z in row)
        widths = [avail * z.span / total for z in row]
        height = max(measure(z, w) for z, w in zip(row, widths))
        x = MARGIN
        for zone, w in zip(row, widths):
            place(zone, x, y, w, height)
            x += w + ZGAP
        y += height + ZGAP
    return y - ZGAP


def label_rects(node):
    """Where the heading, detail and note text of a zone or of a box that holds other boxes
    sit, so arrows can be kept off them. Plain boxes have none (arrows never enter them).
    """
    if node.type == "stack" or not (node.zone or node.children):
        return []
    x0, y0, x1, y1 = node.rect
    rects = []

    def text_rect(lines, top):
        w = max(text_width(t, s, b) for t, s, b, _, _ in lines)
        rects.append((x0 + PAD, top, x0 + PAD + w, top + lines_height(lines)))

    band = band_lines(node, x1 - x0)
    if band:
        text_rect(band, y0 + PAD / 2)
    details = detail_lines(node.details, x1 - x0 - 2 * PAD)
    if details:
        text_rect(details, y0 + band_height(node, x1 - x0) + PAD * 0.25)
    if node.note:
        cx, w = (x0 + x1) / 2, text_width(node.note, NOTE_SIZE)
        ny = y1 - PAD * 0.5 - line_height(NOTE_SIZE)
        rects.append((cx - w / 2, ny, cx + w / 2, ny + line_height(NOTE_SIZE)))
    return rects


# ---------------------------------------------------------------- arrow routing


class Router:
    """Finds a path of horizontal and vertical lines between two boxes that goes around the
    other boxes, preferring few bends and not running on top of arrows already drawn."""

    def __init__(self, width, height, obstacles):
        self.nx = int(width / RES) + 1
        self.ny = int(height / RES) + 1
        self.obstacles = (
            obstacles  # (owner node, rectangle): boxes and zone heading/note text
        )
        self.used = (
            {}
        )  # grid point -> set of axes (0 horizontal, 1 vertical) already used

    def blocked(self, exclude):
        """A grid of points arrows may not use: every box (plus clearance) except `exclude`."""
        cells = bytearray(self.nx * self.ny)
        for owner, rect in self.obstacles:
            if owner in exclude:
                continue
            x0, y0, x1, y1 = rect
            i0 = max(0, math.ceil((x0 - CLEAR) / RES))
            i1 = min(self.nx - 1, math.floor((x1 + CLEAR) / RES))
            j0 = max(0, math.ceil((y0 - CLEAR) / RES))
            j1 = min(self.ny - 1, math.floor((y1 + CLEAR) / RES))
            for j in range(j0, j1 + 1):
                cells[j * self.nx + i0 : j * self.nx + i1 + 1] = b"\x01" * (i1 - i0 + 1)
        return cells

    def ports(self, rect):
        """Grid points just outside each side of a box: (i, j, outward direction, edge point)."""
        x0, y0, x1, y1 = rect
        d = CLEAR + RES
        out = []
        top, bottom = math.floor((y0 - d) / RES), math.ceil((y1 + d) / RES)
        for i in range(math.ceil((x0 + 1) / RES), math.floor((x1 - 1) / RES) + 1):
            out.append((i, top, 3, (i * RES, y0)))
            out.append((i, bottom, 2, (i * RES, y1)))
        left, right = math.floor((x0 - d) / RES), math.ceil((x1 + d) / RES)
        for j in range(math.ceil((y0 + 1) / RES), math.floor((y1 - 1) / RES) + 1):
            out.append((left, j, 1, (x0, j * RES)))
            out.append((right, j, 0, (x1, j * RES)))
        return [p for p in out if 0 <= p[0] < self.nx and 0 <= p[1] < self.ny]

    def route(self, src, dst):
        """Returns the corner points of the arrow from src to dst, or None if boxed in."""
        nx, ny = self.nx, self.ny
        blocked = self.blocked(set(src.chain()) | set(dst.chain()))
        free = [p for p in self.ports(src.rect) if not blocked[p[1] * nx + p[0]]]
        goals = {
            (i, j): (OPPOSITE[k], edge)
            for i, j, k, edge in self.ports(dst.rect)
            if not blocked[j * nx + i]
        }
        if not free or not goals:
            return None
        gi0, gi1 = min(i for i, _ in goals), max(i for i, _ in goals)
        gj0, gj1 = min(j for _, j in goals), max(j for _, j in goals)

        def estimate(i, j):
            return max(gi0 - i, 0, i - gi1) + max(gj0 - j, 0, j - gj1)

        # DECISION: How to draw arrows without hand-placed coordinates
        # Options considered:
        #   A) Straight or single-elbow lines between box centres — rejected: they cut through
        #      other boxes as soon as the layout has more than a few components
        #   B) Graphviz / external layout engine — rejected: extra install outside pip, and it
        #      re-arranges the zones instead of keeping the data-centre / cloud grouping
        #   C) A* search on a fine grid with bend and overlap costs — chosen: needs only the
        #      standard library, keeps the zone layout, and draws clean right-angle lines
        heap, best, parent, start_edge, finish = [], {}, {}, {}, {}
        for i, j, k, edge in free:
            best[(i, j, k)] = 0.0
            start_edge[(i, j, k)] = edge
            heapq.heappush(heap, (estimate(i, j), 0.0, i, j, k))
        while heap:
            _, cost, i, j, k = heapq.heappop(heap)
            if k == -1:  # reached the target box
                key, end_edge = finish[(i, j)][1:]
                return self._finish(key, parent, start_edge, end_edge)
            key = (i, j, k)
            if cost > best.get(key, math.inf):
                continue
            goal = goals.get((i, j))
            if goal:
                inward, edge = goal
                done = cost + (0.0 if k == inward else TURN)
                if done < finish.get((i, j), (math.inf,))[0]:
                    finish[(i, j)] = (done, key, edge)
                    heapq.heappush(heap, (done, done, i, j, -1))
            for nd, (dx, dy) in enumerate(DIRS):
                if nd == OPPOSITE[k]:
                    continue
                ni, nj = i + dx, j + dy
                if not (0 <= ni < nx and 0 <= nj < ny) or blocked[nj * nx + ni]:
                    continue
                step = cost + 1.0 + (TURN if nd != k else 0.0)
                axes = self.used.get((ni, nj))
                if axes:
                    step += OVERLAP if nd // 2 in axes else CROSS
                # keep parallel arrows one grid step apart so they stay easy to tell apart
                side = (
                    ((ni, nj - 1), (ni, nj + 1))
                    if nd < 2
                    else ((ni - 1, nj), (ni + 1, nj))
                )
                step += sum(NEAR for c in side if nd // 2 in self.used.get(c, ()))
                nkey = (ni, nj, nd)
                if step < best.get(nkey, math.inf):
                    best[nkey] = step
                    parent[nkey] = key
                    heapq.heappush(heap, (step + estimate(ni, nj), step, ni, nj, nd))
        return None

    def _finish(self, key, parent, start_edge, end_edge):
        """Turns the search result into corner points and remembers the track it used."""
        cells = [key]
        while cells[-1] in parent:
            cells.append(parent[cells[-1]])
        cells.reverse()
        for i, j, k in cells[1:]:
            self.used.setdefault((i, j), set()).add(k // 2)
        points = (
            [start_edge[cells[0]]]
            + [(i * RES, j * RES) for i, j, _ in cells]
            + [end_edge]
        )
        return simplify(points)


def simplify(points):
    """Drops points that sit in the middle of a straight run."""
    out = [points[0]]
    for p, nxt in zip(points[1:], points[2:] + [None]):
        if nxt is not None:
            a = out[-1]
            if (a[0] == p[0] == nxt[0]) or (a[1] == p[1] == nxt[1]):
                continue
        out.append(p)
    return out


def badge_spot(points, taken):
    """Picks a point on the arrow for its number badge, away from other badges."""
    segments = sorted(zip(points, points[1:]), key=lambda s: -math.dist(*s))
    if not segments:  # a route of a single point: nothing to choose from
        return points[0]
    if not taken:  # the first badge: the middle of the longest piece of the arrow
        a, b = segments[0]
        return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    for frac in (0.5, 0.3, 0.7, 0.15, 0.85):
        for a, b in segments:
            if math.dist(a, b) < 3:
                continue
            p = (a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac)
            if all(math.dist(p, t) > 3.2 for t in taken):
                return p
    # No preferred spot is free: try every tenth of every segment (short ones too), on the
    # line and just beside it, and take the point farthest from the badges already placed.
    # Two arrows sharing a short gap (a flow and its reverse) need the side positions.
    candidates = []
    for a, b in segments:
        side = (0.0, 2.8) if a[1] == b[1] else (2.8, 0.0)
        for f in range(1, 10):
            p = (a[0] + (b[0] - a[0]) * f / 10, a[1] + (b[1] - a[1]) * f / 10)
            candidates += [
                p,
                (p[0] + side[0], p[1] + side[1]),
                (p[0] - side[0], p[1] - side[1]),
            ]
    return max(candidates, key=lambda p: min(math.dist(p, t) for t in taken))


# ---------------------------------------------------------------- drawing


def draw_text(ax, lines, x, y, ha, z):
    """Writes styled lines one under another, starting at y."""
    for text, size, bold, color, italic in lines:
        h = line_height(size)
        if text:
            ax.text(
                x,
                y + h / 2,
                text,
                ha=ha,
                va="center",
                fontsize=size,
                color=color,
                zorder=z,
                weight="bold" if bold else "normal",
                style="italic" if italic else "normal",
            )
        y += h


def draw_icon(ax, icon, x, y, z):
    """Draws a small database cylinder or user screen centred on (x, y)."""
    if icon == "db":
        w, h = 3.0, 3.2
        ax.add_patch(
            Rectangle(
                (x - w / 2, y - h / 2), w, h, fc="#DCE6FB", ec=BLUE, lw=1, zorder=z
            )
        )
        ax.add_patch(
            Ellipse(
                (x, y - h / 2), w, 1.0, fc="#DCE6FB", ec=BLUE, lw=1, zorder=z + 0.01
            )
        )
        ax.add_patch(
            Ellipse(
                (x, y + h / 2), w, 1.0, fc="#DCE6FB", ec=BLUE, lw=1, zorder=z - 0.01
            )
        )
    elif icon == "user":
        ax.add_patch(
            Rectangle(
                (x - 2, y - 1.8), 4, 2.6, fc="#3B6FD8", ec="#1F4FB0", lw=1, zorder=z
            )
        )
        ax.add_patch(
            Rectangle(
                (x - 1.6, y - 1.45), 3.2, 1.9, fc="#DCE6FB", ec="none", zorder=z + 0.01
            )
        )
        ax.add_patch(
            Rectangle((x - 2.5, y + 0.8), 5, 0.5, fc="#1F4FB0", ec="none", zorder=z)
        )


def draw_node(ax, node, depth=0):
    """Draws a zone or component box with its text, then everything inside it."""
    if node.type == "stack":
        for child in node.children:
            draw_node(ax, child, depth + 1)
        return
    x0, y0, x1, y1 = node.rect
    w, z = x1 - x0, 1 + depth
    ax.add_patch(
        FancyBboxPatch(
            (x0, y0),
            w,
            y1 - y0,
            boxstyle="round,pad=0,rounding_size=0.6",
            fc=node.face,
            ec=node.edge,
            lw=1.2,
            ls=(0, (4, 3)) if node.dashed else "-",
            zorder=z,
        )
    )
    if not node.children and not node.zone:
        icon_w = icon_space(node, w)
        lines = leaf_lines(node, w)
        cx = (x0 + PAD + icon_w + x1 - PAD) / 2
        draw_text(
            ax, lines, cx, (y0 + y1) / 2 - lines_height(lines) / 2, "center", z + 0.2
        )
        if icon_w:
            draw_icon(
                ax, node.icon, x0 + PAD + icon_w / 2 - 0.3, (y0 + y1) / 2, z + 0.1
            )
        return
    bh = band_height(node, w)
    if node.header:
        ax.add_patch(
            FancyBboxPatch(
                (x0, y0),
                w,
                bh,
                boxstyle="round,pad=0,rounding_size=0.6",
                fc=node.header,
                ec="none",
                zorder=z + 0.1,
            )
        )
        ax.add_patch(
            Rectangle(
                (x0, y0 + bh / 2), w, bh / 2, fc=node.header, ec="none", zorder=z + 0.1
            )
        )
    draw_text(ax, band_lines(node, w), x0 + PAD, y0 + PAD / 2, "left", z + 0.2)
    draw_text(
        ax,
        detail_lines(node.details, w - 2 * PAD),
        x0 + PAD,
        y0 + bh + PAD * 0.25,
        "left",
        z + 0.2,
    )
    if node.note:
        ax.text(
            (x0 + x1) / 2,
            y1 - PAD * 0.5 - line_height(NOTE_SIZE) / 2,
            node.note,
            ha="center",
            va="center",
            fontsize=NOTE_SIZE,
            color=INK,
            style="italic",
            zorder=z + 0.2,
        )
    for child in node.children:
        draw_node(ax, child, depth + 1)


def draw_badge(ax, x, y, text, color):
    """Draws a round numbered badge."""
    ax.add_patch(Ellipse((x, y), 2.5, 2.5, fc=color, ec="white", lw=1.2, zorder=21))
    ax.text(
        x,
        y,
        text,
        ha="center",
        va="center",
        fontsize=8.5 if len(text) < 3 else 7,
        weight="bold",
        color="white",
        zorder=22,
    )


def draw_flow(ax, flow):
    """Draws an arrow through its corner points, with an arrowhead on the last segment."""
    color, dashed, _, _ = KINDS[flow.kind]
    if flow.todo:  # not confirmed yet: grey arrow, same line style as its kind
        color = TODO_FLOW
    xs, ys = zip(*flow.points)
    ax.plot(
        xs,
        ys,
        color=color,
        lw=1.5,
        ls=(0, (6, 4)) if dashed else "-",
        zorder=20,
        solid_capstyle="butt",
    )
    (xa, ya), (xb, yb) = flow.points[-2], flow.points[-1]
    ax.annotate(
        "",
        xy=(xb, yb),
        xytext=(xa + (xb - xa) * 0.9, ya + (yb - ya) * 0.9),
        zorder=20,
        arrowprops=dict(
            arrowstyle="-|>,head_length=0.8,head_width=0.4", color=color, lw=1.5
        ),
    )


def legend_entries(zones, flows):  # AC-F14
    """What the legend shows: one (text, colour, dashed) entry per flow kind used, plus an
    "Unverified" entry when any box or arrow is marked todo."""
    entries = [
        (KINDS[k][3], KINDS[k][0], KINDS[k][1])
        for k in KINDS
        if any(f.kind == k for f in flows)
    ]
    nodes = (n for z in zones for n in z.walk())
    if any(f.todo for f in flows) or any(n.todo for n in nodes):
        entries.append((TODO_LEGEND, TODO_EDGE, True))
    return entries


def legend_width(entries):
    """Width the legend needs for its entries."""
    return sum(5.4 + text_width(text, LEGEND_SIZE) + 2.5 for text, _, _ in entries)


def draw_legend(ax, entries, right, y):
    """Draws a line sample and label for each legend entry, right-aligned at `right`."""
    x = right
    for text, color, dashed in reversed(entries):
        x -= text_width(text, LEGEND_SIZE)
        ax.text(x, y, text, ha="left", va="center", fontsize=LEGEND_SIZE, color=INK)
        x -= 5.4
        ax.plot(
            [x, x + 4.4], [y, y], color=color, lw=1.6, ls=(0, (6, 4)) if dashed else "-"
        )
        x -= 2.5


def table_entries(flows, width):
    """The flow list under the diagram, split into two columns: (flow, lines, x offset, y offset)."""
    col_w = (width - 2 * MARGIN - GAP) / 2
    half = math.ceil(len(flows) / 2)
    entries, heights = [], [0.0, 0.0]
    for n, flow in enumerate(flows):
        col = 0 if n < half else 1
        text = f"{flow.src.name or flow.src.id} → {flow.dst.name or flow.dst.id}"
        text += f": {flow.label}" if flow.label else ""
        lines = wrap(text, col_w - 4, TABLE_SIZE)
        entries.append((flow, lines, col * (col_w + GAP), heights[col]))
        heights[col] += max(len(lines) * line_height(TABLE_SIZE), 2.6) + 0.6
    return entries, max(heights)


def route_all(zones, flows, width, height):
    """Routes every flow; a flow with no clear path is drawn straight with a warning.
    Returns the flows that had to be drawn straight."""
    obstacles = [
        (n, n.rect) for z in zones for n in z.walk() if not n.zone and n.type != "stack"
    ]
    # Heading, detail and note text of zones and container boxes have no owner, so arrows avoid
    # them even when the arrow starts or ends inside that zone or container.
    obstacles += [(None, r) for z in zones for n in z.walk() for r in label_rects(n)]
    router = Router(width, height, obstacles)
    fallbacks = []
    for flow in flows:
        points = router.route(flow.src, flow.dst)
        if points is None:
            fallbacks.append(flow)
            print(
                f"warning: no clear path {flow.src.id} -> {flow.dst.id}, drawn straight",
                file=sys.stderr,
            )
            (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = flow.src.rect, flow.dst.rect
            points = [
                ((ax0 + ax1) / 2, (ay0 + ay1) / 2),
                ((bx0 + bx1) / 2, (by0 + by1) / 2),
            ]
        flow.points = points
    return fallbacks


def draw(spec, output, dpi):
    """Lays out the spec, routes the arrows and saves the PNG. Returns the zones, the flows
    and the flows that had to be drawn straight, for --check."""
    width = float(spec.get("width", 140))
    zones, flows = build(spec)
    legend = legend_entries(zones, flows)

    title_w = width - 2 * MARGIN - legend_width(legend) - 3
    title = wrap(spec.get("title", "Architecture"), title_w, BIG_SIZE, True)
    subtitle = wrap(spec["subtitle"], title_w, SUB_SIZE) if spec.get("subtitle") else []
    top = (
        MARGIN
        + len(title) * line_height(BIG_SIZE)
        + len(subtitle) * line_height(SUB_SIZE)
        + 2
    )

    bottom = layout(zones, width, top)
    route_h = bottom + MARGIN
    fallbacks = route_all(zones, flows, width, route_h)

    entries, table_h = table_entries(flows, width)
    table_top = route_h + 1
    height = table_top + (line_height(ZONE_SIZE) + 1 + table_h if flows else 0) + MARGIN

    fig = plt.figure(figsize=(width / 10, height / 10), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, width)
    ax.set_ylim(height, 0)
    ax.set_aspect("equal")
    ax.axis("off")

    draw_text(ax, styled(title, BIG_SIZE, True, INK), MARGIN, MARGIN, "left", 2)
    sub_y = MARGIN + len(title) * line_height(BIG_SIZE)
    draw_text(ax, styled(subtitle, SUB_SIZE, False, MUTED), MARGIN, sub_y, "left", 2)
    draw_legend(ax, legend, width - MARGIN, MARGIN + line_height(BIG_SIZE) / 2)

    for zone in zones:
        draw_node(ax, zone)
    taken = []
    for flow in flows:
        draw_flow(ax, flow)
    for flow in flows:
        spot = badge_spot(flow.points, taken)
        taken.append(spot)
        flow.badge_xy = spot
        draw_badge(ax, spot[0], spot[1], flow.badge, KINDS[flow.kind][2])

    if flows:
        ax.text(
            MARGIN,
            table_top + line_height(ZONE_SIZE) / 2,
            "Flows",
            fontsize=ZONE_SIZE,
            weight="bold",
            color=INK,
            va="center",
        )
        y0 = table_top + line_height(ZONE_SIZE) + 1
        for flow, lines, dx, dy in entries:
            draw_badge(
                ax, MARGIN + 1.3 + dx, y0 + dy + 1.3, flow.badge, KINDS[flow.kind][2]
            )
            text_y = y0 + dy + 1.3 - line_height(TABLE_SIZE) / 2
            draw_text(
                ax,
                styled(lines, TABLE_SIZE, False, INK),
                MARGIN + 3.6 + dx,
                text_y,
                "left",
                2,
            )

    fig.savefig(output, dpi=dpi, facecolor="white")
    plt.close(fig)
    return zones, flows, fallbacks


# ---------------------------------------------------------------- --check


def overlaps(a, b):
    """True when two rectangles share some area (touching edges do not count)."""
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def inside(child, parent):
    """True when the child rectangle lies fully within the parent rectangle."""
    e = 1e-6
    return (
        child[0] >= parent[0] - e
        and child[1] >= parent[1] - e
        and child[2] <= parent[2] + e
        and child[3] <= parent[3] + e
    )


def segment_hits(a, b, rect):
    """True when the straight line from a to b passes through the rectangle."""
    x0, x1 = sorted((a[0], b[0]))
    y0, y1 = sorted((a[1], b[1]))
    if x0 == x1 and y0 == y1:
        return False
    e = 1e-9
    return x0 < rect[2] and rect[0] < x1 + e and y0 < rect[3] and rect[1] < y1 + e


def on_edge(point, rect):
    """True when the point lies on the border of the rectangle."""
    e = 1e-6
    x, y = point
    on_x = abs(x - rect[0]) < e or abs(x - rect[2]) < e
    on_y = abs(y - rect[1]) < e or abs(y - rect[3]) < e
    return (on_x and rect[1] <= y <= rect[3]) or (on_y and rect[0] <= x <= rect[2])


def check(zones, flows, fallbacks):  # AC-F4
    """Looks for layout and arrow problems in a drawn diagram; returns one line per problem."""
    problems = []
    # Boxes: zones in the same row and boxes inside the same parent must not overlap, and every
    # box must sit inside the box that contains it.
    groups = [[z for z in zones if z.row == r] for r in sorted({z.row for z in zones})]
    for node in (n for z in zones for n in z.walk()):
        if node.children:
            groups.append(node.children)
            for child in node.children:
                if not inside(child.rect, node.rect):
                    problems.append(f"{child.id} not inside {node.id}")
    for group in groups:
        for i, a in enumerate(group):
            for b in group[i + 1 :]:
                if overlaps(a.rect, b.rect):
                    problems.append(f"overlap {a.id} / {b.id}")
    # Arrows: straight horizontal / vertical pieces, starting and ending on their own boxes, and
    # not running through any box that is not one of their ends (or a box around an end).
    boxes = [n for z in zones for n in z.walk() if not n.zone and n.type != "stack"]
    straight = set(fallbacks)
    for flow in flows:
        if flow in straight:
            problems.append(f"no clear path for flow {flow.badge}")
            continue
        pairs = list(zip(flow.points, flow.points[1:]))
        if any(a[0] != b[0] and a[1] != b[1] for a, b in pairs):
            problems.append(f"diagonal segment in flow {flow.badge}")
        allowed = set(flow.src.chain()) | set(flow.dst.chain())
        for box in boxes:
            if box not in allowed and any(
                segment_hits(a, b, box.rect) for a, b in pairs
            ):
                problems.append(f"flow {flow.badge} crosses {box.id}")
        for node in (n for z in zones for n in z.walk()):
            if any(segment_hits(a, b, r) for r in label_rects(node) for a, b in pairs):
                problems.append(f"flow {flow.badge} crosses the text of {node.id}")
        if not (
            on_edge(flow.points[0], flow.src.rect)
            and on_edge(flow.points[-1], flow.dst.rect)
        ):
            problems.append(f"flow {flow.badge} does not start/end on box edges")
    # Number badges (2.5 units across) must not sit on top of each other.
    placed = [f for f in flows if f.badge_xy is not None]
    for i, a in enumerate(placed):
        for b in placed[i + 1 :]:
            if math.dist(a.badge_xy, b.badge_xy) < 2.5:
                problems.append(f"badges {a.badge} and {b.badge} overlap")
    # A badge placed beside its line must not land on a box the arrow does not run through
    # (boxes around its ends are fine), nor on its own start or end box.
    for flow in placed:
        x, y = flow.badge_xy
        allowed = set(flow.src.chain()) | set(flow.dst.chain())
        for box in boxes:
            own_end = box in (flow.src, flow.dst) and not box.children
            if (box not in allowed or own_end) and (
                box.rect[0] < x < box.rect[2] and box.rect[1] < y < box.rect[3]
            ):
                problems.append(f"badge {flow.badge} sits on {box.id}")
    return problems


def main():
    """Command-line entry point: reads the spec, draws the PNG, reports spec mistakes plainly."""
    parser = argparse.ArgumentParser(
        description="Draw an architecture / recovery diagram from a spec file."
    )
    parser.add_argument(
        "spec",
        type=Path,
        help="YAML or JSON spec describing zones, components and flows",
    )
    parser.add_argument("output", help="PNG file to write")
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument(  # AC-F4
        "--check",
        action="store_true",
        help="after drawing, report overlapping boxes and badly routed arrows (exit 1 if any)",
    )
    args = parser.parse_args()
    try:
        zones, flows, fallbacks = draw(load_spec(args.spec), args.output, args.dpi)
    except SpecError as err:
        sys.exit(f"spec error: {err}")
    print("saved", args.output)
    if args.check:
        problems = check(zones, flows, fallbacks)
        for problem in problems:
            print(f"check: {problem}")
        print(f"check: {len(problems)} problems" if problems else "check: ok")
        if problems:
            sys.exit(1)


if __name__ == "__main__":
    main()
