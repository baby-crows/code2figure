# Restormer — method figure (paper Figure 2 slot)

Output folder: `out/demo/restormer/run/`

| file | what it is |
|---|---|
| `figure.drawio` | the figure, editable draw.io XML |
| `fig.html` | viewer page for the same XML (open over HTTP, not `file://`) |
| `render.png` | PNG render of the final figure |
| `evidence.json` | raw material extracted by `scripts/evidence.py` |
| `report.md` | this file |

`render-r1.png` was **not** written: the independent visual gate passed on the
first submission, which the brief says makes it unnecessary. The one self-review
round that happened before that submission is described under gate ③ below.

---

## 1. Input, and what decided the drawing

Repository (local, used as-is, nothing cloned):
`eval/demo/repos/restormer`

```
git -C <repo> rev-parse --show-toplevel
C:/Users/youngseolee/OneDrive - Microsoft/Desktop/work/code/paper-trail/eval/demo/repos/restormer
git -C <repo> rev-parse HEAD
68dc6ac472db26f16361150cb7a96a1bc87da93f
```

`--show-toplevel` is the target folder itself, so `68dc6ac` is this repository's
commit and it is safe to put in the caption.

**Constraint honoured:** only code and in-repo text were read. The README links a
network-architecture image on imgur and the arXiv paper; **neither was fetched**.
The only README content used was the abstract paragraph that is inside the repo
file, and only to confirm the wording of the claim ("key designs in the building
blocks (multi-head attention and feed-forward network) … applicable to large
images"). Everything drawn comes from `restormer_arch.py` and the option YAMLs.

**Type: T1, sub-type T1-M (model structure).**
`restormer_arch.py` defines 8 `nn.Module` subclasses with `forward()` methods
(`Restormer`, `TransformerBlock`, `Attention`, `FeedForward`, `OverlapPatchEmbed`,
`Downsample`, `Upsample`, `LayerNorm`), channel arguments in `__init__`, and zero
API/LLM calls. That is the T1-M side of the split, not T1-G.

**Topology: M-P3 nested with M-P4.** The outer shape is a U with symmetric
`down1_2/down2_3/down3_4` and `up4_3/up3_2/up2_1` pairs and `torch.cat` skips, so
the skips are drawn horizontal. Every level is an `nn.Sequential` of
`TransformerBlock`s, i.e. a repeat, so each stage is folded to three stacked
plates plus `× N` instead of being drawn N times. The block interior is the
paper's actual contribution, so it is opened once as panel (b) rather than
repeated — that is the M-P4 "inset once" rule.

**Running example.** For T1-M the skill says the running example is tensors and
configuration values, not a domain sentence, so the running thread here is the
tensor: `3 × H × W` in, then `48 / 96 / 192 / 384 ch` at `H / H2 / H4 / H8`, back
up to `96 ch` at `H × W`, then `3 × H × W` out. Every stage carries its own value,
not just the first box. `scripts/evidence.py --running-example` was not needed for
a domain sentence, and no placeholder was required: every number in the figure has
a line of code behind it.

---

## 2. Source evidence — every box and mark

All line numbers are `basicsr/models/archs/restormer_arch.py` unless stated.

| in the figure | source |
|---|---|
| `Degraded 3 × H × W` | `inp_channels=3` L195; `forward(self, inp_img)` L245 |
| `3 × 3 conv` (left) | `OverlapPatchEmbed` L156–165, `Conv2d(3, 48, kernel_size=3, stride=1, padding=1)` L160; `dim = 48` L197 |
| `Encoder × 4`, `H × W, 48 ch` | `encoder_level1` L211; `num_blocks[0] = 4` L198 |
| red downsample arrows | `Downsample` L171–179 = `Conv2d(n, n//2, 3)` + `PixelUnshuffle(2)`; `down1_2` L213, `down2_3` L216, `down3_4` L219 |
| `Encoder × 6`, `H/2 × W/2, 96 ch` | `encoder_level2` L214, `dim*2**1` |
| `Encoder × 6`, `H/4 × W/4, 192 ch` | `encoder_level3` L217, `dim*2**2` |
| `Latent × 8`, `H/8 × W/8, 384 ch` | `latent` L220, `num_blocks[3] = 8`, `dim*2**3` |
| green upsample arrows | `Upsample` L181–189 = `Conv2d(n, n*2, 3)` + `PixelShuffle(2)`; `up4_3` L222, `up3_2` L227, `up2_1` L231 |
| grey plate butted on each decoder stage | `torch.cat([...], 1)` L260, L265, L270 |
| `Decoder × 6`, `H/4 × W/4, 192 ch` | `reduce_chan_level3` (1 × 1) L223 + `decoder_level3` L224 |
| `Decoder × 6`, `H/2 × W/2, 96 ch` | `reduce_chan_level2` (1 × 1) L228 + `decoder_level2` L229 |
| `Decoder × 4`, `H × W, 96 ch` | `up2_1` L231 with the in-code comment `## ... (NO 1x1 conv to reduce channels)`; `decoder_level1` at `dim*2**1` L233 |
| `Refinement × 4`, `H × W, 96 ch` | `refinement` L235; `num_refinement_blocks = 4` L199 |
| `3 × 3 conv` (right) | `self.output = Conv2d(96, 3, kernel_size=3, ...)` L243 |
| circled `+` at the right, and the long dashed line | `self.output(out_dec_level1) + inp_img` L281 |
| `LayerNorm` × 2 in panel (b) | `LayerNorm` L60–70, `norm1` L141, `norm2` L143 |
| circled `+` × 2 in panel (b) | `x = x + self.attn(...)` L147, `x = x + self.ffn(...)` L148 |
| MDTA `1 × 1 conv` (first) | `self.qkv = Conv2d(dim, dim*3, kernel_size=1)` L105 |
| MDTA `3 × 3 depthwise` | `self.qkv_dwconv = Conv2d(dim*3, dim*3, 3, groups=dim*3)` L106 |
| `Q` `K` `V` strips | `q, k, v = qkv.chunk(3, dim=1)` L115 |
| attention grid, `(C/h) × (C/h)` | `rearrange(..., 'b (head c) h w -> b head c (h w)')` L117–119, then `attn = (q @ k.transpose(-2, -1)) * temperature` L124 and `softmax` L125 — the matrix is channel-by-channel, not pixel-by-pixel |
| circled `x` in MDTA | `out = (attn @ v)` L127 |
| MDTA `1 × 1 conv` (last) | `self.project_out` L107, used L131 |
| GDFN `1 × 1 conv` (first) | `self.project_in = Conv2d(dim, hidden*2, kernel_size=1)` L82 |
| GDFN `3 × 3 depthwise` | `self.dwconv = Conv2d(h*2, h*2, 3, groups=h*2)` L84 |
| `GELU` + circled `x` | `x1, x2 = self.dwconv(x).chunk(2, dim=1)`, `x = F.gelu(x1) * x2` L90–91 |
| `C → 2.66 C → C` | `ffn_expansion_factor = 2.66` L201; `hidden = int(dim*2.66)` L80; `project_out` back to `dim` L86 |
| GDFN `1 × 1 conv` (last) | `self.project_out` L86, used L92 |
| heads `1, 2, 4, 8` in the caption | `heads = [1,2,4,8]` L200 |
| `[trainable]`, `L1 loss` in the caption | `Motion_Deblurring/Options/Deblurring_Restormer.yml` → `pixel_opt: type: L1Loss`; no frozen module anywhere in the repo |

**Deliberately not drawn.** `dual_pixel_task` (L204, L239–241, L276–278) adds a
`1 × 1` skip from the patch embedding and takes 6 input channels. It is `False` in
every option file except `DefocusDeblur_DualPixel_16bit_Restormer.yml`, so the
figure shows the default path. `BiasFree` vs `WithBias` LayerNorm (L63–66) is a
switch, not a structure, so it is one clause in the caption instead of two boxes.
The L1 loss is not drawn as a box: it is not this figure's argument, and the skill
forbids drawing a loss as a module.

---

## 3. Verification — raw stdout

### Gate ① render / XML parse — PASS, 1 round

```
python -c "import xml.etree.ElementTree as ET,sys; ET.parse(sys.argv[1]); print('ok')" figure.drawio
xml ok
```

```
python scripts/render_view.py <outdir> figure.drawio=fig
fig.html <- figure.drawio (40341 chars)
```
Served with `python -m http.server 8917 --directory <outdir>`.

### Gate ② `check_layout.py` — PASS, 4 rounds

Round 1 (30 flags, abridged only by this sentence — the block below is the
verbatim stdout):

```
== figure.drawio ==
  edges 41, labelled 0
  FLAG  'downsample' does not fit its shape (100x18) -- grow it to 113x31
  FLAG  'upsample' does not fit its shape (90x18) -- grow it to 90x31
  FLAG  'skip connection' does not fit its shape (120x18) -- grow it to 133x31
  FLAG  'global residual' does not fit its shape (130x18) -- grow it to 130x31
  FLAG  'concatenated encoder feature' does not fit its shape (220x18) -- grow it to 240x31
  FLAG  'Transformer blocks × N' does not fit its shape (220x18) -- grow it to 220x31
  FLAG  'H × W' does not fit its shape (112x20) -- grow it to 112x31
  FLAG  '48 ch' does not fit its shape (112x20) -- grow it to 112x32
  FLAG  'H/2 × W/2' does not fit its shape (104x20) -- grow it to 104x31
  FLAG  '96 ch' does not fit its shape (104x20) -- grow it to 104x32
  FLAG  'Encoder' does not fit its shape (72x52) -- grow it to 72x73
  FLAG  'H/4 × W/4' does not fit its shape (96x20) -- grow it to 96x31
  FLAG  '192 ch' does not fit its shape (96x20) -- grow it to 96x32
  FLAG  'H/8 × W/8' does not fit its shape (88x20) -- grow it to 88x52
  FLAG  '384 ch' does not fit its shape (88x20) -- grow it to 88x32
  FLAG  'Decoder' does not fit its shape (72x52) -- grow it to 72x73
  FLAG  'H/4 × W/4' does not fit its shape (96x20) -- grow it to 96x31
  FLAG  '192 ch' does not fit its shape (96x20) -- grow it to 96x32
  FLAG  'H/2 × W/2' does not fit its shape (104x20) -- grow it to 104x31
  FLAG  '96 ch' does not fit its shape (104x20) -- grow it to 104x32
  FLAG  'H × W' does not fit its shape (112x20) -- grow it to 112x31
  FLAG  '96 ch' does not fit its shape (112x20) -- grow it to 112x32
  FLAG  'Refinement' does not fit its shape (88x62) -- grow it to 88x73
  FLAG  'H × W' does not fit its shape (112x20) -- grow it to 112x31
  FLAG  '96 ch' does not fit its shape (112x20) -- grow it to 112x32
  FLAG  '3 × H × W' does not fit its shape (104x20) -- grow it to 104x31
  FLAG  '3 × H × W' does not fit its shape (104x20) -- grow it to 104x31
  FLAG  '3 × 3' does not fit its shape (86x48) -- grow it to 86x73
  FLAG  '3 × 3' does not fit its shape (86x48) -- grow it to 86x73
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
  (zone, container, and crossing flags are not auto-fixable except --fix growing; the numbers above are the fix)
```

Round 2, after the annotation and stage boxes were given real line heights and
the `&#215;` entities were replaced by literal `×` so the width estimator stopped
counting entity characters:

```
== figure.drawio ==
  edges 41, labelled 0
  FLAG  'downsample' does not fit its shape (92x32) -- grow it to 92x52
  FLAG  'upsample' does not fit its shape (82x32) -- grow it to 82x52
  FLAG  '3 × 3' does not fit its shape (88x56) -- grow it to 88x73
  FLAG  '3 × 3' does not fit its shape (88x56) -- grow it to 88x73
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

Round 3, after widening the two legend cells and the two `depthwise` boxes:

```
== figure.drawio ==
  edges 41, labelled 0
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

The remaining flag was the MDTA and GDFN sub-panels: they are geometric
enclosers, so `paint_order` ranks them as containers, and my emitter was still
ranking them as leaf shapes. Emitting them in the container band fixed it.

Round 4 — **final, and this is the state of the shipped file**:

```
== figure.drawio ==
  edges 41, labelled 0
  ok
```

`edges 41, labelled 0` — the T1-M edge-label cap of 0 is met: no operation name
sits on any arrow. All operation names are inside boxes, and arrow colour is
explained once in the legend.

### Gate ③a `check_render.js` in the rendered page — PASS, 3 rounds

Round 1:

```
{ "texts": 88, "shapes": 66, "edges": 28,
  "counts": { "spill": 1, "online": 5 },
  "flags": [
    {"kind":"spill","a":"Latent","at":[404,395],"note":"label is wider than the shape holding it; the shape needs about 50px of inner width"},
    {"kind":"online","a":"H × W","at":[150,172],"note":"an arrow runs across this label without belonging to it - move the label off the line"},
    {"kind":"online","a":"H/2 × W/2","at":[230,267],"note":"an arrow runs across this label without belonging to it - move the label off the line"},
    {"kind":"online","a":"H/4 × W/4","at":[308,358],"note":"an arrow runs across this label without belonging to it - move the label off the line"},
    {"kind":"online","a":"H/4 × W/4","at":[464,358],"note":"an arrow runs across this label without belonging to it - move the label off the line"},
    {"kind":"online","a":"Degraded","at":[20,115],"note":"an arrow runs across this label without belonging to it - move the label off the line"} ] }
```

The four `online` flags on the stage annotations were real: every down/up arrow
turned inside the band where the resolution and channel numbers sit. The fix was
to make each arrow turn 8 px below the stage stack and put the annotation 16 px
below that, and to shift the three right-hand annotations so the vertical legs at
`x = 648`, `x = 768` and `x = 898` pass between annotations instead of through
them. The `Degraded` flag was different: the culprit path was
`M 91 156 L 91 168 L 103 168`, which is the dog-ear fold of the `shape=note`
card, not an arrow — the checker classifies it as an edge. Growing the note from
56 px to 68 px tall pushes the label clear of the fold.

Round 2:

```
{ "texts": 88, "shapes": 66, "edges": 28,
  "counts": { "spill": 1, "online": 1 },
  "flags": [
    {"kind":"spill","a":"Latent","at":[402,395],...},
    {"kind":"online","a":"Degraded","at":[20,115],...} ] }
```

The `Latent` spill was also a checker artefact, and finding it needed a DOM
probe. `check_render.js` assigns a label to *the smallest shape containing the
label's centre*. The three plates of a folded stack are the same size, so the
owner resolved to the rearmost plate, which is offset 12 px down-right; the label
is centred on the *front* plate and therefore sat 2 px above the rearmost plate's
top edge. Making the two rear plates 2 px larger than the front one makes the
front plate the unique smallest container and the flag is gone. The geometry the
reader sees is unchanged.

Round 3 — **final**:

```
{ "texts": 88, "shapes": 66, "edges": 28, "counts": {}, "flags": [] }
```

### Gate ③b my own screenshot inspection — 1 change made

Not a "I checked it" line. What I looked at, item by item:

1. *Lines through shapes* — none. The only line that runs a long way, the global
   residual, sits in an empty band at `y = 112`, above everything except the
   legend, and drops into the `+` circle from directly above.
2. *Lines that were asked for but did not render* — counted them in the PNG:
   3 red downsample, 3 green upsample, 3 grey dashed skips, 1 global residual,
   12 black flow arrows in panel (a); in panel (b) both residual arcs, the
   `V`-to-multiply detour under the attention grid, and the GDFN branch that
   splits after the depthwise conv and rejoins at the `x` circle. All present.
3. *Lines cutting each other* — the three skips are at three different rows and
   the arrows between levels turn above the annotation band, so nothing crosses.
4. *Arrowheads landing in the wrong place* — the two upsample arrows into levels
   3 and 2 land on the grey concat plate, which is where the concatenation
   happens in the code, not on the decoder stage.
5. *Text outside its box* — none; matches `flags: []`.
6. *Legend marks vs figure marks* — red, green and grey-dashed lines in the
   legend are the same weight and dash pattern as in the figure.
7. *A label sitting on someone else's border* — none.
8. *Spelling* — done as a list, section 4 below, not by eye.
9. *Labels fitting* — `Latent` in the smallest stage box (72 × 53) has ~14 px of
   slack each side.
10. *Small insets being readable* — the attention grid cells are 20 px and carry
    no text; the four dark cells on the diagonal are clearly the diagonal.
11. *Invented symbols* — **this is the one thing I changed here.** The legend
    entry `Transformer blocks × N` had a single orange rectangle as its sample,
    which asserts "orange means Transformer block" while the encoder stacks are
    blue-grey. The sample is now three small stacked plates in neutral grey, so
    it explains the *stacking device* rather than a colour that would have been
    wrong. Nothing else in the figure uses a symbol that is not in the legend;
    there is no `//`, no `⊘`, no stop-gradient mark.
12. *A long line crossing everything* — only the global residual, and it is
    routed above the whole figure.

### Gate ③c label list against the source — PASS

Every distinct label string in the XML, checked one by one against the symbols in
`restormer_arch.py` (the mapping is section 2's table):

```
(C/h) × (C/h)
(a) Restormer: four-level encoder-decoder at full resolution
(b) Inside one Transformer block
+
1 × 1 / conv
3 × 3 / conv
3 × 3 / depthwise
H × W, 48 ch
H × W, 96 ch          (twice: decoder 1 and refinement)
H/2 × W/2, 96 ch      (twice)
H/4 × W/4, 192 ch     (twice)
H/8 × W/8, 384 ch
C → 2.66 C → C
Decoder / × 4
Decoder / × 6
Degraded / 3 × H × W
Encoder / × 4
Encoder / × 6
GELU
Gated-Dconv feed-forward network (GDFN)
K
Latent / × 8
LayerNorm
Multi-Dconv head transposed self-attention (MDTA)
Q
Refinement / × 4
Restored / 3 × H × W
Transformer blocks × N
V
concatenated features
downsample
global residual
skip connection
upsample
x
Figure 2. ... (caption, one cell)
```

No typos. `MDTA` and `GDFN` are spelled as the section comments in the source
spell them (L75, L98). The two `96 ch` at level 1 are not a copy-paste slip:
decoder 1 and refinement both run at `dim*2 = 96` because `up2_1` has no channel
reduction.

### Gate ③d proportion and notation

```
python scripts/extent.py figure.drawio
  FULL   1348 x 1104  ratio 1.22:1
```

1.22 : 1 is inside the 3 : 1 ceiling for a full-width figure, and also inside the
1.6 : 1 single-column ceiling — but read the other way, this figure is **tall**:
at full column width it is about 0.8 of its own width in height, so it will take
a large part of a page. If that is too much, panel (b) is self-contained and can
be lifted out into its own figure; panel (a) alone measures 1348 × 660, i.e.
about 2.0 : 1. That is a layout decision for you, so it is reported and not
forced.

```
emoji/glyph ['→'] | font 132 / 132
```

Only `→` (U+2192) is present, which is the one glyph the skill allows; `×` is
U+00D7 and is not in the scanned ranges. `fontFamily=Times New Roman` is on
132 of 132 styles. No emoji, no `⊕ ⊗ ⊙ ⊘`, no em-dash, all labels English.

### Gate ④ independent visual gate — **PASS, 1 round**

An independent `general-purpose` agent was given only the rendered PNGs (full
figure plus three zooms), the verbatim checker output above, and the repository
path — no report, no step table, no explanation of intent. Its verdict, in full:

```
Wrong-page check PASS — render is explicitly about Restormer image restoration and matches `restormer_arch.py`.

A1 PASS — I saw no text protruding from boxes.
A2 PASS — MDTA/GDFN panel zones contain their internals; nothing straddles borders.
A3 PASS — arrows avoid text; intersections are connection points, not confusing crossings.
A4 PASS — no clipped words observed.
A5 PASS — smallest text is readable in the zooms.
A6 PASS — checker reports no body-ratio flag.

B1 PASS — figure says Restormer restores a degraded image via encoder-decoder transformer blocks.
B2 PASS — start is left input; flow proceeds through conv, encoder/down path, latent, decoder/up path, refinement, output.
B3 PASS — feature maps, skips, concatenation, channel counts, and resolutions are shown.
B4 PASS — caption and lower panel explain high-resolution design: no fixed patch grid, channel attention, GDFN gating, pixel-unshuffle/shuffle.
B5 PASS — box text uses paper vocabulary, not raw function/file identifiers.
B6 PASS — legend/caption explain non-obvious marks; no orphan shapes observed.

C1 PASS — reading order is carried by arrows only.
C2 PASS — documents, stacked blocks, concat plates, plus/multiply circles, and colored arrows have distinct roles.
C3 PASS — every legend entry has a sample and fits inside the legend box.
C4 PASS — legend, panels/panel labels, and caption occupy separate bands.
C5 PASS — repeated blocks are folded as `× N`, with a legend entry.

Genre checks PASS — shapes are not all identical boxes; resolution/channel labels are present and match source defaults; repeats are folded; skip connections are horizontal and same-resolution aligned; no operation names sit on arrows; symbols are legend-backed or self-evident; no invented code identifiers dominate the boxes.

GATE: PASS
```

Round count summary:

| gate | result | rounds |
|---|---|---|
| ① XML parse + viewer | PASS | 1 |
| ② `check_layout.py` | PASS | 4 |
| ③a `check_render.js` | PASS | 3 |
| ③b my own screenshot pass | 1 change (legend sample) | 1 |
| ③c label list vs source | PASS | 1 |
| ④ independent visual gate | **PASS** | **1** |

---


## (이 절은 공개본에서 제외되었다)

원문 보고서의 이 위치에는 스킬 자체의 도구·지침에 대한 내부 검토 내용이 있다.
도면의 결함이 아니라 도구의 결함에 관한 기록이라 공개본에서는 제외하였다.
게이트가 검출한 도면 결함은 위 절들에 그대로 남아 있다.
## 5. Assumptions, stated

- `H` and `W` are the input height and width, and the figure asserts that the
  network keeps that resolution at level 1. That is a property of the code
  (`OverlapPatchEmbed` is a stride-1 `3 × 3` conv, and every rescale is
  pixel-unshuffle / pixel-shuffle), not of any particular option file.
- The channel and block numbers are the defaults in `Restormer.__init__`
  (L194–205), which are also what every option file in the repository sets
  (`dim: 48`, `num_blocks: [4,6,6,8]`, `heads: [1,2,4,8]`,
  `num_refinement_blocks: 4`, `ffn_expansion_factor: 2.66`).
- The tapering silhouette carries **spatial resolution only**. Channels move the
  other way and are written as the bold number under each stage. The caption says
  which is which, because a shape can only carry one of the two.
- `C` and `h` in panel (b) are the channel count at that level and the number of
  heads at that level; both vary by level, which is why the annotation is
  `(C/h) × (C/h)` and not a fixed number.

## 6. Editing it afterwards

- The **caption** is one cell, `id="cap"`. Select it, delete it, and nothing else
  moves — useful if you write captions in the LaTeX source.
- The **legend** is one group, `id="legend"`. One click selects the frame, the
  six samples and the six labels together; deleting it leaves no fragments.
- The **panel labels** are two separate cells, `id="pa"` and `id="pb"`, so you can
  drop `(a)` / `(b)` if you split the panels into two figures.
- The **two sub-panels** in (b) are `id="mdta"` and `id="gdfn"`; each is the
  background rectangle that carries the title, with its contents drawn on top.
- If you delete panel (b) entirely, panel (a) stands alone at 1348 × 660 and only
  the `(a)` label needs removing.
- Cells are emitted in draw.io's paint order (containers, then edges, then
  shapes). If you re-order cells by hand, arrows can end up painted on top of
  boxes; re-run `check_layout.py` afterwards to catch it.
