'use strict';
// Generates docs/presentations/ai-assisted-development-story.pptx
// "AI-Assisted Development — From Coder to Conductor" · v3.9.0 · 44-slide people-first arc.
// Slides stay MINIMAL; the full talk-through narration lives in each slide's speaker notes
// (s.addNotes) as one continuous first-person script.
// To change the deck: edit this file and re-run `node scripts/gen-story-pptx.cjs`.
const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches (16:9)

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  navy:   '1a3a5c',
  navy2:  '2c5f8a',
  gold:   'c8a951',
  white:  'FFFFFF',
  offwht: 'f8f9fa',
  ink:    '2d3436',
  muted:  '636e72',
  line:   'dfe6e9',
  green:  '00b894',
  red:    'e17055',
  amber:  'fdcb6e',
};

const FONT = 'Segoe UI';
const MONO = 'Cascadia Code';

// ─── Slide helpers ────────────────────────────────────────────────────────────

function darkSlide(slide, bgColor) {
  slide.background = { color: bgColor || C.navy };
}

function addEyebrow(slide, text, y = 0.4) {
  slide.addText(text, {
    x: 0.6, y, w: 12, h: 0.3,
    fontFace: FONT, fontSize: 9, bold: true, color: C.gold,
    charSpacing: 3,
  });
}

function addBullets(slide, items, opts = {}) {
  const rows = items.map(item => ({
    text: typeof item === 'string' ? item : item.text,
    options: { bullet: { type: 'bullet' }, indentLevel: item.indent ?? 0 },
  }));
  slide.addText(rows, {
    x: opts.x ?? 0.6, y: opts.y ?? 1.9, w: opts.w ?? 11.8, h: opts.h ?? 4.5,
    fontFace: FONT, fontSize: opts.size ?? 14, color: opts.color ?? C.ink,
    wrap: true, valign: 'top', paraSpaceAfter: 6,
  });
}

function addAhaBox(slide, tag, quote, sub, adrLabel, opts = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 1.8;
  const w = opts.w ?? 12.1;
  const h = opts.h ?? 1.6;

  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.07, h, fill: { color: C.gold }, line: { color: C.gold },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.07, y, w: w - 0.07, h,
    fill: { color: 'FDFCF5' }, line: { color: C.line, pt: 1 },
  });
  slide.addText(tag, {
    x: x + 0.2, y: y + 0.12, w: w - 0.5, h: 0.22,
    fontFace: MONO, fontSize: 8, bold: true, color: C.gold, charSpacing: 1.5,
  });
  slide.addText(quote, {
    x: x + 0.2, y: y + 0.32, w: w - 0.5, h: h - 0.7,
    fontFace: FONT, fontSize: 13, bold: true, color: C.navy, wrap: true, valign: 'top',
  });
  if (sub) {
    slide.addText(sub, {
      x: x + 0.2, y: y + h - 0.38, w: w - 1.5, h: 0.3,
      fontFace: FONT, fontSize: 10, color: C.muted, wrap: true,
    });
  }
  if (adrLabel) {
    slide.addText(adrLabel, {
      x: x + w - 1.1, y: y + h - 0.3, w: 0.95, h: 0.22,
      fontFace: MONO, fontSize: 8, color: C.muted, align: 'right',
    });
  }
}

function addFlowRow(slide, nodes, y = 3.5) {
  const total = nodes.length;
  const arrowW = 0.4;
  const nodeW = (12.8 - arrowW * (total - 1)) / total;
  let x = 0.3;

  nodes.forEach((n, idx) => {
    const fill = n.gate ? C.gold : n.out ? '00b894' : 'FFFFFF';
    const textColor = n.gate ? '1a2b17' : n.out ? 'FFFFFF' : C.navy;
    const lineColor = n.gate ? C.gold : n.out ? '00b894' : C.line;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: nodeW, h: 0.6,
      fill: { color: fill },
      line: { color: lineColor, pt: 1.5 },
      rectRadius: 0.07,
    });
    slide.addText(n.label, {
      x, y, w: nodeW, h: 0.6,
      fontFace: FONT, fontSize: 9.5, bold: true, color: textColor, align: 'center', valign: 'middle',
    });

    x += nodeW;
    if (idx < total - 1) {
      slide.addText('→', {
        x, y, w: arrowW, h: 0.6,
        fontFace: FONT, fontSize: 14, bold: true, color: C.gold, align: 'center', valign: 'middle',
      });
      x += arrowW;
    }
  });
}

function addBeforeAfter(slide, beforeItems, afterItems, opts = {}) {
  const y = opts.y ?? 1.8;
  const h = opts.h ?? 4.5;
  const colW = 6.0;
  const gap = 0.3;

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y, w: colW, h, fill: { color: 'FFF0ED' }, line: { color: 'F3B4A8', pt: 1 }, rectRadius: 0.1,
  });
  slide.addText(opts.beforeLabel ?? 'BEFORE', { x: 0.6, y: y + 0.1, w: colW - 0.4, h: 0.25, fontFace: FONT, fontSize: 9, bold: true, color: C.red, charSpacing: 2 });
  slide.addText(beforeItems.map(t => ({ text: t, options: { bullet: { type: 'bullet' } } })), {
    x: 0.6, y: y + 0.38, w: colW - 0.4, h: h - 0.5,
    fontFace: FONT, fontSize: 13, color: C.ink, wrap: true, valign: 'top', paraSpaceAfter: 7,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4 + colW + gap, y, w: colW, h, fill: { color: 'EEFAF6' }, line: { color: 'A8E4D1', pt: 1 }, rectRadius: 0.1,
  });
  slide.addText(opts.afterLabel ?? 'AFTER', { x: 0.6 + colW + gap, y: y + 0.1, w: colW - 0.4, h: 0.25, fontFace: FONT, fontSize: 9, bold: true, color: C.green, charSpacing: 2 });
  slide.addText(afterItems.map(t => ({ text: t, options: { bullet: { type: 'bullet' } } })), {
    x: 0.6 + colW + gap, y: y + 0.38, w: colW - 0.4, h: h - 0.5,
    fontFace: FONT, fontSize: 13, color: C.ink, wrap: true, valign: 'top', paraSpaceAfter: 7,
  });
}

const ORDINAL = { I: 'FIRST', II: 'SECOND', III: 'THIRD', IV: 'FOURTH', V: 'FIFTH' };

function addActOpener(slide, num, title, problem, adrRange) {
  darkSlide(slide, '0d1f35');
  slide.addText(num, {
    x: 0.4, y: 0.2, w: 3, h: 2.5,
    fontFace: MONO, fontSize: 120, bold: true, color: '1a3a5c',
  });
  addEyebrow(slide, `ACT ${num} · THE ${ORDINAL[num] || ''} ABSENCE`, 1.1);
  slide.addText(title, {
    x: 0.6, y: 1.5, w: 11.5, h: 1.4,
    fontFace: FONT, fontSize: 32, bold: true, color: C.white, wrap: true,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 3.0, w: 0.06, h: 0.55, fill: { color: C.gold }, line: { color: C.gold },
  });
  slide.addText(`"${problem}"`, {
    x: 0.8, y: 3.0, w: 11, h: 0.55,
    fontFace: FONT, fontSize: 15, italic: true, color: 'b7c6d6', wrap: true, valign: 'middle',
  });
  slide.addText(adrRange, {
    x: 0.6, y: 6.9, w: 12.1, h: 0.25,
    fontFace: MONO, fontSize: 8, color: '3a5a7c', align: 'right',
  });
}

function addInterludeOpener(slide, kicker, title, epigraph, adrRange) {
  darkSlide(slide, '241a35'); // purple-ink for interludes
  addEyebrow(slide, kicker, 1.1);
  slide.addText(title, {
    x: 0.6, y: 1.5, w: 11.5, h: 1.4,
    fontFace: FONT, fontSize: 32, bold: true, color: C.white, wrap: true,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 3.0, w: 0.06, h: 0.7, fill: { color: 'a78bfa' }, line: { color: 'a78bfa' },
  });
  slide.addText(`"${epigraph}"`, {
    x: 0.8, y: 3.0, w: 11.4, h: 0.7,
    fontFace: FONT, fontSize: 15, italic: true, color: 'c9bde6', wrap: true, valign: 'middle',
  });
  if (adrRange) {
    slide.addText(adrRange, {
      x: 0.6, y: 6.9, w: 12.1, h: 0.25,
      fontFace: MONO, fontSize: 8, color: '6b5fa8', align: 'right',
    });
  }
}

function addSlideNumber(slide, n, total) {
  slide.addText(`${n} / ${total}`, {
    x: 11.5, y: 7.1, w: 1.5, h: 0.25,
    fontFace: MONO, fontSize: 8, color: C.muted, align: 'right',
  });
}

function addSlideHeading(slide, text) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.42, w: 0.15, h: 0.15,
    fill: { color: C.gold }, line: { color: C.gold }, rectRadius: 0.03,
  });
  slide.addText(text, {
    x: 0.75, y: 0.32, w: 12, h: 0.38,
    fontFace: FONT, fontSize: 22, bold: true, color: C.navy,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.5, y: 0.78, w: 12.4, h: 0,
    line: { color: C.line, pt: 1 },
  });
}

// Small card grid helper (title + body cards in a row)
function addCardRow(slide, cards, opts = {}) {
  const y = opts.y ?? 3.3;
  const h = opts.h ?? 2.6;
  const n = cards.length;
  const gap = 0.15;
  const w = (12.4 - gap * (n - 1)) / n;
  cards.forEach((c, i) => {
    const x = 0.5 + i * (w + gap);
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
    if (c.tag) slide.addText(c.tag.toUpperCase(), { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.22, fontFace: MONO, fontSize: 8, color: C.gold, charSpacing: 1 });
    slide.addText(c.title, { x: x + 0.15, y: y + (c.tag ? 0.36 : 0.15), w: w - 0.3, h: 0.5, fontFace: FONT, fontSize: 13, bold: true, color: C.navy, wrap: true });
    slide.addText(c.body, { x: x + 0.15, y: y + (c.tag ? 0.86 : 0.7), w: w - 0.3, h: h - (c.tag ? 1.0 : 0.85), fontFace: FONT, fontSize: 11, color: C.muted, wrap: true, valign: 'top' });
  });
}

// ─── Build slides ─────────────────────────────────────────────────────────────

const TOTAL = 45;
let PAGE = 0; // auto-incrementing page counter (see addSlideNumber calls) — insert slides freely

// ══════════════════════════ PROLOGUE (1–5) ══════════════════════════

// ── 1. TITLE ────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  darkSlide(s, '1a3a5c');
  addEyebrow(s, 'A STORY IN FIVE ACTS · ALL AUDIENCES', 0.5);
  s.addText('From Coder to Conductor', {
    x: 0.6, y: 0.95, w: 12, h: 1.5,
    fontFace: FONT, fontSize: 48, bold: true, color: C.white, wrap: true,
  });
  s.addText('What your job becomes when the AI writes the code —\nand the system that makes that new role trustworthy.', {
    x: 0.6, y: 2.7, w: 11, h: 1.1,
    fontFace: FONT, fontSize: 18, color: 'cdd9e6', wrap: true,
  });

  const badges = ['v3.9.0', '52 ADRs on disk', '5 acts · 5 absences', '38 commands · 26 skills'];
  badges.forEach((b, i) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.6 + i * 2.9, y: 4.1, w: 2.75, h: 0.38,
      fill: { color: '1E4870' }, line: { color: '4a7aaa', pt: 1 }, rectRadius: 0.19,
    });
    s.addText(b, {
      x: 0.6 + i * 2.9, y: 4.1, w: 2.75, h: 0.38,
      fontFace: FONT, fontSize: 11, color: 'eaf1f8', align: 'center', valign: 'middle',
    });
  });

  s.addText('Act I: Spec  ·  Act II: Trust  ·  Act III: Continuity  ·  Act IV: Knowledge  ·  Act V: Observability', {
    x: 0.6, y: 4.75, w: 12, h: 0.3,
    fontFace: FONT, fontSize: 11, color: C.gold,
  });
  s.addText('Vivek Rawat  ·  July 2026  ·  ai-assisted-development plugin', {
    x: 0.6, y: 7.05, w: 12, h: 0.25,
    fontFace: FONT, fontSize: 9, color: '7a92a8',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`I want to tell you a story about a job that changed — and the job is yours. For years the deal was simple: you understood the code, you made the change, you pushed it, and you asked someone to review it. Somewhere in the last couple of years that quietly stopped being the whole job, because the AI writes the code now. So what's actually left for you? That's what this talk is about. I'll tell it in five acts, the way we really lived it — through the fifty-two decisions we made building a plugin to survive the change. Let me start with a confession.`);
}

