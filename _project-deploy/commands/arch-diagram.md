---
description: "Draw the application's architecture / technical recovery diagram (PNG) from a diagram spec — any hosting model. Scans the spec for secrets and hostnames first and asks before rendering.  Example: /arch-diagram --spec docs/architecture/diagram/myapp.arch.yaml"
argument-hint: "--spec <file> | --help"
---

If the argument is `--help` or `?help`, output the following block verbatim and stop — do not invoke the skill:

```
/arch-diagram — Draw an architecture / technical recovery diagram as a PNG.

Renders a diagram spec (zones, components, flows) with the plugin's renderer,
then checks the picture: no overlapping boxes, no arrow crossing a box or a
heading it does not belong to. Works for Kubernetes, Docker, Node.js / Linux
servers, Azure, AWS and on-prem IIS. The spec is scanned for secret values and
hostnames before anything is drawn, and nothing is written until you approve.

Needs Python 3.10+ with matplotlib and pyyaml on your machine
(pip install matplotlib pyyaml). They are never added to your project.

Arguments:
  --spec <file>    Render this spec to docs/images/{name}-architecture.png.
  --help, ?help    Show this help.

Example:
  /arch-diagram --spec docs/architecture/diagram/myapp.arch.yaml
```

<skill>ai-assisted-development:arch-diagram</skill>
