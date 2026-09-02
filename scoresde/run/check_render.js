/**
 * Measure a RENDERED figure and report the collisions that XML cannot show.
 *
 * check_layout.py estimates glyph widths from the XML. That is enough to size a
 * box, but it cannot know where draw.io actually put a rotated label, how an
 * orthogonal edge really routed, or where two arrows cross. This runs against
 * the rendered SVG, so every number is the real one.
 *
 * Five classes, all of which shipped clean through the old text-vs-text check
 * in the 4th T2 hold-out:
 *
 *   spill     a label crossing the border of the shape that holds it
 *   onborder  a label sitting on some other shape's border, so it reads as
 *             belonging to neither side
 *   onshape   a label lying over a different shape's body
 *   online    an edge passing under a label that is not that edge's own
 *   cross     two edges crossing each other
 *
 * Run it in the page that render_view.py produced:
 *   page.evaluate(<contents of this file>)
 * It returns {texts, shapes, edges, flags:[...]}. flags MUST be empty.
 */
(() => {
  const svg = document.querySelector("svg");
  if (!svg) return { error: "no svg rendered - is the viewer script loaded?" };

  const R = (e) => e.getBoundingClientRect();
  const area = (b) => Math.max(0, b.width) * Math.max(0, b.height);
  const lap = (a, b) => {
    const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return x > 0 && y > 0 ? x * y : 0;
  };
  const inside = (a, b, tol = 1) =>
    a.x >= b.x - tol && a.y >= b.y - tol &&
    a.x + a.width <= b.x + b.width + tol &&
    a.y + a.height <= b.y + b.height + tol;

  // ---- text, one box per rendered line -------------------------------------
  const texts = [];
  const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = (n.nodeValue || "").trim();
    if (!s) continue;
    const rng = document.createRange();
    rng.selectNodeContents(n);
    for (const r of rng.getClientRects()) {
      if (r.width < 3 || r.height < 3) continue;
      texts.push({ t: s.slice(0, 44), b: r });
    }
  }
  // draw.io paints each label twice (<text> plus a foreignObject copy)
  const seen = new Set();
  const T = texts.filter((o) => {
    const k = `${o.t}|${Math.round(o.b.x)}|${Math.round(o.b.y)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // ---- shapes and edges ----------------------------------------------------
  const S = [], E = [];
  for (const el of svg.querySelectorAll("rect,ellipse,path,polygon")) {
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") continue;
    const fill = el.getAttribute("fill") || st.fill;
    const stroke = el.getAttribute("stroke") || st.stroke;
    const sw = parseFloat(el.getAttribute("stroke-width") || st.strokeWidth) || 1;
    const b = R(el);
    if (b.width < 2 && b.height < 2) continue;
    const filled = fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)";
    // draw.io paints every edge three times: a hidden fat hit-area path, the
    // visible line, and a filled arrowhead. Only the middle one is the edge.
    if (el.tagName === "path" && !filled && stroke && stroke !== "none" && sw < 8) {
      let len = 0;
      try { len = el.getTotalLength(); } catch (e) { len = 0; }
      if (len < 8) continue;
      const pts = [];
      const m = el.getScreenCTM();
      const step = Math.max(3, len / 160);
      for (let d = 0; d <= len; d += step) {
        const p = el.getPointAtLength(d);
        pts.push(m ? { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f }
                   : { x: p.x, y: p.y });
      }
      E.push({ pts, b });
    } else if (filled || (stroke && stroke !== "none")) {
      if (b.width < 12 || b.height < 12) continue;
      S.push({ b, filled });
    }
  }
  S.sort((p, q) => area(q.b) - area(p.b));

  // the shape a label belongs to: the smallest one that holds its centre
  const owner = (tb) => {
    const cx = tb.x + tb.width / 2, cy = tb.y + tb.height / 2;
    let best = null;
    for (const s of S) {
      const b = s.b;
      if (cx < b.x || cx > b.x + b.width || cy < b.y || cy > b.y + b.height) continue;
      if (!best || area(b) < area(best.b)) best = s;
    }
    return best;
  };

  const seg = (p, q, r) => {
    // does segment p-q touch rect r
    const iv = (a, b, lo, hi) => Math.max(a, lo) <= Math.min(b, hi);
    if (!iv(Math.min(p.x, q.x), Math.max(p.x, q.x), r.x, r.x + r.width)) return false;
    if (!iv(Math.min(p.y, q.y), Math.max(p.y, q.y), r.y, r.y + r.height)) return false;
    const c = [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height],
               [r.x, r.y + r.height]];
    const side = (x, y) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x);
    let neg = 0, pos = 0;
    for (const [x, y] of c) { const s = side(x, y); if (s < 0) neg++; if (s > 0) pos++; }
    return neg && pos;
  };

  const xsect = (a1, a2, b1, b2) => {
    const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
    if (Math.abs(d) < 1e-9) return null;
    const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
    const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
  };

  const flags = [];
  const at = (b) => [Math.round(b.x), Math.round(b.y)];

  // 1. text vs text
  for (let i = 0; i < T.length; i++)
    for (let j = i + 1; j < T.length; j++) {
      const o = lap(T[i].b, T[j].b);
      if (!o) continue;
      const f = o / Math.min(area(T[i].b), area(T[j].b));
      if (f < 0.08) continue;
      flags.push({ kind: "ontext", a: T[i].t, b: T[j].t, frac: +f.toFixed(2),
                   at: at(T[i].b) });
    }

  // 2. a label crossing the border of its own shape, or of any other shape
  for (const t of T) {
    const own = owner(t.b);
    if (own && !inside(t.b, own.b, 2)) {
      const need = Math.ceil(t.b.width + 16);
      flags.push({ kind: "spill", a: t.t, at: at(t.b),
                   note: `label is wider than the shape holding it; the shape `
                       + `needs about ${need}px of inner width` });
      continue;
    }
    for (const s of S) {
      if (own && s.b === own.b) continue;
      if (!lap(t.b, s.b)) continue;
      if (inside(t.b, s.b, 2)) {
        if (own && area(own.b) <= area(s.b)) continue;   // nested zone, fine
        flags.push({ kind: "onshape", a: t.t, at: at(t.b),
                     note: "label lies on another shape's body" });
      } else {
        flags.push({ kind: "onborder", a: t.t, at: at(t.b),
                     note: "label sits astride a shape border - it reads as "
                         + "belonging to neither side" });
      }
      break;
    }
  }

  // 3. an edge running under a label that is not its own.
  //
  // An edge's own label is placed ON the line, centred: the line enters and
  // leaves the label box symmetrically about the box centre. A label the line
  // merely happens to cross is hit off-centre. That is the whole difference,
  // and it is measurable - the SVG carries no ownership information.
  for (const e of E) {
    for (const t of T) {
      const cx = t.b.x + t.b.width / 2, cy = t.b.y + t.b.height / 2;
      const cuts = [];
      for (let i = 1; i < e.pts.length; i++)
        if (seg(e.pts[i - 1], e.pts[i], t.b))
          cuts.push({ x: (e.pts[i - 1].x + e.pts[i].x) / 2,
                      y: (e.pts[i - 1].y + e.pts[i].y) / 2 });
      if (!cuts.length) continue;
      const mx = cuts.reduce((s, p) => s + p.x, 0) / cuts.length;
      const my = cuts.reduce((s, p) => s + p.y, 0) / cuts.length;
      const own = Math.abs(mx - cx) < t.b.width * 0.28
               && Math.abs(my - cy) < Math.max(6, t.b.height * 0.6);
      if (own) continue;
      flags.push({ kind: "online", a: t.t, at: at(t.b),
                   note: "an arrow runs across this label without belonging "
                       + "to it - move the label off the line" });
    }
  }

  // 4. edge crossing edge
  for (let i = 0; i < E.length; i++)
    for (let j = i + 1; j < E.length; j++) {
      if (!lap(E[i].b, E[j].b)) continue;
      for (let a = 1; a < E[i].pts.length; a++)
        for (let b = 1; b < E[j].pts.length; b++) {
          const p = xsect(E[i].pts[a - 1], E[i].pts[a], E[j].pts[b - 1], E[j].pts[b]);
          if (!p) continue;
          const near = E[i].pts[0], far = E[j].pts[0];
          // shared endpoints are a join, not a crossing
          if (Math.hypot(p.x - near.x, p.y - near.y) < 6) continue;
          if (Math.hypot(p.x - far.x, p.y - far.y) < 6) continue;
          flags.push({ kind: "cross", at: [Math.round(p.x), Math.round(p.y)],
                       note: "two arrows cross - route one around, or add a "
                           + "line jump" });
          a = E[i].pts.length; break;
        }
    }

  const uniq = [];
  const key = new Set();
  for (const f of flags) {
    const k = `${f.kind}|${f.a || ""}|${f.at.join(",")}`;
    if (key.has(k)) continue;
    key.add(k);
    uniq.push(f);
  }
  const by = {};
  for (const f of uniq) by[f.kind] = (by[f.kind] || 0) + 1;
  return { texts: T.length, shapes: S.length, edges: E.length,
           counts: by, flags: uniq };
})();