// ── 2. THE STATEMENT (full-bleed quote) ──────────────────────────────────────
{
  const s = pptx.addSlide();
  darkSlide(s, '0d1f35');
  s.addText('“I understand the change, I make it, I push it,\nI tell the lead — review it, ping me if there’s a problem.”', {
    x: 1.0, y: 2.3, w: 11.3, h: 2.4,
    fontFace: 'Georgia', fontSize: 30, italic: true, color: 'eef4fb', wrap: true, align: 'center', valign: 'middle',
  });
  s.addText('— how we work today', {
    x: 1.0, y: 4.9, w: 11.3, h: 0.4,
    fontFace: FONT, fontSize: 13, color: '6b8199', align: 'center',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Here's the confession — and I suspect it's yours too. This is how most of us have always worked: I understand the change, I make it, I push it, I tell the lead to review it and ping me if there's a problem. Read that line and notice how completely reasonable it sounds. I want you to sit with it for a second, because I'm about to show you why this exact sentence — the one that served us well for a decade — quietly stopped working.`);
}

// ── 3. THE REVEAL (the loop is broken) ────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'That worked — when your peer was human');
  s.addText('A human peer pushes back. Asks “are you sure?”. Spots the wrong direction and stops you.\nYour peer is now an AI that writes confidently in the wrong direction — and never hesitates.', {
    x: 0.6, y: 1.0, w: 12.1, h: 1.0,
    fontFace: FONT, fontSize: 15, color: C.ink, wrap: true,
  });

  const cx = 6.65, cy = 4.35;
  s.addShape(pptx.ShapeType.ellipse, { x: cx - 2.2, y: cy - 1.55, w: 4.4, h: 3.1, fill: { color: 'FFFFFF' }, line: { color: C.line, pt: 1.5 } });
  const loop = [
    { t: 'you make\nthe change', dx: -2.5, dy: -0.35, fill: 'EAF4FF', border: '74b9ff', color: C.navy },
    { t: 'you push it', dx: 0.0, dy: -1.95, fill: 'EAF4FF', border: '74b9ff', color: C.navy },
    { t: 'human peer\npushes back', dx: 2.5, dy: -0.35, fill: 'FFF0ED', border: 'e17055', color: 'e17055', crossed: true },
    { t: 'ship', dx: 0.0, dy: 1.25, fill: 'EAFAF4', border: '00b894', color: C.navy },
  ];
  loop.forEach(n => {
    s.addShape(pptx.ShapeType.roundRect, { x: cx + n.dx - 0.9, y: cy + n.dy - 0.4, w: 1.8, h: 0.8, fill: { color: n.fill }, line: { color: n.border, pt: 1.5 }, rectRadius: 0.1 });
    s.addText(n.t, { x: cx + n.dx - 0.9, y: cy + n.dy - 0.4, w: 1.8, h: 0.8, fontFace: FONT, fontSize: 10, bold: true, color: n.color, align: 'center', valign: 'middle', wrap: true });
    if (n.crossed) {
      s.addShape(pptx.ShapeType.line, { x: cx + n.dx - 0.9, y: cy + n.dy - 0.4, w: 1.8, h: 0.8, line: { color: 'e17055', pt: 2.5 } });
    }
  });
  s.addText('AI — never says no', { x: cx + 1.6, y: cy + 0.55, w: 2.4, h: 0.4, fontFace: MONO, fontSize: 10, bold: true, color: 'e17055', align: 'center' });
  s.addText('The loop still runs. But no one is checking intent anymore.', {
    x: 0.6, y: 6.55, w: 12.1, h: 0.4,
    fontFace: FONT, fontSize: 13, italic: true, color: C.muted, align: 'center',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`That sentence worked for years — but only because of one word we never said out loud: peer. When my reviewer was a human, they pushed back. They asked "are you sure?" They caught me heading in the wrong direction and stopped me before it cost anything. Now my peer is an AI. It's fast, it's confident — and it never hesitates, never doubts, never asks whether I actually meant what I said. So the loop still runs exactly as before: make it, push it, review it. But look at what's gone — the one node that used to check intent. Nobody is asking "are you sure?" anymore. And honestly, everything I built next was one long attempt to put that missing check back.`);
}

// ── 4. YOUR ROLE NOW (5 shifts) ──────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'So what is your role now?');
  s.addText('The coding got cheaper. So the thinking got more valuable — and the thinking is now your job.', {
    x: 0.6, y: 1.0, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 15, italic: true, color: C.muted, wrap: true,
  });
  const shifts = [
    { n: '01', t: 'Wear the BA hat', b: 'Turn a one-line ask from the business into a complete, end-to-end requirement.' },
    { n: '02', t: 'Understand the whole system', b: 'Functionally and as a solution architect — not just the file you’re touching.' },
    { n: '03', t: 'Review the AI’s plan', b: 'Identify what’s out of scope — and be able to say why.' },
    { n: '04', t: 'Stop coding line-by-line', b: 'You no longer just look at the part of the code the change touches.' },
    { n: '05', t: 'Manage an agent', b: 'You are the reviewer, directing an AI to the result — the conductor, not the player.' },
  ];
  shifts.forEach((p, i) => {
    const x = 0.5 + i * 2.5;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.75, w: 2.4, h: 4.4, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
    s.addShape(pptx.ShapeType.rect, { x, y: 1.75, w: 2.4, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(p.n, { x: x + 0.15, y: 1.95, w: 2.1, h: 0.4, fontFace: MONO, fontSize: 14, bold: true, color: C.gold });
    s.addText(p.t, { x: x + 0.15, y: 2.45, w: 2.1, h: 0.9, fontFace: FONT, fontSize: 14, bold: true, color: C.navy, wrap: true });
    s.addText(p.b, { x: x + 0.15, y: 3.4, w: 2.1, h: 2.6, fontFace: FONT, fontSize: 11, color: C.muted, wrap: true, valign: 'top' });
  });
  s.addText('Coder  →  Conductor', { x: 0.6, y: 6.45, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.gold, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So if the AI is doing the typing, what is the job now? The coding got cheaper — which means the thinking got more valuable, and the thinking is now the work. There are five shifts. You wear the BA hat, turning a one-line ask into a real requirement. You understand the whole system like a solution architect, not just the file you happen to be touching. You review the AI's plan and you can say what's out of scope, and why. You stop being the coder who only looks at the impacted lines. And above all, you become the reviewer managing an agent to a result. Coder to conductor — that's the promotion. Everything that follows is what it actually takes to do it.`);
}

// ── 5. NEW RESPONSIBILITIES, NOT NEW TOOLS (bridge) ───────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'These aren’t new tools. They’re new responsibilities.');
  s.addText('Each responsibility needs a system behind it — or it collapses back into “just review the PR.” The rest of this deck is that system: five discoveries, each the answer to “how do I do this new job safely and repeatably?”', {
    x: 0.6, y: 1.05, w: 12.1, h: 1.0, fontFace: FONT, fontSize: 15, color: C.ink, wrap: true,
  });
  const map = [
    ['Own the intent (BA hat)', 'Act I · Spec'],
    ['Review the AI’s judgment', 'Act II · Trust'],
    ['Carry decisions forward', 'Act III · Continuity'],
    ['Understand the whole system', 'Act IV · Knowledge'],
    ['Prove it actually held', 'Act V · Observability'],
  ];
  map.forEach((row, i) => {
    const y = 2.4 + i * 0.82;
    s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y, w: 6.2, h: 0.68, fill: { color: 'F4F7FA' }, line: { color: C.line, pt: 1 }, rectRadius: 0.08 });
    s.addText(row[0], { x: 0.9, y, w: 5.8, h: 0.68, fontFace: FONT, fontSize: 13, bold: true, color: C.navy, valign: 'middle' });
    s.addText('→', { x: 7.0, y, w: 0.6, h: 0.68, fontFace: FONT, fontSize: 18, bold: true, color: C.gold, align: 'center', valign: 'middle' });
    s.addShape(pptx.ShapeType.roundRect, { x: 7.7, y, w: 4.9, h: 0.68, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 });
    s.addText(row[1], { x: 7.9, y, w: 4.5, h: 0.68, fontFace: FONT, fontSize: 13, bold: true, color: C.white, valign: 'middle' });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Now, here's the thing — none of those five things are new tools. They're new responsibilities. And a responsibility with no system behind it just quietly collapses back into "someone please review the PR." So each of the five acts coming up is the machinery behind one of these: owning intent, reviewing judgment, keeping continuity, understanding the system, and proving it held. Watch them line up one to one — because at the very end, this exact mapping is how we'll close the loop.`);
}

// ══════════════════════════ FRAMING (6–7) ══════════════════════════

// ── 6. FIVE PARTS / FIVE WALLS ────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Five parts of the new job. Five walls we hit.');
  s.addText('Every one of those responsibilities walked into a wall the first time we tried it with an AI in the loop. This isn’t a feature tour — it’s five walls, in the order we hit them.', {
    x: 0.6, y: 1.0, w: 12.1, h: 0.75, fontFace: FONT, fontSize: 14, italic: true, color: C.muted, wrap: true,
  });
  const rows = [
    ['Your new job asks you to…', '…but first we hit a wall', 'Act'],
    ['Own the intent (BA hat)', 'Nothing captured intent', 'I · Spec'],
    ['Review the AI’s judgment', 'Nothing let you see it', 'II · Trust'],
    ['Carry decisions forward', 'Every session started cold', 'III · Continuity'],
    ['Understand the whole system', 'We re-read it every time', 'IV · Knowledge'],
    ['Prove it actually held', 'We couldn’t show it did', 'V · Observability'],
  ];
  const colX = [0.5, 5.0, 9.5];
  const colW = [4.4, 4.4, 3.3];
  rows.forEach((row, ri) => {
    const y = 1.95 + ri * 0.72;
    const header = ri === 0;
    row.forEach((cell, ci) => {
      s.addShape(pptx.ShapeType.rect, { x: colX[ci], y, w: colW[ci], h: 0.68, fill: { color: header ? C.navy : (ci === 2 ? 'FFF8EC' : C.white) }, line: { color: header ? C.navy : C.line, pt: 1 } });
      s.addText(cell, { x: colX[ci] + 0.12, y, w: colW[ci] - 0.2, h: 0.68, fontFace: ci === 2 ? MONO : FONT, fontSize: header ? 11 : 12, bold: header || ci === 2, color: header ? C.white : (ci === 2 ? C.gold : C.ink), valign: 'middle', wrap: true });
    });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Here's the honest version of how this got built: we did not design it up front. We took those five responsibilities, tried to actually do each one with an AI in the loop, and walked straight into a wall every single time. You can't own intent if nothing captures intent. You can't review judgment you can't see. You can't carry a decision forward if the tool forgets it by lunch. Five responsibilities, five walls, in the order we hit them. Hold onto this table — at the very end we'll read it backwards, and every wall will have a door.`);
}

// ── 7. PLUGIN, NOT A PROMPT LIBRARY ───────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'We built a plugin — not a prompt library');
  s.addText('A prompt library assists how you already work. A plugin enforces how you’ve agreed to work. If your job is to manage an AI instead of out-typing it, suggestions aren’t enough — you need something that holds.', {
    x: 0.5, y: 0.95, w: 12.3, h: 0.9,
    fontFace: FONT, fontSize: 14, color: C.muted, wrap: true, italic: true,
  });
  const stats = [
    { n: '38', label: 'Commands', sub: 'Thin entry points into governed workflows' },
    { n: '26', label: 'Skills', sub: 'Behavioral modules with shared primitives' },
    { n: '52', label: 'ADRs', sub: 'Decisions on disk — every choice traceable' },
    { n: '5',  label: 'Acts', sub: 'Five discoveries, each built on the last' },
  ];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.05, w: 2.95, h: 2.5, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.12 });
    s.addShape(pptx.ShapeType.rect, { x, y: 2.05, w: 2.95, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(st.n, { x, y: 2.2, w: 2.95, h: 1.0, fontFace: MONO, fontSize: 48, bold: true, color: C.navy, align: 'center' });
    s.addText(st.label, { x, y: 3.2, w: 2.95, h: 0.35, fontFace: FONT, fontSize: 14, bold: true, color: C.navy, align: 'center' });
    s.addText(st.sub, { x, y: 3.55, w: 2.95, h: 0.8, fontFace: FONT, fontSize: 10, color: C.muted, align: 'center', wrap: true });
  });
  s.addText('"It didn\'t start complete. It started as a gate — and kept discovering what it was still missing."', {
    x: 0.5, y: 4.8, w: 12.3, h: 0.5,
    fontFace: FONT, fontSize: 12, italic: true, color: C.muted, wrap: true,
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`One framing before we start climbing. What we built is a plugin, not a prompt library — and that distinction is the whole game. A prompt library assists how you already work; it's a suggestion. A plugin enforces how you've agreed to work; it's a system. If your job is now to manage an AI instead of out-typing it, suggestions aren't enough — you need something that holds. Thirty-eight commands, twenty-six skills, fifty-two decisions on disk. And it did not arrive complete — it started as a single gate and kept telling us what it was still missing. Which brings us to act one.`);
}

// ══════════════════════════ ACT I — SPEC (8–12) ══════════════════════════

// ── 8. ACT I OPENER ──────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addActOpener(s, 'I', 'Structure Around the Spec',
    'The AI won’t ask what you meant. So you have to say it first.',
    'ADRs 0001 · 0002 · 0005 · 0006 · 0010 · 0028');
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Act one. Structure around the spec. The wall here is the simplest one and the most expensive: the AI will never ask you what you meant, so somebody has to say it first — and that somebody is now you.`);
}

// ── 9. ACT I FAILURE: NOBODY OWNED THE INTENT ─────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The failure mode: nobody owned the intent');
  addBullets(s, [
    { text: 'Intent lived in a head, not a doc — the requirement was in a Slack thread, or nowhere.' },
    { text: 'The AI filled the gap with its own assumptions, and wrote confidently in that direction.' },
    { text: 'The reviewer was the first human to check meaning — days later, at the most expensive moment.' },
    { text: 'The cost landed as rework — not bugs, not tech debt. Rework from thin or absent specs.' },
  ], { y: 1.0, h: 3.2, size: 14 });

  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 4.4, w: 12.3, h: 1.5, fill: { color: 'FFF8EC' }, line: { color: 'E8C87A', pt: 1 }, rectRadius: 0.1 });
  s.addText('THE ROI THESIS  ·  ADR 0001', { x: 0.8, y: 4.55, w: 11, h: 0.28, fontFace: MONO, fontSize: 8, bold: true, color: C.gold, charSpacing: 1.5 });
  s.addText('"One good spec you own up front prevents roughly three PRs that would have bounced."', { x: 0.8, y: 4.85, w: 11.5, h: 0.75, fontFace: FONT, fontSize: 16, bold: true, color: C.navy, wrap: true });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So here's the first wall we hit. Back then the spec — if it existed at all — lived in a Slack thread, and the code lived in the pull request, and the first time anyone put the two side by side was code review, days later. By then the AI had already written confidently in whatever direction it assumed. Business logic had leaked into controllers. And nobody had actually agreed on what we were building in the first place. The expensive part was never the bugs — it was the rework. We measured it, and one decent spec written up front saved about three PRs that would otherwise have bounced. That's the number that turned "write a spec" from a nag into a business case — and it's the reason act one exists.`);
}

// ── 10. WHAT ICEA IS (quadrant) ───────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'What ICEA is: the four things you pin down');
  s.addText('Not a template to fill — four things you decide, so the AI has nothing left to assume.', {
    x: 0.6, y: 0.95, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 13, italic: true, color: C.muted,
  });
  const quad = [
    { L: 'I', t: 'Intent', q: 'what & why', feeds: 'the one-liner → a real goal · feeds the ADO work item', col: 'e84c1e' },
    { L: 'C', t: 'Context', q: 'where & constraints', feeds: 'stack · auth · data · edges · feeds design & scope', col: C.gold },
    { L: 'E', t: 'Examples', q: 'show, don’t tell', feeds: 'given/when/then · edges · errors · feeds the tests', col: '1a56db' },
    { L: 'A', t: 'Acceptance', q: 'definition of done', feeds: 'pass/fail, no argument · feeds what closes the ticket', col: '00b894' },
  ];
  quad.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.5 + row * 2.5;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.95, h: 2.3, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.2, y: y + 0.25, w: 0.7, h: 0.7, fill: { color: c.col }, line: { color: c.col } });
    s.addText(c.L, { x: x + 0.2, y: y + 0.25, w: 0.7, h: 0.7, fontFace: FONT, fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle' });
    s.addText(c.t, { x: x + 1.05, y: y + 0.25, w: 4.7, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.navy });
    s.addText(c.q, { x: x + 1.05, y: y + 0.65, w: 4.7, h: 0.35, fontFace: FONT, fontSize: 12, italic: true, color: C.muted });
    s.addText(c.feeds, { x: x + 0.25, y: y + 1.15, w: 5.5, h: 1.0, fontFace: FONT, fontSize: 11, color: C.ink, wrap: true, valign: 'top' });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Before I go any further I owe you a definition, because I'm going to lean on this thing all talk. ICEA is four questions you answer so the AI has nothing left to guess. Intent — what are we building, and why; the one-liner from the business becomes a real goal. Context — where it lives and what constrains it: the stack, the auth, the data, the edges. Examples — you show instead of tell: given, when, then; the happy path, the error, the permission boundary. And Acceptance — a definition of done you could pass or fail without an argument. It is not a form. It's you doing the thinking. And notice each part feeds something downstream — the work item, the design, the tests, the ticket close.`);
}

// ── 11. SAMPLE ICEA (document mock — "screenshot") ────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'A real ICEA — what you’re actually approving');

  const dx = 0.9, dy = 1.0, dw = 11.5, dh = 5.75;
  // subtle drop shadow + paper
  s.addShape(pptx.ShapeType.rect, { x: dx + 0.06, y: dy + 0.08, w: dw, h: dh, fill: { color: 'd9dfe6' }, line: { type: 'none' } });
  s.addShape(pptx.ShapeType.rect, { x: dx, y: dy, w: dw, h: dh, fill: { color: 'FFFFFF' }, line: { color: C.line, pt: 1 } });
  // header strip
  s.addShape(pptx.ShapeType.rect, { x: dx, y: dy, w: dw, h: 0.62, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText('# ICEA — Deal Search Filter', { x: dx + 0.25, y: dy, w: 7.4, h: 0.62, fontFace: MONO, fontSize: 14, bold: true, color: 'FFFFFF', valign: 'middle' });
  s.addText('ADO #1847 · Release 4 · Sprint 3', { x: dx + 7.6, y: dy, w: 2.2, h: 0.62, fontFace: MONO, fontSize: 9, color: 'aac3dd', valign: 'middle' });
  s.addShape(pptx.ShapeType.roundRect, { x: dx + dw - 1.85, y: dy + 0.16, w: 1.65, h: 0.3, fill: { color: '0f5132' }, line: { color: '00b894', pt: 1 }, rectRadius: 0.15 });
  s.addText('✅ APPROVED', { x: dx + dw - 1.85, y: dy + 0.16, w: 1.65, h: 0.3, fontFace: MONO, fontSize: 9, bold: true, color: 'a8f0d0', align: 'center', valign: 'middle' });

  const secX = dx + 0.3;
  const secW = dw - 0.6;
  let yy = dy + 0.8;
  const section = (label, color, body, hgt) => {
    s.addShape(pptx.ShapeType.rect, { x: secX, y: yy + 0.02, w: 0.12, h: hgt - 0.12, fill: { color }, line: { color } });
    s.addText(label, { x: secX + 0.22, y: yy, w: secW - 0.22, h: 0.26, fontFace: MONO, fontSize: 9.5, bold: true, color, charSpacing: 1 });
    s.addText(body, { x: secX + 0.22, y: yy + 0.28, w: secW - 0.22, h: hgt - 0.32, fontFace: FONT, fontSize: 11.5, color: C.ink, wrap: true, valign: 'top' });
    yy += hgt;
  };
  section('## INTENT', 'e84c1e',
    'As a deal analyst, I want to search the deals grid by name, status and date range, so that I can find a matter in seconds instead of scrolling.  Success metric: median time-to-find < 5s on 10k deals.', 1.1);
  section('## CONTEXT', C.gold,
    'System context:  API — DealController (modify) · Web — deals-grid.component (extend) · Data — Dapper + parameterised SQL.  Change tier: T2 — new query path, no schema change. Auth: roleId from Azure AD token.', 1.1);
  section('## EXAMPLES', '1a56db',
    'Happy path —  Given an active analyst, When they type “acme” and pick status = Open, Then matching deals return, newest first.', 0.82);
  section('## ACCEPTANCE', '00b894',
    'AC-F1: results filter by name / status / date, combinable.   AC-NF1: p95 latency < 300ms on 10k rows.   Out of scope: saved searches · export.', 0.95);

  s.addShape(pptx.ShapeType.line, { x: secX, y: yy + 0.04, w: secW, h: 0, line: { color: C.line, pt: 1 } });
  s.addText('Sign-off:   Product ✅   ·   Tech Lead ✅', { x: secX, y: yy + 0.12, w: secW, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: C.muted });

  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Those are the four questions in the abstract — but let me show you a real one, because this is what you're actually signing. Here's the ICEA for a small feature: a search filter on a deals grid, filled in and approved. Notice how short it is. The intent is one sentence with a measurable success metric — find a matter in under five seconds. The context names the exact files that change and pins the tier. The examples are given-when-then, not prose. And the acceptance criteria are things you could pass or fail without arguing, including a hard performance number — p95 under three hundred milliseconds. Then, down at the bottom, a named product owner and a named tech lead have signed it. That's the whole of act one on a single page: this is what "owning the intent" actually looks like, and it's exactly what the AI builds against. So the real question is — why does making people write this change how they behave?`);
}

// ── 12. THE SPEC IS YOU THINKING ──────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The spec is you thinking — not the tool policing you');
  addAhaBox(s,
    'THE INSIGHT  ·  ADR 0001',
    '"The ICEA step isn’t a form the tool makes you fill in. It’s the moment you do the part of the job that’s now yours — turning a one-line ask into an intent the AI can’t misread."',
    'Developers who knew a thin spec would bite them started thinking harder up front — on their own. Nobody enforced better specs. The incentive did.',
    'ADR 0001',
    { y: 1.0, h: 2.1 }
  );
  addAhaBox(s,
    'THE HONESTY PIVOT  ·  ADR 0009 → ADR 0010',
    '"The floor governs the willing and makes bypass visible — not impossible."',
    'Server-side enforcement was the goal (ADR 0009). Deployment reality: the plugin never runs in CI. Answer: make skipping the thinking visible, not pretend it’s impossible.',
    'ADR 0010',
    { y: 3.3, h: 1.95 }
  );
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Here's the reframe that changed everything for us. For a while people treated the ICEA step as a form the tool was making them fill in — pure friction. It isn't. It's the moment you do the part of the job that's now yours: turning a vague ask into an intent the AI can't misread. And the fascinating thing we watched happen — once developers knew a thin spec would come back and bounce their own PR, they started thinking harder up front, entirely on their own. Nobody enforced better specs. The incentive did. Now let me be honest about the floor: we wanted server-side enforcement, but the plugin never actually runs in our CI. So instead of pretending we can make bypass impossible, we make it visible. Honesty over overclaim — you'll hear me say that more than once today.`);
}

// ── 12. YOU WRITE THE CONTRACT ────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'You write the contract; the AI is the contractor');
  addFlowRow(s, [
    { label: 'You: define\nintent (ICEA)' },
    { label: 'You: APPROVE\nADO-{ID}', gate: true },
    { label: 'AI: build' },
    { label: 'You: sign\nthe diff', gate: true },
    { label: 'Source on\ndisk', out: true },
    { label: 'PR' },
  ], 1.15);

  const layers = [
    { title: 'Layer A — Model', sub: 'You: define intent', body: 'CLAUDE.md rules instruct the model. Probabilistic but flexible — applies everywhere.' },
    { title: 'Layer B — Hooks', sub: 'You: approve', body: 'PreToolUse hooks intercept tool calls mechanically. Deterministic — cannot be argued with.' },
    { title: 'Layer C — Git / CI', sub: 'The floor is visible', body: 'Git pre-commit + CI enforce the minimum. Bypass is visible — not claimed impossible.' },
  ];
  layers.forEach((l, i) => {
    const x = 0.5 + i * 4.1;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.15, w: 3.95, h: 2.55, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
    s.addText(l.title.toUpperCase(), { x: x + 0.15, y: 2.27, w: 3.65, h: 0.22, fontFace: MONO, fontSize: 8, color: C.muted, charSpacing: 1 });
    s.addText(l.sub, { x: x + 0.15, y: 2.51, w: 3.65, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.navy });
    s.addText(l.body, { x: x + 0.15, y: 2.9, w: 3.65, h: 1.7, fontFace: FONT, fontSize: 11.5, color: C.muted, wrap: true });
  });
  s.addText('Governance is just knowing whose decision it was — a named human answerable at each step.', {
    x: 0.5, y: 4.9, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So mechanically, act one turns into a relationship. You write the contract — Intent, Context, Examples, Acceptance. The AI is the contractor that builds against it. The word APPROVE is your signature; nothing gets built before it. And before a single file lands on disk, you see the diff and you sign again. Underneath there's a three-rung ladder — the model proposes, hooks intercept, Git and CI hold a visible floor — but the point isn't the plumbing. The point is that at every step there's a named human who owns a decision. That's the exact thing that vanished the moment the AI became the peer, and this is where we put it back. Which sets up the next problem.`);
}

// ══════════════════════════ ACT II — TRUST (13–18) ══════════════════════════

// ── 13. ACT II OPENER ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addActOpener(s, 'II', 'Trust Without Measurement',
    'You were asked to trust the AI’s judgment — with no way to see it or measure it.',
    'ADRs 0011 · 0012 · 0013 · 0015 · 0023 · 0047 · 0052');
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Act two. Trust without measurement. We had gates now — but a new problem showed up right behind them. You're told to review the AI's judgment. Fine. But how do you review judgment you can't see, from a peer you have no way to calibrate?`);
}

// ── 14. ACT II FAILURE: REVIEWING BLIND ───────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The failure mode: you were reviewing blind');
  addBullets(s, [
    { text: 'No layer saw spec and code together. ICEA review happened before code; code review happened after. The one comparison that matters had no reviewer in it.' },
    { text: 'Generalist output on specialist artifacts. A security review through a helpful-assistant lens misses what a security engineer would flag instantly.' },
    { text: 'Trust was asserted, not measured. "The AI did a good job" was the whole feedback loop — no way to build or calibrate trust over time.' },
    { text: 'Every task routed to the same model. Spec drafting, quick fixes, and code review — identical routing regardless of what each needed.' },
  ], { y: 1.0, h: 4.0, size: 14 });
  s.addText('The critical window — spec and fresh code, side by side — was empty.', {
    x: 0.6, y: 5.4, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 13, italic: true, color: C.muted,
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`This is the wall that bothered me the most. Think about when review actually happened. The ICEA review happened before any code existed. The code review happened afterwards, once the spec had already faded from everyone's memory. So the single most important comparison — does this code actually match what we agreed — had no one positioned to make it. The window was simply empty. On top of that, a generalist AI was reviewing specialist work; a security problem read through a helpful-assistant lens sails right past. And the entire feedback loop was three words: "the AI did a good job." I was being asked to extend trust with no instrument to measure it — and every task, whether it was spec drafting or a security review, hit the exact same model. That's not trust. That's hope.`);
}

// ── 15. THE CRITIC (three gates) ──────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'A second reviewer who stands where you can’t');
  addAhaBox(s,
    'THE CRITIC  ·  ADR 0012 + ADR 0052',
    '"The critic steps in at the moments intent and output are both fresh — and hands you a real second opinion instead of a blank diff."',
    'Fires at three gates: your intent (ICEA draft), your design (Tech Spec), and the AI’s output (before any file is written). On the code gate it can send work back — twice — before it reaches you. Ephemeral: no ledger, no fingerprint.',
    'ADR 0052',
    { y: 1.0, h: 2.15 }
  );
  addFlowRow(s, [
    { label: 'ICEA draft', },
    { label: 'CRITIC\nicea gate', gate: true },
    { label: 'Tech Spec' },
    { label: 'CRITIC\ntech gate', gate: true },
    { label: 'Code gen' },
    { label: 'CRITIC\ncode gate', gate: true },
    { label: 'Write', out: true },
  ], 3.45);
  s.addText('icea gate → your intent   ·   tech gate → your design   ·   code gate → the AI’s output (controls the write, revise ×2)', {
    x: 0.5, y: 4.25, w: 12.3, h: 0.4, fontFace: MONO, fontSize: 9, color: C.muted, align: 'center',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So we built the one thing that could stand where I couldn't: the critic. I can't be in the room at the instant the AI generates code — but something can, and it can hand me a real second opinion instead of a blank diff. It fires at three moments, each one where intent and output are both fresh: on the ICEA draft, checking my intent; on the tech spec, checking my design against that intent; and on the generated code, before a single file is written. On that last gate it can actually send the work back to be redone — up to twice — before it ever reaches me. So by the time I'm reviewing, it has already survived a skeptic. And then it deliberately gets out of the way: no ledger, no bookkeeping, because its whole job is to sharpen my review, not to become another thing I have to manage.`);
}

// ── 16. TWO AXES: CAPABILITY + ROLE ───────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'When you review, you switch hats. Make the AI do the same.');
  addAhaBox(s,
    'CAPABILITY × ROLE  ·  ADR 0047',
    '"Model tier is a capability axis. Expert personas add the role axis — orthogonal. Same model, completely different reasoning when the lens changes."',
    'A security engineer notices what a helpful assistant sails right past. Constraints: stack-agnostic · governance-subordinate · reasoning-only (never appears in output).',
    'ADR 0047',
    { y: 1.0, h: 2.0 }
  );
  const rows = [
    ['', '[PO] Product Owner', '[TL] Tech Lead', '[SEC] Security Engineer'],
    ['ICEA_MODEL\n(Opus)', 'Is intent clear? What are we NOT building?', 'Does this satisfy architectural constraints?', 'Where does tainted data reach?'],
    ['REVIEW_MODEL\n(Sonnet)', 'Does code match agreed intent?', 'Consistent patterns? Maintainable in 18mo?', 'SQL injection? IDOR? Business-context escalation?'],
  ];
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const x = 0.5 + ci * 3.05;
      const y = 3.25 + ri * 0.85;
      const isHeader = ri === 0 || ci === 0;
      s.addShape(pptx.ShapeType.rect, { x, y, w: 2.98, h: 0.82, fill: { color: isHeader ? C.navy : C.white }, line: { color: isHeader ? C.navy : C.line, pt: 1 } });
      s.addText(cell, { x: x + 0.08, y: y + 0.05, w: 2.85, h: 0.72, fontFace: FONT, fontSize: isHeader ? 10 : 11, bold: isHeader, color: isHeader ? C.white : C.ink, wrap: true, valign: 'middle' });
    });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Here's something good reviewers do without even noticing. You read a change once as a product person — are we even building the right thing — then again as a security person, then again as the poor soul who has to maintain it in eighteen months. You switch hats. A generalist AI doesn't, unless you make it. So we split judgment on two axes: which brain is on the task, and which hat it's wearing. Same model, a completely different read when the lens changes — the security engineer notices exactly what the helpful assistant just missed.`);
}

// ── 17. 13 LENSES ─────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The 13 questions a senior would ask — asked for you');
  const personas = [
    { code: '[PO]', name: 'Priya Nair', q: 'What are we NOT doing, and why?' },
    { code: '[TL]', name: 'Marcus Reid', q: 'Does this satisfy architectural constraints?' },
    { code: '[SE]', name: 'Elena Fischer', q: 'Is this the simplest correct solution?' },
    { code: '[QA]', name: 'Sam Okonkwo', q: 'What breaks this, and can we test it?' },
    { code: '[SEC]', name: 'Dana Ito', q: 'Where does tainted data reach?' },
    { code: '[SA]', name: 'Rafael Mendes', q: 'Does this compose at system level?' },
    { code: '[EA]', name: 'Grace Lin', q: 'What’s the long-term architectural debt?' },
    { code: '[AIA]', name: 'Theo Brandt', q: 'Is AI behavior predictable at the edges?' },
    { code: '[TW]', name: 'Maya Torres', q: 'Will a new dev understand this in 6 months?' },
    { code: '[DPE]', name: 'Igor Volkov', q: 'Does this survive a failing dependency?' },
    { code: '[SAST]', name: 'Wen Li', q: 'What does the taint analysis show?' },
    { code: '[RM]', name: 'Nadia Haddad', q: 'Are we ready to ship? What blocks go-live?' },
    { code: '[DL]', name: 'Tom Grady', q: 'Is the team on track? Where’s delivery risk?' },
  ];
  personas.forEach((p, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.4 + col * 3.12;
    const y = 1.0 + row * 1.5;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.98, h: 1.38, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.09 });
    s.addText(p.code, { x: x + 0.12, y: y + 0.1, w: 2.7, h: 0.25, fontFace: MONO, fontSize: 9, bold: true, color: C.gold });
    s.addText(p.name, { x: x + 0.12, y: y + 0.33, w: 2.7, h: 0.28, fontFace: FONT, fontSize: 12, bold: true, color: C.navy });
    s.addText(p.q, { x: x + 0.12, y: y + 0.62, w: 2.7, h: 0.68, fontFace: FONT, fontSize: 10, italic: true, color: C.muted, wrap: true });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Taken all the way, that's thirteen lenses — the questions your best product owner, tech lead, security engineer, QA, architect, and tech writer would each ask. Nobody can hold thirteen viewpoints in their head on every single review; I certainly can't. So the plugin asks them for you and brings back what each one flagged. It's seniority, distributed — so the quality of a review stops depending on whether one particular person happened to remember the failure modes that morning.`);
}

// ── 18. TRUST PILLARS ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'For you to trust the reviewer, three things must be true');
  const items = [
    { tag: 'SOURCE-FILE CONSENT  ·  ADR 0013', q: '"For a tool the team is supposed to trust, opacity is poison."', body: 'A: announce the file list before reading. B: ask per file — reason + token cost. C: never reads source.', adr: 'ADR 0013' },
    { tag: 'MULTI-MODEL ROUTING  ·  ADR 0023', q: '"Route by task criticality, not by authority."', body: 'Critical judgment → the stronger model; routine work → the faster one. ICEA_MODEL · REVIEW_MODEL · INFRA_MODEL.', adr: 'ADR 0023' },
    { tag: 'BUSINESS-CONTEXT SEVERITY  ·  ADR 0015', q: '"CVSS doesn’t know your domain."', body: 'B1–B7 triggers escalate to Critical: immigration IDs, privileged client data. Context raises severity — never lowers it.', adr: 'ADR 0015' },
  ];
  items.forEach((item, i) => { addAhaBox(s, item.tag, item.q, item.body, item.adr, { y: 1.0 + i * 1.95, h: 1.78 }); });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`But a second opinion is only worth something if you trust the thing giving it — so three things had to be true. One: you can see what it read. Every source file it opens, it declares first, because for a tool you're supposed to trust, opacity is poison. Two: the right brain was on the job — critical judgment routed to the stronger model, routine work to the faster one. And three: it judges risk by your domain, not by a textbook. A "medium" finding that exposes privileged client data is not medium in our world — so business context can escalate a finding, but it can never quietly downgrade one. Get those three right and the second opinion becomes something you'd actually stake your name on.`);
}

// ══════════════════════════ ACT III — CONTINUITY (19–21) ══════════════════════════

// ── 19. ACT III OPENER ────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addActOpener(s, 'III', 'Continuity Between Sessions',
    'Your decisions can’t live in a chat window that closes.',
    'ADRs 0031 · 0032 · 0034 · 0035');
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Act three. Continuity between sessions. We had good gates and a critic we could trust — and then every morning the whole thing started over from zero, because none of it survived the session that created it.`);
}

// ── 20. ACT III FAILURE: DECISIONS DIDN'T SURVIVE ─────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The failure mode: your decisions didn’t survive the session');
  addBullets(s, [
    { text: 'You approved a direction on Monday. Friday’s session had no idea — it might cheerfully recommend the opposite.' },
    { text: 'Your Tech Lead approved a spec by email, but the plugin had already forgotten the context he was approving.' },
    { text: 'Everything you decided lived inside a conversation — and conversations close.' },
    { text: 'For the person now accountable for those decisions, that’s not a memory problem. It’s an ownership problem.' },
  ], { y: 1.0, h: 4.2, size: 14 });
  s.addText('You can’t be answerable for a call the system can’t remember you made.', {
    x: 0.6, y: 5.5, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 13, italic: true, color: C.muted,
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Let me make this one concrete, because it's really an ownership problem dressed up as a memory problem. I'd approve a direction on Monday. Friday's session had no idea it ever happened, and would cheerfully recommend the opposite. My tech lead would approve a spec by email, but the plugin had already forgotten the context he was approving. Everything we decided lived inside a conversation — and conversations close. Now think about that from where you're standing: you are the one accountable for these calls. You cannot be answerable for a decision the system can't even remember you made. That's not an inconvenience — that's the floor falling out from under the whole idea of ownership.`);
}

// ── 21. TRUTH ON DISK + KEYWORD HANDLERS ──────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Move the truth onto disk — then talk to it like a person');
  addAhaBox(s,
    'STATE ON DISK  ·  ADR 0031',
    '"The status line on disk is the single source of truth — not the conversation. APPROVE ADO-1847, typed in Teams three days later, is actioned immediately."',
    'State machine on disk: DRAFT → Approved → In Progress → Complete. REVISE resets to DRAFT and re-blocks the gate.',
    'ADR 0031',
    { y: 1.0, h: 2.0 }
  );
  addAhaBox(s,
    'KEYWORD HANDLERS  ·  ADR 0032',
    '"Recognised in any message, any channel — no slash command needed."',
    'APPROVE · IMPLEMENT · REVISE · STATUS ADO-{ID}. The ID normalises: "ADO-1847", "ADO #1847", and "1847" all work.',
    'ADR 0032',
    { y: 3.2, h: 1.9 }
  );
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`The fix turned out to be almost boring, and that's exactly why I trust it. We moved the source of truth off the conversation and onto disk. Your approval is a recorded state now, not a message in a thread, so closing the session resets nothing. And you drive it in plain language, from wherever you already are — you type "APPROVE ADO-1847" in Teams, on your phone, three days later, and it's actioned; "ADO-1847," "ADO #1847," or just "1847," they all resolve. You speak, in whatever channel you're in; the workflow remembers, on disk. Now — that's one kind of continuity. There's a second kind, and it's the part I'm most proud of.`);
}

// ══════════════════════════ DREAM INTERLUDE (22–26) ══════════════════════════

// ── 22. DREAM INTERLUDE TITLE ─────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addInterludeOpener(s, 'INTERLUDE · DREAM',
    'Memory that consolidates like sleep',
    'The AI remembers. But memory you can’t see or correct isn’t an asset — it’s a liability.',
    'ADR 0007');
  s.addShape(pptx.ShapeType.ellipse, { x: 11.4, y: 0.7, w: 1.0, h: 1.0, fill: { color: 'a78bfa', transparency: 55 }, line: { type: 'none' } });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`I'm going to pause the five acts for a moment, because this next piece deserves its own spotlight. There's a second kind of memory — not one ticket's state, but everything the team learns over time — and it turned out to be the most interesting thing we built. Here's the catch, though: memory you can't see or correct isn't an asset. It's a liability. This is Dream.`);
}

// ── 23. MEMORY WITHOUT DISCIPLINE ─────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The problem: memory without discipline');
  s.addText('You told the AI last week: we use pnpm, we migrated to Vitest. This week it suggests npm and Jest. Not because it got dumber — unmanaged memory rots.', {
    x: 0.6, y: 0.95, w: 12.1, h: 0.7, fontFace: FONT, fontSize: 14, color: C.muted, wrap: true, italic: true,
  });
  const lines = [
    'use npm install',
    'use pnpm            ← corrected s.12',
    'use Jest for tests',
    'use Vitest for tests  ← conflict',
    'deploy to staging today   ← stale',
    'avoid axios interceptors',
    '… 200+ more lines …',
  ];
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.85, w: 7.6, h: 4.4, fill: { color: '0d1f35' }, line: { color: '2c5f8a', pt: 1 }, rectRadius: 0.08 });
  s.addText('MEMORY.md  — unmanaged, grows every session', { x: 0.8, y: 1.98, w: 7.2, h: 0.3, fontFace: MONO, fontSize: 9, bold: true, color: '8fb0d0' });
  s.addText(lines.map(t => ({ text: t, options: {} })), { x: 0.85, y: 2.35, w: 7.1, h: 2.7, fontFace: MONO, fontSize: 11, color: 'cdd9e6', valign: 'top', paraSpaceAfter: 5 });
  s.addShape(pptx.ShapeType.line, { x: 0.8, y: 5.15, w: 7.2, h: 0, line: { color: 'e17055', pt: 1.5, dashType: 'dash' } });
  s.addText('200-line cutoff — Claude can’t see below here', { x: 0.85, y: 5.2, w: 7.1, h: 0.3, fontFace: MONO, fontSize: 8.5, color: 'e17055' });

  addBullets(s, [
    'It grows every session',
    'It starts contradicting itself',
    'Past ~200 lines, the bottom is invisible',
    'Worse signal than having no memory at all',
  ], { x: 8.5, y: 2.3, w: 4.3, h: 3.5, size: 13 });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Let me show you the failure first, because you've almost certainly felt it. You tell the AI on Monday: we use pnpm, we've migrated to Vitest. By Friday it's confidently suggesting npm and Jest again. Not because it got dumber — because unmanaged memory rots. It grows every single session. It starts contradicting itself: pnpm versus npm, Jest versus Vitest, both sitting there as if both are true. Stale notes pile up — "deploy to staging today," written weeks ago. And past a couple hundred lines, the model literally cannot see the bottom of the file. At that point your memory isn't neutral, it's harmful — it's feeding the AI wrong signal with total confidence. A bad memory is genuinely worse than no memory at all.`);
}

// ── 24. SLEEP CYCLE + SIX PHASES ──────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Dream: give memory a sleep cycle');
  addAhaBox(s,
    'CONSOLIDATION LIKE SLEEP  ·  ADR 0007',
    '"We needed something like REM sleep — periodic consolidation that keeps what proved true, prunes what’s stale, and strengthens the patterns worth keeping."',
    'Runs every 5–8 sessions. You review before anything is written.',
    'ADR 0007',
    { y: 1.0, h: 1.75 }
  );
  addFlowRow(s, [
    { label: '01\nInventory' },
    { label: '02\nScore' },
    { label: '03\nPropose' },
    { label: '04\nReview', gate: true },
    { label: '05\nApply' },
    { label: '06\nLog', out: true },
  ], 3.2);
  s.addText('read all files & map knowledge  ·  confidence 0.0–1.0  ·  ADD/UPDATE/DELETE/PROMOTE  ·  hard stop: you decide  ·  safe order  ·  append-only audit trail', {
    x: 0.5, y: 4.05, w: 12.3, h: 0.5, fontFace: FONT, fontSize: 10, color: C.muted, align: 'center', wrap: true,
  });
  s.addText('DREAM · MEMORY CONSOLIDATION · LIKE REM SLEEP FOR YOUR CODEBASE', {
    x: 0.5, y: 4.7, w: 12.3, h: 0.3, fontFace: MONO, fontSize: 8, color: C.muted, align: 'center', charSpacing: 1,
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So we gave memory something like sleep — and I mean that as the actual design, not a cute metaphor. Every five to eight sessions, Dream does what your brain does overnight: it keeps what proved true, prunes what's stale, and strengthens the patterns worth keeping. Six phases — it takes inventory of what's there, scores each fact's confidence, proposes changes, stops for your review, applies them in a safe order, and logs everything it did. It runs periodically, and — this matters — it never writes a single thing without showing you first.`);
}

// ── 25. LIFE OF A MEMORY (capture + decay) ────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The life of a memory: captured automatically, fades on its own');
  s.addText('BORN — auto-captured at 5 natural moments (no “remember that”)', { x: 0.5, y: 1.0, w: 12.3, h: 0.3, fontFace: MONO, fontSize: 9, bold: true, color: C.gold, charSpacing: 1 });
  const triggers = ['plan approved', 'task done', 'error fixed', 'approach abandoned', 'arch decision'];
  triggers.forEach((t, i) => {
    const x = 0.5 + i * 2.5;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.4, w: 2.35, h: 0.7, fill: { color: 'EAF4FF' }, line: { color: '74b9ff', pt: 1.2 }, rectRadius: 0.35 });
    s.addText(t, { x, y: 1.4, w: 2.35, h: 0.7, fontFace: FONT, fontSize: 11, bold: true, color: C.navy, align: 'center', valign: 'middle' });
  });
  s.addText('FADES — every cycle unused, confidence drops 0.1 → auto-delete', { x: 0.5, y: 2.5, w: 12.3, h: 0.3, fontFace: MONO, fontSize: 9, bold: true, color: C.red, charSpacing: 1 });
  const decay = [{ s: 'S3', v: 0.70 }, { s: 'S5', v: 0.60 }, { s: 'S8', v: 0.50 }, { s: 'S12', v: 0.30 }, { s: 'S16', v: 0.10 }];
  const baseY = 5.9, unit = 3.0;
  decay.forEach((d, i) => {
    const x = 1.2 + i * 1.5;
    const h = d.v * unit;
    const col = d.v <= 0.2 ? 'e17055' : d.v <= 0.4 ? 'fdcb6e' : '00b894';
    s.addShape(pptx.ShapeType.rect, { x, y: baseY - h, w: 1.0, h, fill: { color: col, transparency: 15 }, line: { color: col } });
    s.addText(d.v.toFixed(2), { x: x - 0.1, y: baseY - h - 0.28, w: 1.2, h: 0.25, fontFace: MONO, fontSize: 9, color: C.ink, align: 'center' });
    s.addText(d.s, { x: x - 0.1, y: baseY + 0.05, w: 1.2, h: 0.25, fontFace: MONO, fontSize: 9, color: C.muted, align: 'center' });
  });
  s.addText('AUTO-DELETE\nscore ≤ 0.2', { x: 9.2, y: 4.3, w: 3.4, h: 0.8, fontFace: FONT, fontSize: 12, bold: true, color: 'e17055', align: 'center', valign: 'middle' });
  s.addText('"deploy to staging today" — written in session 3, gone by session 16. Nobody had to hunt it down.', { x: 0.5, y: 6.4, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Let me walk you through the whole life of a single fact, because this is the part I'm proudest of. It's born automatically — you never type "remember this." At five natural moments in your work — a plan approved, a task finished, an error fixed, an approach abandoned, an architecture decision made — the important "why" gets captured while it's still fresh. Then it has to earn its keep. Every fact carries a confidence score, and every cycle it isn't used, it loses a tenth of a point. So "deploy to staging today," written in session three, quietly fades — 0.7, 0.6, 0.5 — until it drops below the line and deletes itself around session sixteen. Nobody went hunting for it. Born automatically, retired automatically. You don't feed it and you don't weed it — it curates itself.`);
}

// ── 26. TIERS + ROLLBACK ──────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'You approve your project’s memory: tiers + rollback');
  const tiers = [
    { tag: 'TIER 1 · AUTO-APPLY', title: 'Trivial, applied silently', body: 'KEEP, timestamps, minor edits, new-topic adds at high confidence. Reported in aggregate.', col: '00b894' },
    { tag: 'TIER 2 · SHOW DIFF', title: 'You see a before/after', body: 'Content changes, merges, borderline deletes. Approve / skip / apply-all.', col: C.gold },
    { tag: 'TIER 3 · ALWAYS HUMAN', title: 'Explicit yes / no', body: 'PROMOTE or DEMOTE to CLAUDE.md, low-confidence deletes, any conflict. No matter the score.', col: 'e17055' },
  ];
  tiers.forEach((t, i) => {
    const x = 0.5 + i * 4.1;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.95, h: 2.5, fill: { color: C.white }, line: { color: t.col, pt: 1.5 }, rectRadius: 0.1 });
    s.addText(t.tag, { x: x + 0.15, y: 1.22, w: 3.65, h: 0.25, fontFace: MONO, fontSize: 8.5, bold: true, color: t.col, charSpacing: 1 });
    s.addText(t.title, { x: x + 0.15, y: 1.5, w: 3.65, h: 0.5, fontFace: FONT, fontSize: 13, bold: true, color: C.navy, wrap: true });
    s.addText(t.body, { x: x + 0.15, y: 2.05, w: 3.65, h: 1.4, fontFace: FONT, fontSize: 11, color: C.muted, wrap: true });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 3.9, w: 12.4, h: 1.35, fill: { color: 'FDFCF5' }, line: { color: C.gold, pt: 1 }, rectRadius: 0.1 });
  s.addText('CLAUDE.md is the hard boundary — PROMOTE / DEMOTE always need your eyes. Every run is logged with its reasoning and sources; any run can be rolled back  ↩', {
    x: 0.75, y: 4.05, w: 12.0, h: 1.05, fontFace: FONT, fontSize: 13, color: C.navy, wrap: true, valign: 'middle',
  });
  s.addText('It’s your project’s memory. You sign off on what it remembers.', { x: 0.5, y: 5.45, w: 12.4, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`And here's the part that makes it safe to trust: you are never not in control. Dream sorts every change into three tiers. Trivial things apply silently. Content changes show you a before-and-after and wait. And anything that touches your always-loaded CLAUDE.md — promoting a fact to permanent, or demoting one out of it — always stops for an explicit yes or no, no matter how high the confidence score is. Every run is written to an append-only log with its reasoning and its sources, and any run can be rolled back. That's the whole point: it's your project's memory, and you sign off on what it's allowed to remember. If you want the full mechanics, there's a nineteen-slide deep-dive deck just on Dream. Now — back to the acts.`);
}

// ══════════════════════════ ACT IV — KNOWLEDGE (27–33) ══════════════════════════

// ── 27. ACT IV OPENER ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addActOpener(s, 'IV', 'Structured Knowledge of the Codebase',
    'You can’t review a change you can’t place in the whole system.',
    'ADRs 0016 · 0017→0038 · 0039 · 0041 · 0042 · 0043 · 0050');
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Act four. Structured knowledge of the codebase. This is the biggest act, because it's the thing your new role leans on the hardest: you cannot review a change well if you can't place it inside the whole system.`);
}

// ── 28. TWO DEVELOPERS ────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Two developers, one difference');
  const devs = [
    { tag: 'DEV A', t: 'Understands the system', pts: ['Same bug — found in 20 minutes', 'Clean fix, never comes back', 'Carries a model of how it all fits'], col: '00b894', fill: 'EEFAF6' },
    { tag: 'DEV B', t: 'Reading cold, file by file', pts: ['Same bug — two days', 'Patches the symptom, breaks something else', 'Hoping to find the thread'], col: 'e17055', fill: 'FFF0ED' },
  ];
  devs.forEach((d, i) => {
    const x = 0.6 + i * 6.15;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 5.95, h: 3.4, fill: { color: d.fill }, line: { color: d.col, pt: 1.5 }, rectRadius: 0.1 });
    s.addText(d.tag, { x: x + 0.25, y: 1.25, w: 5.5, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: d.col, charSpacing: 1 });
    s.addText(d.t, { x: x + 0.25, y: 1.55, w: 5.5, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: C.navy });
    s.addText(d.pts.map(t => ({ text: t, options: { bullet: { type: 'bullet' } } })), { x: x + 0.3, y: 2.15, w: 5.4, h: 2.2, fontFace: FONT, fontSize: 13, color: C.ink, wrap: true, valign: 'top', paraSpaceAfter: 8 });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 4.75, w: 12.1, h: 1.4, fill: { color: '0d1f35' }, line: { color: '2c5f8a', pt: 1 }, rectRadius: 0.1 });
  s.addText('The differentiator was never talent. It was understanding.\nYour AI — and any reviewer without the map — is Dev B, until you give it one.', {
    x: 0.85, y: 4.85, w: 11.6, h: 1.2, fontFace: FONT, fontSize: 15, bold: true, color: 'eef4fb', wrap: true, valign: 'middle',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Let me start with two developers you already know. Same team, same bug handed to both. The first finds it in twenty minutes, fixes it cleanly, and it never comes back. The second spends two days, patches the symptom, and quietly breaks something else. Same seniority, same intelligence — so what's the difference? It isn't talent. The first developer understands the system. They carry a model of how the whole thing fits together, so a change is just a small edit to a structure they already know. The second is reading code cold, one file at a time, hoping to find the thread. Now here's the uncomfortable part, and it's the whole reason this act exists: your AI is that second developer. Fast, confident, and completely without a model of your system — unless you give it one. And honestly, so are you, the first time you open an unfamiliar codebase. This act is about turning both of you into the first developer.`);
}

// ── 29. READS COLD EVERY TIME ─────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, '…and the AI reads cold, every single time');
  s.addText('A token analysis three months in proved it: the AI treated every run as a cold start — code review re-scanning 50 files when 48 hadn’t changed in a week. Reading cold, file by file, exactly like Dev B.', {
    x: 0.5, y: 0.95, w: 12.3, h: 0.75, fontFace: FONT, fontSize: 13, color: C.muted, wrap: true,
  });
  s.addText('BEFORE — COLD START EVERY RUN', { x: 0.5, y: 1.85, w: 5.9, h: 0.25, fontFace: MONO, fontSize: 8, bold: true, color: C.red, align: 'center', charSpacing: 1 });
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  days.forEach((d, i) => {
    s.addShape(pptx.ShapeType.rect, { x: 0.6 + i * 1.05, y: 2.15, w: 0.85, h: 3.0, fill: { color: 'e84c1e', transparency: 20 }, line: { color: 'e84c1e' } });
    s.addText('50 files', { x: 0.6 + i * 1.05, y: 3.2, w: 0.85, h: 0.3, fontFace: MONO, fontSize: 7.5, color: C.white, align: 'center' });
    s.addText(d, { x: 0.6 + i * 1.05, y: 5.2, w: 0.85, h: 0.25, fontFace: MONO, fontSize: 8, color: C.muted, align: 'center' });
  });
  s.addShape(pptx.ShapeType.line, { x: 6.0, y: 1.8, w: 0, h: 3.8, line: { color: 'dddddd', pt: 1.5, dashType: 'dash' } });
  s.addText('AFTER — INCREMENTAL DIFF ONLY', { x: 6.2, y: 1.85, w: 6.3, h: 0.25, fontFace: MONO, fontSize: 8, bold: true, color: C.green, align: 'center', charSpacing: 1 });
  s.addShape(pptx.ShapeType.rect, { x: 6.3, y: 2.15, w: 0.85, h: 3.0, fill: { color: '10b981', transparency: 15 }, line: { color: '10b981' } });
  s.addText('50 files\nbaseline', { x: 6.3, y: 3.0, w: 0.85, h: 0.6, fontFace: MONO, fontSize: 7, color: C.white, align: 'center', wrap: true });
  s.addText('Mon', { x: 6.3, y: 5.2, w: 0.85, h: 0.25, fontFace: MONO, fontSize: 8, color: C.muted, align: 'center' });
  const afterDays = [{ d: 'Tue', f: '2 files', h: 0.5 }, { d: 'Wed', f: '3 files', h: 0.7 }, { d: 'Thu', f: '1 file', h: 0.35 }, { d: 'Fri', f: '2 files', h: 0.55 }];
  afterDays.forEach((ad, i) => {
    s.addShape(pptx.ShapeType.rect, { x: 7.35 + i * 1.05, y: 5.15 - ad.h, w: 0.85, h: ad.h, fill: { color: '10b981', transparency: 30 }, line: { color: '10b981' } });
    s.addText(ad.f, { x: 7.35 + i * 1.05, y: 5.15 - ad.h - 0.22, w: 0.85, h: 0.22, fontFace: MONO, fontSize: 7, color: C.muted, align: 'center' });
    s.addText(ad.d, { x: 7.35 + i * 1.05, y: 5.2, w: 0.85, h: 0.25, fontFace: MONO, fontSize: 8, color: C.muted, align: 'center' });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 7.35, y: 2.15, w: 4.6, h: 1.6, fill: { color: 'EDFAF5' }, line: { color: '10b981', pt: 1 }, rectRadius: 0.1 });
  s.addText('80–95%', { x: 7.35, y: 2.3, w: 4.6, h: 0.9, fontFace: 'Georgia', fontSize: 36, bold: true, color: C.green, align: 'center' });
  s.addText('token savings after first run', { x: 7.35, y: 3.15, w: 4.6, h: 0.35, fontFace: MONO, fontSize: 9, color: C.muted, align: 'center' });
  s.addText('This is Dev B’s morning — every morning. Re-reading raw text is not understanding.', { x: 0.5, y: 5.7, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`And I could prove the AI was that second developer. Three months in, we ran a token analysis, and the number was ugly: it was treating every single run as a cold start, re-scanning fifty files when forty-eight of them hadn't changed in a week. Reading cold, file by file, exactly like the developer who struggles. Cache-aware scanning fixed the cost — eighty to ninety-five percent off after the first run. But the deeper lesson is the one that matters here: re-reading raw text was never going to make it, or you, the developer who understands the system. For that you need a model — not a bigger pile of text.`);
}

// ── 30. THE GRAPH (on-disk tree + legend) ─────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Build the map once — for the machine to traverse');
  s.addText('The knowledge graph is the single place the AI orients from: a machine-readable structure it traverses and searches in milliseconds. The old per-feature domain-map was retired into it (ADR 0038).', {
    x: 0.5, y: 0.95, w: 12.3, h: 0.6, fontFace: FONT, fontSize: 13, color: C.muted, wrap: true,
  });
  const tree =
    '.claude/graph/\n' +
    '├─ graph.json      structure of record: typed nodes +\n' +
    '│                 edges (confidence), fingerprints. committed.\n' +
    '├─ graph-index.md  always-loaded map — 1 row/module.\n' +
    '│                 paths: always   ( < 350 tokens )\n' +
    '├─ orders.md   ┐   per-module detail (200–400 tokens):\n' +
    '├─ payments.md ┤   purpose, key files, deps, fingerprint;\n' +
    '├─ auth.md     ┘   auto-loads via  paths: src/<Module>/**\n' +
    '├─ .stale          refresh flag — cleared by /graph-sync\n' +
    '└─ graph.html      offline map from /graph-viz (gitignored)';
  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.7, w: 8.3, h: 3.7, fill: { color: '0d1f35' }, line: { color: '2c5f8a', pt: 1 }, rectRadius: 0.08 });
  s.addText(tree, { x: 0.7, y: 1.85, w: 8.0, h: 3.4, fontFace: MONO, fontSize: 9.5, color: 'cdd9e6', valign: 'top', lineSpacingMultiple: 1.05 });

  s.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 1.7, w: 3.8, h: 3.7, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.08 });
  s.addText('EDGE CONFIDENCE', { x: 9.2, y: 1.85, w: 3.4, h: 0.3, fontFace: MONO, fontSize: 8.5, bold: true, color: C.gold, charSpacing: 1 });
  const conf = [
    { t: 'EXTRACTED', d: 'mechanically known', col: '00b894' },
    { t: 'INFERRED', d: 'model judgment', col: C.gold },
    { t: 'AMBIGUOUS', d: 'needs a human', col: 'e17055' },
  ];
  conf.forEach((c, i) => {
    const y = 2.3 + i * 0.7;
    s.addShape(pptx.ShapeType.ellipse, { x: 9.25, y: y + 0.05, w: 0.22, h: 0.22, fill: { color: c.col }, line: { color: c.col } });
    s.addText(c.t, { x: 9.6, y, w: 3.0, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: C.navy });
    s.addText(c.d, { x: 9.6, y: y + 0.28, w: 3.0, h: 0.25, fontFace: FONT, fontSize: 10, color: C.muted });
  });
  s.addText('/graph-viz renders it as an offline map — hubs ringed gold, stale nodes red.', { x: 9.2, y: 4.5, w: 3.5, h: 0.8, fontFace: FONT, fontSize: 10, italic: true, color: C.muted, wrap: true });
  s.addText('Committed & PR-reviewed — shared across the team, reviewed like source.', { x: 0.5, y: 5.55, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So we build the map once, and we keep it current. It's a knowledge graph, and it's the map the machine reads: what depends on what, which modules are the hubs, what's gone stale — traversed and searched in milliseconds, one read instead of a hundred. On disk it's three things: a lean index that's always loaded, per-module detail files that only load when you're actually working in that area, and a graph.json underneath that is the real source of truth. And every relationship carries a confidence level — extracted means a parser knows it for a fact, inferred means the model judged it, ambiguous means a human should look. So the map doesn't just tell you the shape of the system; it tells you how much to trust each line on it. This retired the old per-feature domain-map entirely.`);
}

// ── 31. DETERMINISTIC EDGES ───────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'What a parser can know, a parser should know');
  addAhaBox(s,
    'DETERMINISTIC EDGES  ·  ADR 0041',
    '"The part of the map a machine can know for certain — which file imports which — is computed by a parser, not guessed by a model. Same code in, same graph out."',
    'extract-edges.js resolves imports / usings / requires — offline, zero API cost. Supports JS/TS · Python · C# · Java. Model judgment reserved for genuinely ambiguous edges.',
    'ADR 0041',
    { y: 1.0, h: 2.0 }
  );
  addBeforeAfter(s,
    ['Non-deterministic — same file, different edges across runs', 'Token-expensive — a model call per module', 'Approximate — may miss transitive or multi-file imports'],
    ['Deterministic — identical output for identical input', 'Free — Node stdlib only, zero tokens, fully offline', 'Accurate — resolves the real import graph per language'],
    { y: 3.25, h: 3.1 }
  );
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`There's a principle underneath that graph that I care about a lot. The part a machine can know for certain — which file imports which — should be computed by a parser, not guessed by a language model. So we extract the import graph deterministically: same code in, same graph out, every time, for free, completely offline. The model's judgment is reserved only for the genuinely ambiguous relationships a parser can't resolve. Before, the graph was non-deterministic, token-expensive, and approximate — the same file could produce different edges on different runs. After, it's identical every time, free, and accurate. What a parser can know, a parser should know.`);
}

// ── 32. THE 8 ARCHITECTURE DOCS ───────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The other half: docs that answer an architect’s questions');
  s.addText('Graph = structure (for the machine).  Architecture docs = understanding (for the human) — built from your target application. The set grew 4 → 8 (ADR 0050).', {
    x: 0.5, y: 0.95, w: 12.3, h: 0.5, fontFace: FONT, fontSize: 13, italic: true, color: C.muted, wrap: true,
  });
  const docs = [
    ['architecture.md', 'What’s the shape? (overview + Mermaid diagrams)', false],
    ['architecture-callchains.md', 'How does a request flow through the layers?', false],
    ['architecture-data.md', 'What is the data? (entities, relationships, ownership)', true],
    ['architecture-integrations.md', 'Who do we depend on — and what happens when they fail?', true],
    ['architecture-security.md', 'Who’s allowed to do what? (Action → Role → Enforced-at)', true],
    ['architecture-decisions.md', 'Why did we build it this way? (AD-NNN log)', true],
    ['architecture-deployment.md', 'How and where does it run? (+ non-functional envelope)', false],
    ['architecture-reference.md', 'What are the conventions?', false],
  ];
  docs.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 6.2, y = 1.55 + row * 1.15;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 6.0, h: 1.02, fill: { color: d[2] ? 'FDFCF5' : C.white }, line: { color: d[2] ? C.gold : C.line, pt: 1 }, rectRadius: 0.08 });
    s.addText([{ text: d[0], options: { fontFace: MONO, fontSize: 11, bold: true, color: C.navy } }, ...(d[2] ? [{ text: '  ★ new', options: { fontFace: MONO, fontSize: 9, color: C.gold } }] : [])], { x: x + 0.15, y: y + 0.1, w: 5.7, h: 0.3, valign: 'middle' });
    s.addText(d[1], { x: x + 0.15, y: y + 0.42, w: 5.7, h: 0.55, fontFace: FONT, fontSize: 11, color: C.muted, wrap: true, valign: 'top' });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Now, the graph tells you what connects to what. But that's not actually the question you ask when you put on the architect hat. You ask: what is the data? Who do we depend on, and what happens when they fall over? Who's allowed to do what? And why did we build it this way in the first place? So the graph is only half the knowledge system. The other half is the architecture documents — and unlike the graph, these are written for a human to read, and they're generated from your actual application. We grew the set from four documents to eight, and the four new ones each answer a real architect's question: the data model, the integrations and how they fail, the security and authorization model, and the decision log — the why.`);
}

// ── 33. DOCS YOU CAN TRUST ────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Documents you can actually trust');
  addBeforeAfter(s,
    ['✅ Extracted from code — fill only what the code proves', '⚠ Flagged “needs manual input” — authz rules, SLAs, retry policy, decision rationale', 'Never invents the parts a human must own'],
    ['Committed & PR-reviewed — like source', 'Mermaid diagrams render right in the pull request', 'Read on every run by: security · icea-feature · icea-review · app-readiness'],
    { y: 1.2, h: 3.6, beforeLabel: 'HOW THEY’RE WRITTEN', afterLabel: 'HOW THEY STAY ALIVE' }
  );
  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 5.0, w: 12.4, h: 1.2, fill: { color: 'FDFCF5' }, line: { color: C.gold, pt: 1 }, rectRadius: 0.1 });
  s.addText('And notice architecture-decisions.md — the “why,” written down — is the same principle this whole talk is built on.', {
    x: 0.75, y: 5.1, w: 12.0, h: 1.0, fontFace: FONT, fontSize: 13, italic: true, color: C.navy, wrap: true, valign: 'middle',
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Two things make these documents worth relying on instead of rotting on a shelf. First, how they're written: the AI fills in only what the code actually proves, and everything it can't verify — an authorization rule, an SLA, a retry policy, the rationale behind a decision — it flags as "needs manual input" rather than inventing it. It never makes up the parts a human has to own. Second, they don't go stale, because they aren't decoration: they're committed and pull-request-reviewed like source, their diagrams render right inside the PR, and four different skills read them on every run — security, ICEA planning, reviews, readiness. A document that's actually consumed stays honest. And notice that decision log — the why, written down — because that is the exact principle this whole talk is built on.`);
}

// ══════════════════════════ GUARDRAILS INTERLUDE (34–35) ══════════════════════════

// ── 34. GUARDRAILS: OPENER ────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addInterludeOpener(s, 'INTERLUDE · GUARDRAILS', 'Your conventions live in the system', 'Identical AI behavior — every developer, every session, no matter who’s driving.', null);
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Quick detour between acts, because I keep saying the AI "behaves" — and behavior doesn't happen by accident. This one is about consistency: the AI acting the same way for every developer, every session, regardless of who's driving. Because you are not the only person managing this AI, and it cannot be allowed to drift into a different personality for each of us.`);
}

// ── 35. GUARDRAILS: LAYERS + PROBABILISTIC/DETERMINISTIC ──────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Guidance that flexes, guardrails that don’t');
  addCardRow(s, [
    { tag: 'ALWAYS-ON', title: 'CLAUDE.md system prompt', body: 'Loaded every session. Write gate, feature gate, "Dapper + parameterised SQL, never EF Core", commit & branch format. Applies everywhere.' },
    { tag: 'PER FILE-TYPE', title: '43 scoped rule files', body: '*.cs → C#/.NET/data-access · *.tsx → React/hooks · middleware/** → api-security. Load only when a matching file is touched — zero cost otherwise.' },
    { tag: 'DETERMINISTIC', title: 'Hooks intercept the call', body: 'System prompts & rules instruct the model (probabilistic). Hooks intercept the tool call itself — Layer B from Act I’s ladder. It doesn’t negotiate.' },
  ], { y: 1.2, h: 3.0 });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 4.5, w: 12.4, h: 1.5, fill: { color: 'F4F7FA' }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
  s.addText('Probabilistic guidance everywhere  ·  deterministic guardrails exactly where the risk is real', { x: 0.75, y: 4.62, w: 12.0, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.navy });
  s.addText('The skills and commands carry hard rules too, and the source-file consent model gates what the AI is even allowed to read.', { x: 0.75, y: 5.05, w: 12.0, h: 0.85, fontFace: FONT, fontSize: 12, color: C.muted, wrap: true });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Two layers keep it on the rails, and you don't have to police either one. The first is the always-on system prompt — CLAUDE.md, loaded every session — carrying the rules that apply everywhere: the write gate, "Dapper with parameterised SQL, never EF Core," the commit and branch format. The second is forty-three scoped rule files, each of which only wakes up when you touch a matching file: open a C# file and the .NET and data-access rules appear, open a React component and the React rules appear, and they cost nothing the rest of the time. And there's a real difference in how these bind — a prompt instructs the model, which is flexible but ultimately a suggestion; a hook intercepts the actual tool call, mechanically, and it does not negotiate. Flexible guidance everywhere, hard guardrails exactly where the risk is real. Which brings us to the final act.`);
}

// ══════════════════════════ ACT V — OBSERVABILITY (36–40) ══════════════════════════

// ── 36. ACT V OPENER ──────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addActOpener(s, 'V', 'Observability — Proof, Not Trust',
    'You’re accountable for what ships. “The AI said it’s fine” isn’t evidence.',
    'ADRs 0004 · 0014 · 0015 · 0019 · 0020 · 0045');
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Act five, the last one. Observability. And notice I did not call it enforcement — we already did enforcement, back in act one with the gate and just now with the guardrails. This act is about something else entirely. You are accountable for what ships, and "the AI said it's fine" is not evidence.`);
}

// ── 37. ACT V FAILURE: ZERO OBSERVABILITY ─────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The failure mode: zero observability on the AI’s decisions');
  addBullets(s, [
    { text: 'No audit trail of what the AI actually generated — and whether it was right.' },
    { text: 'No line you could draw from a requirement to the code that satisfies it.' },
    { text: 'No evidence that what shipped matched what was agreed.' },
    { text: 'When a finding was waved off, the reason went with it.' },
  ], { y: 1.0, h: 3.6, size: 14 });
  const q = ['what did it generate?', 'does it match what we agreed?', 'what did we choose to ignore?'];
  q.forEach((t, i) => {
    const x = 0.5 + i * 4.15;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 4.7, w: 4.0, h: 1.1, fill: { color: 'FFF0ED' }, line: { color: 'F3B4A8', pt: 1 }, rectRadius: 0.1 });
    s.addText('?', { x: x + 0.15, y: 4.8, w: 0.6, h: 0.9, fontFace: 'Georgia', fontSize: 34, bold: true, color: 'e17055' });
    s.addText(t, { x: x + 0.85, y: 4.8, w: 3.0, h: 0.9, fontFace: FONT, fontSize: 12, bold: true, color: C.navy, wrap: true, valign: 'middle' });
  });
  s.addText('Accountable — with trust as the only instrument. Trust doesn’t survive an audit.', { x: 0.5, y: 6.0, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 13, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Here's the last wall, and it's the one an auditor would walk straight into. For everything we'd built, one question still had no answer: what did the AI actually do, and can you prove it was right? There was no trail of its decisions. There was no line you could draw from a requirement to the code that satisfies it. There was no evidence that what shipped matched what we agreed. And when somebody decided a finding didn't matter and waved it off, the reason went with them — just gone. So there I was, accountable for the quality of everything that shipped, with trust as my only instrument. And trust, as we'd already learned the hard way, does not survive an audit.`);
}

// ── 38. TRACEABILITY ──────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Traceability: from a requirement to the shipped line');
  s.addText('Can you prove you built what you agreed — and only that? Every Acceptance Criterion maps forward.', {
    x: 0.5, y: 0.95, w: 12.3, h: 0.45, fontFace: FONT, fontSize: 14, italic: true, color: C.muted, wrap: true,
  });
  addFlowRow(s, [
    { label: 'ICEA\nAcceptance Criterion' },
    { label: 'ADO\ntask' },
    { label: 'changed\nfile' },
    { label: 'the exact\nline', out: true },
  ], 1.9);
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 3.1, w: 6.0, h: 2.5, fill: { color: 'EEFAF6' }, line: { color: '00b894', pt: 1.5 }, rectRadius: 0.1 });
  s.addText('✅ TRACED', { x: 0.85, y: 3.25, w: 5.5, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: C.green, charSpacing: 1 });
  s.addText('This AC → satisfied here. The compliance report draws the line for you.', { x: 0.85, y: 3.6, w: 5.5, h: 1.8, fontFace: FONT, fontSize: 13, color: C.ink, wrap: true, valign: 'top' });
  s.addShape(pptx.ShapeType.roundRect, { x: 6.85, y: 3.1, w: 6.0, h: 2.5, fill: { color: 'FFF0ED' }, line: { color: 'e17055', pt: 1.5 }, rectRadius: 0.1 });
  s.addText('❌ SCOPE CREEP', { x: 7.1, y: 3.25, w: 5.5, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: 'e17055', charSpacing: 1 });
  s.addText('This file traces to no AC — flagged. Something got built that nobody agreed to.', { x: 7.1, y: 3.6, w: 5.5, h: 1.8, fontFace: FONT, fontSize: 13, color: C.ink, wrap: true, valign: 'top' });
  s.addText('“Did we build what we agreed, and only what we agreed?” — a matter of evidence, not opinion.', { x: 0.5, y: 5.85, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So we started with the biggest question of all: can you prove you built what you agreed to — and only what you agreed to? Every acceptance criterion in the ICEA now maps forward: to the tasks, to the changed files, all the way down to the exact lines that implement it. The PR compliance report draws that line for you — this criterion, satisfied right here. And it works in reverse too, which is the part reviewers love: if a file changes behavior that traces back to no criterion at all, that's scope creep, and it gets flagged. So "did we build what we agreed, and nothing we didn't?" stops being a matter of opinion in a review meeting and becomes a matter of evidence.`);
}

// ── 39. FINDING LEDGERS (+ three passes) ──────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Every finding has a life you can audit');
  addAhaBox(s,
    'PERSISTENT LEDGERS  ·  ADR 0014',
    '"A dismissal is a claim about specific code — so the moment that code changes, the finding re-opens automatically. You can’t bury it by dismissing it once."',
    'One schema across three ledgers: Open · Fixed (who/when/git ref) · Dismissed (reason + justification) · Baseline (never gates). /fix FP-xxxxxxxx works across all three.',
    'ADR 0014',
    { y: 1.0, h: 2.0 }
  );
  addCardRow(s, [
    { tag: 'code-review', title: 'code-review-ledger.md', body: 'Static analysis findings, FP-fingerprinted. Cache-aware rescan.' },
    { tag: 'security', title: 'security-ledger.md', body: 'OWASP/CWE/CVSS with B1–B7 business-context escalation.' },
    { tag: 'dynamic-scan', title: 'dynamic-scan-ledger.md', body: 'DAST runtime findings. Same schema, same /fix flow.' },
  ], { y: 3.2, h: 1.85 });
  s.addText('How findings get produced:  PHASE D (parsers, zero-token)  →  PHASE P (model judgment)  →  ARCHITECTURAL (hypotheses, evidence, ≤7)   ·  ADR 0019 + 0045', {
    x: 0.5, y: 5.25, w: 12.3, h: 0.5, fontFace: MONO, fontSize: 9, color: C.muted, align: 'center', wrap: true,
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Then the findings. Every one gets a fingerprint and a permanent home — a ledger, with one shared schema across code review, security, and dynamic scanning. A finding is Open; or Fixed, with the actual commit and author that closed it; or Dismissed, with a written reason you can go back and challenge; or Baseline — inherited debt we track but never block you on. And here's my favorite detail: a dismissal is a claim about a specific piece of code, so the instant that code changes, the finding re-opens itself. You cannot quietly bury a problem by dismissing it once. You can even see how each finding was caught — parsers first for what's provable, then model judgment for intent, then a capped architectural pass for the cross-file risks, clearly labelled as hypotheses. Full visibility into every issue, and how it surfaced.`);
}

// ── 40. AGGREGATE VIEW (metrics + health) ─────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The aggregate view: are we actually getting better?');
  s.addText('Observability isn’t only per-finding — it’s the trend. After each sprint, straight from Azure DevOps.', {
    x: 0.5, y: 0.95, w: 12.3, h: 0.45, fontFace: FONT, fontSize: 14, italic: true, color: C.muted, wrap: true,
  });
  const kpis = [
    { n: 'ICEA compliance', d: '↑ rising', col: '00b894' },
    { n: 'PR rejection rate', d: '↓ falling', col: '00b894' },
    { n: 'Rework hours', d: '↓ falling', col: '00b894' },
  ];
  kpis.forEach((k, i) => {
    const x = 0.6 + i * 4.15;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.6, w: 3.95, h: 1.9, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
    s.addShape(pptx.ShapeType.rect, { x, y: 1.6, w: 3.95, h: 0.07, fill: { color: k.col }, line: { color: k.col } });
    s.addText(k.d, { x, y: 1.85, w: 3.95, h: 0.7, fontFace: 'Georgia', fontSize: 28, bold: true, color: k.col, align: 'center' });
    s.addText(k.n, { x: x + 0.15, y: 2.7, w: 3.65, h: 0.6, fontFace: FONT, fontSize: 14, bold: true, color: C.navy, align: 'center', wrap: true });
  });
  s.addText('sprint-metrics  ·  via ADO REST API', { x: 0.6, y: 3.55, w: 12.0, h: 0.3, fontFace: MONO, fontSize: 9, color: C.muted, align: 'center' });

  addCardRow(s, [
    { tag: 'HEALTH', title: 'Memory', body: 'Confidence, decay curve, promote-ready — /dream-health.' },
    { tag: 'HEALTH', title: 'Graph staleness', body: 'Which modules drifted from the code — setup-status.' },
    { tag: 'HEALTH', title: 'Open findings', body: 'Critical / High / Medium across all three ledgers.' },
  ], { y: 4.1, h: 1.9 });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`And then zoom all the way out, because observability isn't only about one finding or one PR — it's about the trend. After every sprint, the numbers come straight out of Azure DevOps: how often the ICEA workflow was actually followed, how often PRs got rejected, how many hours went to rework. Health dashboards show memory confidence and decay, how stale the graph has drifted, and open findings across every ledger. So the question stops being "is this one change clean" and becomes "is the whole way we work with AI getting better, month over month" — answered with numbers instead of anecdotes. That's the last act. Let me bring it home.`);
}

// ══════════════════════════ CLOSE (41–44) ══════════════════════════

// ── 41. PLUGIN HOLDS ITSELF ───────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'The plugin holds itself to the same bar');
  addAhaBox(s,
    'DETERMINISTIC WHERE POSSIBLE  ·  ADR 0046',
    '"setup-init was 30–60 sequential LLM tool calls before any real work began."',
    'Collapsed to one deterministic Node.js bootstrap script. Rules deployed last — after the architect skill actually knows the stack. Crash-safe manifest as recovery checkpoint.',
    'ADR 0046',
    { y: 1.0, h: 2.0 }
  );
  addAhaBox(s,
    'HONESTY OVER OVERCLAIM  ·  ADR 0048',
    '"A hidden dependency could quietly fail and still report success."',
    'Eliminated. One canonical resolver reads the registry — O(1), no crawl, no guessing. It either knows, or says it doesn’t. A tool that asks you to be accountable is accountable itself.',
    'ADR 0048',
    { y: 3.2, h: 2.0 }
  );
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`One thing before I land this, and it's about credibility. A tool that demands you be accountable had better be accountable itself — so the plugin turns its whole philosophy inward. Setup used to be thirty to sixty sequential AI calls before any real work even began; we collapsed it into a single deterministic bootstrap script, because what can be mechanical should be. And it refuses to overclaim: there was a point where a hidden dependency could quietly fail and still report success — that's gone now, replaced by one honest resolver that either knows the answer or tells you it doesn't. It practices exactly what it enforces.`);
}

// ── 42. WHAT 52 DECISIONS TAUGHT US ───────────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'What 52 decisions taught us');
  const principles = [
    { n: '01', title: 'Gates are incentive structures', body: 'They change what people do before anyone else has to review their work.', adr: 'ADR 0001' },
    { n: '02', title: 'Honesty over overclaim', body: 'Never claim a floor the system can’t hold. Make bypass visible instead.', adr: 'ADR 0010' },
    { n: '03', title: 'One source of truth per concept', body: 'Duplication is the enemy. Shared primitives; the graph as sole orientation layer.', adr: 'ADR 0003' },
    { n: '04', title: 'Measure trust, don’t grant it', body: 'You don’t grant autonomy — you measure accuracy and earn it.', adr: 'ADR 0011' },
    { n: '05', title: 'Deterministic where possible', body: 'What a parser can know, a parser should know. Reserve judgment for the ambiguous.', adr: 'ADR 0041' },
    { n: '06', title: 'Friction is multiplicative', body: 'Small UX wins compound across 50+ sessions a month. Auditable exceptions beat gatekeeping.', adr: 'ADR 0036' },
    { n: '07', title: 'Design for deployment reality', body: 'The org never runs the plugin in CI. Design around that; surface the gap honestly.', adr: 'ADR 0010' },
  ];
  principles.forEach((p, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const spanTwo = i === 6;
    const x = 0.4 + col * 3.05;
    const y = 1.0 + row * 2.15;
    const w = spanTwo ? 6.35 : 2.9;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 2.0, fill: { color: C.white }, line: { color: C.line, pt: 1 }, rectRadius: 0.1 });
    s.addText(p.n, { x: x + 0.12, y: y + 0.1, w: w - 0.25, h: 0.25, fontFace: MONO, fontSize: 9, bold: true, color: C.gold });
    s.addText(p.title, { x: x + 0.12, y: y + 0.35, w: w - 0.25, h: 0.42, fontFace: FONT, fontSize: 12, bold: true, color: C.navy, wrap: true });
    s.addText(p.body, { x: x + 0.12, y: y + 0.78, w: w - 0.25, h: 0.9, fontFace: FONT, fontSize: 10, color: C.muted, wrap: true });
    s.addText(p.adr, { x: x + 0.12, y: y + 1.72, w: w - 0.25, h: 0.22, fontFace: MONO, fontSize: 8, color: C.muted });
  });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Fifty-two decisions, and honestly a handful of lessons that outlived any single feature. Gates are incentive structures — they change what people do before anyone else has to review the work. Honesty over overclaim — never promise a floor you can't hold; make bypass visible instead of pretending it's impossible. One source of truth per concept, because duplication is the enemy. You don't grant trust, you measure it. What a parser can know, a parser should know. Friction is multiplicative across fifty sessions a month, so the small wins compound. And design for the deployment reality you actually have, not the tidy one on the slide.`);
}

// ── 43. BOOKEND: RESPONSIBILITIES ANSWERED ────────────────────────────────────
{
  const s = pptx.addSlide();
  addSlideHeading(s, 'Five walls, climbed — your five responsibilities, answered');
  const rows = [
    ['Own the intent (BA hat)', 'Act I · Spec', 'ICEA gate makes it the path of least resistance'],
    ['Review the AI’s judgment', 'Act II · Trust', 'The critic — a second opinion when it’s possible'],
    ['Carry decisions forward', 'Act III + Dream', 'Disk-state & Dream mean they survive'],
    ['Understand the whole system', 'Act IV · Knowledge', 'The graph + architecture docs hand you the map'],
    ['Prove it actually held', 'Act V · Observability', 'Traceability + ledgers give you the evidence'],
  ];
  rows.forEach((row, i) => {
    const y = 1.15 + i * 1.02;
    s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y, w: 3.7, h: 0.88, fill: { color: 'F4F7FA' }, line: { color: C.line, pt: 1 }, rectRadius: 0.08 });
    s.addText(row[0], { x: 0.65, y, w: 3.4, h: 0.88, fontFace: FONT, fontSize: 12, bold: true, color: C.navy, valign: 'middle', wrap: true });
    s.addText('→', { x: 4.25, y, w: 0.5, h: 0.88, fontFace: FONT, fontSize: 16, bold: true, color: C.gold, align: 'center', valign: 'middle' });
    s.addShape(pptx.ShapeType.roundRect, { x: 4.8, y, w: 3.0, h: 0.88, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 });
    s.addText(row[1], { x: 4.9, y, w: 2.8, h: 0.88, fontFace: FONT, fontSize: 11, bold: true, color: C.white, valign: 'middle', align: 'center', wrap: true });
    s.addText(row[2], { x: 8.0, y, w: 4.8, h: 0.88, fontFace: FONT, fontSize: 11, color: C.muted, valign: 'middle', wrap: true });
  });
  s.addText('Each wall became visible only after you’d climbed the one before it.', { x: 0.5, y: 6.35, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: C.muted, align: 'center' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`Now let's go back to where we started. Remember that table of five walls? Read it forward, it was a list of everything that was broken. Read it backward, and it's the whole talk. You have to own the intent — the spec gate makes that the path of least resistance. You have to review the AI's judgment — the critic gives you a real second opinion at the one moment it's possible. You have to carry decisions forward — disk state and Dream mean they survive the session. You have to understand the whole system — the graph and the architecture docs hand you the map. And you have to prove it held — traceability and the ledgers give you the evidence. Every one of those walls only became visible after we'd climbed the one before it. That's not tidy design. That's just how it actually happened.`);
}

// ── 44. IN SUMMARY ────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  darkSlide(s, '1a3a5c');
  addEyebrow(s, 'IN SUMMARY', 0.5);
  s.addText('You’re not the coder anymore.\nYou’re the one the AI answers to.', {
    x: 0.6, y: 0.95, w: 12, h: 1.6,
    fontFace: FONT, fontSize: 34, bold: true, color: C.white, wrap: true,
  });
  s.addText('The coding got cheaper; the thinking became the job — wearing the BA hat, holding the system in your head, judging the plan, owning the decisions, proving what shipped. That’s a role, not a tool. And 52 decisions on disk exist to make that role trustworthy — so when you sign off, you sign off on evidence, not faith.', {
    x: 0.6, y: 2.55, w: 12, h: 1.4,
    fontFace: FONT, fontSize: 15, color: 'cdd9e6', wrap: true,
  });
  const paths = [
    { label: 'THE DECISIONS', body: 'docs/adr/\n52 ADRs, numbered and dated' },
    { label: 'THE PRINCIPLES', body: 'CLAUDE.md\nThe principles, every session' },
    { label: 'GO DEEPER ON DREAM', body: 'dream-skill.pptx\nThe 19-slide deep-dive' },
  ];
  paths.forEach((p, i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 4.2, w: 3.9, h: 1.7, fill: { color: '1E4870' }, line: { color: '4a7aaa', pt: 1 }, rectRadius: 0.12 });
    s.addText(p.label, { x: x + 0.15, y: 4.32, w: 3.6, h: 0.28, fontFace: MONO, fontSize: 8, bold: true, color: C.gold, charSpacing: 1.5 });
    s.addText(p.body, { x: x + 0.15, y: 4.62, w: 3.6, h: 1.15, fontFace: FONT, fontSize: 13, color: 'dce6f0', wrap: true });
  });
  s.addText('Discussion.', { x: 0.6, y: 6.35, w: 12, h: 0.35, fontFace: FONT, fontSize: 14, color: '9db2c7' });
  addSlideNumber(s, ++PAGE, TOTAL);
  s.addNotes(`So here's the whole thing in a breath. You are not the coder anymore — the coding got cheaper, and it's not where your value lives now. You're the reviewer who manages an AI to a result: wearing the BA hat, holding the system in your head, judging the plan, owning the decisions, proving what shipped. That is a role, not a tool — and honestly it's a bigger job than the one you had. Everything we built, all fifty-two decisions on disk, exists for exactly one reason: to make that role trustworthy, so that when you sign off, you're signing off on evidence and not on faith. The decisions are all in docs/adr. The principles live in CLAUDE.md, loaded every session. And if you want to go deeper on the memory system, there's a whole deck on Dream. That's the story — from coder to conductor. Let's talk.`);
}

// ─── Write output ─────────────────────────────────────────────────────────────
const outPath = 'docs/presentations/ai-assisted-development-story.pptx';
pptx.writeFile({ fileName: outPath })
  .then(() => console.log(`✓ Written: ${outPath} (${TOTAL} slides)`))
  .catch(e => { console.error(e); process.exit(1); });
