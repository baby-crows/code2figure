# report.md — PatchTST, Figure 1

Repository: `paper-trail/eval/demo/repos/patchtst`
`git rev-parse --show-toplevel` → `.../paper-trail/eval/demo/repos/patchtst` (matches the target, so the SHA below is this repo's)
`git rev-parse HEAD` → `204c21efe0b39603ad6e2ca640ef5896646ab1a9`

Outputs in this folder:

| file | what |
|---|---|
| `figure.drawio` | the editable figure |
| `fig.html` | viewer page produced by `render_view.py` |
| `render.png` | the final figure as rendered |
| `render-r1.png` | the render as it stood at gate round 1, before it passed |
| `evidence.json` | raw output of `evidence.py` |
| `report.md` | this file |

Only this repository's code was read. The paper, the authors' figure
(`pic/model.png`), and the images the README links to were not opened.

---

## 1. Type decision: T1-M

`nn.Module` subclasses with real `forward()` bodies throughout
(`PatchTST_backbone`, `TSTiEncoder`, `TSTEncoder`, `TSTEncoderLayer`,
`_MultiheadAttention`, `_ScaledDotProductAttention`, `RevIN`, `Flatten_Head`,
plus the self-supervised `PatchTST` and its four heads). Zero LLM / API client
calls. That is the T1-M side of the split, not T1-G.

Topology: an **M-P1 serial trunk** with **M-P4** nested inside it. The repeat is
`nn.ModuleList([TSTEncoderLayer(...) for i in range(n_layers)])`
(`PatchTST_backbone.py#L183-L186`) with `n_layers = 3`. Repetition is incidental
to the contribution, so it is folded to `× N = 3` inside the box rather than
drawn as three overlapping plates. That also keeps the stacked-plate device
meaning exactly one thing (see §5, round-1 self check).

## 2. Running example

`evidence.py --running-example` found nothing usable:

```
쓸 만한 관통 예시를 찾지 못했다.
**지어내지 말고 사용자에게 물어라** — 대표 사례 한 건,
즉 실제 입력 하나와 그때 나오는 결과 하나를 받아온다.
코드 저장소에는 사례가 없고 논문 본문·데이터셋에만 있는 경우가 흔하다.

약한 후보 (11) — 대개 프롬프트·설명문이다. 그대로 쓸 것
  [ 1] weak_marker    README.md#L65  You can adjust the hyperparameters based on your needs (e.g. different
  [ 1] sample_string  patchtst_pretrain.py#L64  c_in: number of variables
  [ 1] sample_string  patchtst_pretrain.py#L27  number of workers for DataLoader
  [ 1] sample_string  patchtst_pretrain.py#L29  for multivariate model or univariate model
  [ 1] sample_string  patchtst_pretrain.py#L36  number of Transformer layers
```

That is the expected normal result here, and for T1-M the running example is
**tensors and config values**, not a domain sentence. I used one concrete
configuration end to end: `scripts/PatchTST/weather.sh`, i.e. M = 21, L = 336,
T = 96, P = 16, S = 8, N = 42, d = 128, h = 16, d_ff = 256, 3 layers. Every
number in the figure comes from that one script or from the module that
consumes it. Nothing was invented and no placeholder was needed.

One genuine mismatch, handled rather than hidden: the self-supervised script has
its own defaults (`context_points 512`, `patch_len 12`, `stride 12`), which also
give N = 42 but a different patch length. So the pre-training head is labelled
`Linear 128 → P` (the code is literally `nn.Linear(d_model, patch_len)`) and the
caption states the second configuration.

## 3. What the figure had to say, and how the structure says it

README "Key Designs" names two things: patching, and channel-independence. Both
are carried by structure, not by a sentence laid on top:

| claim | the device that carries it |
|---|---|
| patching shortens what the Transformer attends over | panel 1: a 336-step bar, overlapping windows under it, and a 42-cell token strip out the right. Panel 2: the attention square labelled 42 × 42 |
| windows overlap because S < P | the windows are drawn overlapping by half |
| channels do not mix, and one weight set serves all of them | panel 2: two channel cards, two arrows, **one** embedding box and **one** encoder. Plus the attention square: "within one channel" |
| there are two heads because the encoder is reused | panel 3: the same chain twice with exactly one element changed (the head), and a dashed link running encoder → encoder |

The panel-3 link is `transfer_weights(weights_path, model, exclude_head=True)`
(`src/learner.py#L450`, called at `patchtst_finetune.py#L141`). Because T1-M
allows zero edge labels, the link's meaning is carried by its own colour and
dash plus one legend row, not by a label on the arrow.

## 4. Evidence table: every box, and where it comes from

| element in the figure | source |
|---|---|
| `Look-back window 336 × 21 (weather)` | `scripts/PatchTST/weather.sh#L8`, `#L30`; `models/PatchTST.py#L24`, `#L23` |
| `RevIN norm per channel` | `layers/PatchTST_backbone.py#L62-L65`; `layers/RevIN.py#L21-L28`, `#L35-L52` |
| `patch P = 16, stride S = 8, N = 42` | `weather.sh#L38-L39`; `PatchTST_backbone.py#L35` (`patch_num = (context_window - patch_len)/stride + 1` = 41), `#L36-L38` (`ReplicationPad1d`, `patch_num += 1`) |
| overlapping window shapes | `PatchTST_backbone.py#L70` `unfold(dimension=-1, size=patch_len, step=stride)` with 8 < 16 |
| `42 patches × 16 per channel` | `PatchTST_backbone.py#L70-L71` (`[bs x nvars x patch_num x patch_len]`) |
| `masked patches, ratio 0.4` and the grey cells | `patchtst_pretrain.py#L43`; `src/callback/patch_mask.py#L106-L135` (`random_masking`, zeros in the removed slots) |
| `channel 1` / `channel 21`, one shared path | `PatchTST_backbone.py#L164` `reshape(x, (bs*nvars, patch_num, d_model))`; self-supervised twin at `src/models/patchTST.py#L223` |
| `Patch embedding 16 → 128 [trainable]` | `PatchTST_backbone.py#L143` `self.W_P = nn.Linear(patch_len, d_model)` |
| `Learned position 42 × 128 [trainable]` | `PatchTST_backbone.py#L147`, `#L165`; `layers/PatchTST_layers.py#L96`, `#L121` (`requires_grad=learn_pe`, default True) |
| circle `+` | `PatchTST_backbone.py#L165` `u = self.dropout(u + self.W_pos)` |
| `Transformer encoder × N = 3, d = 128, h = 16` | `PatchTST_backbone.py#L183-L186`; `weather.sh#L31-L33` |
| `self-attention 42 × 42 within one channel` | batch axis is `bs*nvars` (`#L164`), and `attn_scores` is `[bs x n_heads x q_len x q_len]` with `q_len = patch_num = 42` (`#L354`, docstring `#L341-L350`) |
| `Multi-head attention h = 16, d = 128` | `PatchTST_backbone.py#L211`, `#L272-L295` |
| `Add & BatchNorm` ×2 | `PatchTST_backbone.py#L215-L218`, `#L228-L231` (`norm='BatchNorm'` is the default), `#L250-L252`, `#L260-L262` |
| `Feed-forward 128 → 256 → 128, GELU` | `PatchTST_backbone.py#L221-L224`; `weather.sh#L34`; `act="gelu"` default `#L19` |
| `Flatten + linear 42 · 128 = 5376 → 96` | `PatchTST_backbone.py#L48` (`head_nf = d_model * patch_num`), `#L57`; `Flatten_Head` `#L106-L107` |
| `RevIN denorm` | `PatchTST_backbone.py#L78-L81` |
| `Forecast 96 × 21` | `PatchTST_backbone.py#L75`; `models/PatchTST.py#L87` |
| `Linear 128 → P, one patch per token` | `PatchTST_self_supervised/src/models/patchTST.py#L156-L160` (`PretrainHead`, `nn.Linear(d_model, patch_len)`) |
| `loss: MSE on masked patches` | `src/callback/patch_mask.py#L62-L70` (`(loss * self.mask).sum() / self.mask.sum()`) |
| purple dashed link, `encoder weights carried over` | `src/learner.py#L450` `transfer_weights(..., exclude_head=True)`; `patchtst_finetune.py#L141` |

Nothing is drawn that is not in this table. No placeholder boxes were needed.

## 5. Verification: the four gates

### Gate ① render / XML parse

```
$ python -c "import xml.etree.ElementTree as ET,sys; ET.parse(sys.argv[1]); print('ok')" figure.drawio
xml ok

$ python scripts/render_view.py <outdir> figure.drawio=fig
fig.html <- figure.drawio (36204 chars)
```
Served over `http://127.0.0.1:8931/` (a per-case port, per the contamination
note in the skill). `file://` was not used.

### Gate ② check_layout.py — PASSED, 2 rounds

First run:

```
== figure.drawio ==
  edges 20, labelled 0
  FLAG  'b_e2' is painted over the text of 'Learned position 42 × 12' (4x12px) -- put them in separate bands
  FLAG  'Transformer encoder × N ' is painted over the text of 'Learned position 42 × 12' (12x20px) -- put them in separate bands
  FLAG  commit '204c21efe0b39603ad6e2ca640ef5896646ab1a9' claimed in 'Figure 1. PatchTST on the weather benchm' but not verified -- rerun with --repo <path>, or write 'commit not determined'
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
  (zone, container, and crossing flags are not auto-fixable except --fix growing; the numbers above are the fix)
```

After narrowing the position box, moving the trunk axis, and re-emitting the
cells in paint order:

```
== figure.drawio ==
  edges 20, labelled 0
  ok
```

Re-run after each later edit; the final state is:

```
$ python scripts/check_layout.py --repo <repo> figure.drawio
== figure.drawio ==
  edges 25, labelled 0
  ok
```

Two interim flags appeared during rounds 2 and 3 and were fixed by using the
numbers the script printed:

```
  FLAG  'Figure 1. PatchTST on the we' does not fit its shape (950x84) -- grow it to 950x97
  FLAG  'stacked plates: the M channe' does not fit its shape (180x18) -- grow it to 189x18
  FLAG  'masked patch, pre-training o' does not fit its shape (180x18) -- grow it to 193x18
```

Edge labels: **0**, which is the T1-M cap. Never raised with `--max`.

### Gate ③ check_render.js — PASSED, first attempt each round

Run in the viewer page via
`async () => { const s = await (await fetch('/check_render.js')).text(); return eval(s); }`.

```
round 1:  { "texts": 61, "shapes": 55, "edges": 21, "counts": {}, "flags": [] }
round 2:  { "texts": 63, "shapes": 89, "edges": 24, "counts": {}, "flags": [] }
round 3:  { "texts": 67, "shapes": 91, "edges": 26, "counts": {}, "flags": [] }
```

`flags` empty every time.

### Aspect ratio and notation

```
$ python scripts/extent.py figure.drawio
  FULL   950 x 1106  ratio 0.86:1
```

The skill's caps are on *wide* figures (1.6:1 single column, 3:1 full width).
This one is taller than wide, 0.86 : 1, so it is not over any cap, but it is a
portrait figure and will occupy most of a column's height. If you want it
shorter, the cheapest cut is the dashed "one encoder layer" band in panel 2
(cells `b_ins`, `i_mhsa`, `i_an1`, `i_ffn`, `i_an2` and the four edges around
them, about 130px of height); the encoder box above it already carries
`× N = 3, d = 128, h = 16`. I did not cut it myself because a Transformer box
with no residual/norm wiring is the named anti-pattern in this genre.

The body font cannot simply be scaled to buy width: the readability check is
`min body fontSize / canvas width ≥ 1.16%`. At 12px the canvas may not exceed
~1034px, which is why the figure is 950 wide and stacks vertically instead of
running everything across one row. Actual ratio: 12 / 950 = **1.26%**, inside
the 1.2–1.9% band the skill measured on canonical figures.

```
$ python -c "... emoji/glyph scan ..."
emoji/glyph ['→'] | font 130 / 130
```

Only `→` (U+2192) survives, which is the permitted exception. No emoji, no
`⊕ ⊗ ⊙ ⊘`, no `//`. Every one of the 130 styles carries
`fontFamily=Times New Roman`. Em-dash count: 0. All labels are English.

### Gate ③-a label dump, compared against the code

```
+
...
1   Patching: a 336 step look-back window becomes 42 patch tokens
2   Channel-independent encoder: all 21 channels share one set of weights
3   Two heads on the same encoder
42 patches × 16 per channel
Add & BatchNorm
Feed-forward | 128 → 256 → 128, GELU
Flatten + linear | 42 · 128 = 5376 → 96 | [trainable]
Forecast | 96 × 21
Learned position | 42 × 128 | [trainable]
Linear 128 → P | one patch per token | [trainable]
Look-back window | 336 × 21 (weather)
Multi-head attention | h = 16, d = 128
Patch embedding | 16 → 128 | [trainable]
PatchTST: patching and channel-independence
Reconstructed | patches
RevIN denorm
RevIN norm | per channel
Transformer encoder | [trainable]
Transformer encoder | × N = 3 | d = 128, h = 16 | [trainable]
channel 1 | 42 × 16
channel 21 | 42 × 16
encoder weights carried over
fine-tuning
loss: MSE on masked patches
masked patch, pre-training only
masked patches, ratio 0.4
one channel, 336 steps
one encoder layer
patch P = 16, stride S = 8, N = 42
pre-training
self-attention 42 × 42 | within one channel
shared trainable weights
stacked plates: the M channels
(caption, one cell, quoted in full in §7)
```

Checked one by one against §4. No typos, no clipped words, no symbol used in the
body that is missing from the legend. `RevIN`, `BatchNorm`, `GELU` match the
source spelling. `5376` was recomputed as `d_model * patch_num = 128 * 42`.
`42` was recomputed as `(336 - 16)/8 + 1 = 41`, `+1` for `padding_patch='end'`.

### My own look at the PNG, before handing it to the judge

Not a claim that I looked. What I actually saw, per item:

1. Line through a shape: none. The two arrows into `Patch embedding` and the one
   into the encoder all terminate on a box edge.
2. A line I asked for that did not get drawn: none missing. Both residual arcs
   in the encoder-layer band render, both zoom guides render, the dotted guide to
   the attention square renders. All are `edge`, none are zero-height `vertex`.
3. Lines cutting each other: none; the two residual arcs run at the same y but
   over disjoint x ranges (92–421 and 521–857).
4. Arrow landing somewhere odd: none.
5. Text outside a box: none.
6. Legend symbol vs body symbol: **this is where round 1 failed.** The legend
   said "stacked plates: the M channels", but the Transformer encoder was *also*
   drawn as three stacked plates, where it meant `× N = 3` layers. Same device,
   two meanings. I removed the encoder plates and left `× N = 3` as text in the
   box, which the code supports (repetition is not the contribution here).
7. Label sitting on someone else's border: none.
8. Spelling: see the dump above.
9. Label overflowing its shape: caught by `check_layout` three times, fixed with
   the printed numbers.
10. Small shapes: the 20 × 22 token cells and the 14 × 14 attention cells carry
    no text, so nothing turns into a smudge.
11. Invented symbols: none. The circle `+` is the standard join mark; the two
    dashed families are distinguished by arrowheads and are described below.
12. A long line crossing everything: none. The longest is the panel-3 transfer
    link, 80px, straight down between two boxes in the same column.

I also caught in round 1 that the pre-training head was labelled `Linear 128 → 12`
(the self-supervised script's `patch_len`) while panel 1 said `P = 16` (the
supervised script's). Two configurations in one figure. Changed to
`Linear 128 → P` and both configurations are now stated in the caption.

### Gate ④ independent visual gate — PASSED on round 3 of 3

A separate `general-purpose` sub-agent judged it. It got only: the rendered PNG
plus three 2× crops, the verbatim `check_layout` / `check_render` / `extent`
output, and the repository path. It did not get this report, my step breakdown,
or any statement of intent. It was told to stop and report "WRONG PAGE" if the
images were about some other project, and it was told not to open `pic/model.png`.

**Round 1 — GATE: FAIL**

```
GATE: FAIL
A1 PASS
A2 PASS
A3 PASS
A4 PASS
A5 PASS
A6 PASS  Taken from the machine check reporting no readability flag.
B1 PASS  "PatchTST converts multichannel time-series windows into patches, processes each channel with a shared Transformer, and forecasts or reconstructs the series."
B2 PASS
B3 PASS
B4 FAIL  Panels 1–3 show what is shared and shortened, but no structural comparison or mechanism explains why channel independence and two heads are preferable.
B5 PASS  “RevIN norm per channel” and “RevIN denorm” describe operations rather than merely exposing identifiers.
B6 PASS  No unexplained shape.
C1 PASS
C2 PASS
C3 PASS
C4 PASS
C5 PASS
D1 PASS
D2 PASS  Diagonal dashed lines are unheaded inset guides; right-angled dashed lines with arrowheads are residual paths.

Things to fix, most important first:
1. Structurally show the motivation or benefit of channel independence and the dual-head design.
```

What I changed: added the 42 × 42 self-attention square beside the encoder (it
makes the shortened sequence and the per-channel scope visible at once), and
turned panel 3 from two parallel islands into an order with a coloured dashed
transfer link plus a legend row for it. `render-r1.png` is the render as it stood
when this verdict was given.

**Round 2 — GATE: FAIL**

```
GATE: FAIL
A1 PASS
A2 PASS
A3 PASS
A4 PASS
A5 PASS
A6 PASS  Taken from the machine check reporting no readability flag.
B1 PASS  "PatchTST pre-trains a channel-independent Transformer by reconstructing masked time-series patches, then reuses it for forecasting."
B2 PASS
B3 FAIL  The “encoder weights carried over” arrow runs from “Reconstructed patches” toward “Flatten + linear”; neither endpoint represents the encoder.
B4 FAIL  Panel 3 asserts weight transfer through its legend, but does not structurally show the encoder being trained and transferred; Panel 2 still shows channel independence without showing why it is beneficial.
B5 PASS
B6 FAIL  The purple dashed arrow beside “Reconstructed patches” makes its source unclear: reconstructed outputs should not be the transferred encoder weights.
C1 PASS
C2 PASS
C3 PASS
C4 PASS
C5 PASS
D1 PASS
D2 PASS  Unheaded dashed lines are detail guides; arrowheaded right-angle dashed lines are residual paths.
E1 FAIL  The Panel 2 grid clearly depicts within-channel attention and earns its place. The Panel 3 arrow is explained by the legend but contradicts its endpoints, making it misleading rather than explanatory.
E2 PASS  The visible 6×6 icon, “42 × 42” label, and caption’s “schematic” wording prevent a literal square-count interpretation.

Things to fix, most important first:
1. Connect the purple transfer arrow between explicit encoder representations, not reconstructed output and forecasting head.
2. Structurally show the motivation or benefit of channel-independent attention.
```

This was correct and I had got it wrong: `transfer_weights` copies the backbone,
not the reconstruction, and it copies it into the same backbone under a new head.
Panel 3 was rebuilt as two rows, same chain, one element changed: each row now
opens with its own `Transformer encoder` box and the dashed link joins those two
boxes.

**Round 3 — GATE: PASS**

```
GATE: PASS
A1 PASS
A2 PASS
A3 PASS
A4 PASS
A5 PASS
A6 PASS  Taken from the machine check reporting no readability flag.
B1 PASS  "PatchTST patches multichannel time series, processes channels independently with shared Transformer weights, and transfers a reconstruction-pretrained encoder to forecasting."
B2 PASS
B3 PASS
B4 PASS  Panel 1 shows 336 steps reduced to 42 attention tokens; Panel 2 shows shared per-channel processing; Panel 3 structurally shows the pretrained encoder copied into fine-tuning while only the head changes.
B5 PASS
B6 PASS
C1 PASS
C2 PASS
C3 PASS
C4 PASS
C5 PASS
D1 PASS
D2 PASS  Unheaded dashed grey lines are detail guides; arrowheaded right-angled lines are residual paths.
E1 PASS  The grid explains within-channel attention; the purple arrow now connects encoder to encoder and clearly represents useful weight transfer.
E2 PASS  The “42 × 42” label and explicitly schematic grid prevent literal counting.
F1 PASS  The portrait shape reinforces the numbered top-to-bottom progression.

Things to fix, most important first:
1. None. Any deeper empirical justification for channel independence would require paper or experimental material not derivable from repository code alone.
```

Summary: gate ② passed after 2 rounds, gate ③ passed first try in every round,
gate ④ passed on round **3 of the 3 allowed**.

## 6. Assumptions, and things I chose not to claim

1. **One configuration, stated.** The supervised numbers are `weather.sh`. A
   different script gives different numbers (ETTh1 uses `d_model 16`, `n_heads 4`,
   `d_ff 128`). The caption names the script so a reader can check.
2. **`N = 42` includes the padding patch.** `patch_num` is 41 from the formula
   and becomes 42 because `padding_patch` defaults to `'end'`
   (`run_longExp.py#L45`), which appends one stride via `ReplicationPad1d`.
3. **The attention square is schematic.** Six cells per side, not 42. The label
   and the caption both say the real matrix is 42 × 42, so no count is being
   claimed. The gate specifically checked this (E2) and agreed.
4. **RevIN's affine parameters.** `--affine` defaults to 0 in `run_longExp.py`,
   so in the default supervised configuration RevIN has no learnable parameters.
   I gave it no `[trainable]` marker rather than assert one, and did not clutter
   the box with `affine = 0`.
5. **`series_decomp` is not drawn.** `models/PatchTST.py#L50-L68` has a second,
   two-branch path when `decomposition` is set, but `--decomposition` defaults
   to 0, so it is off in every script in `scripts/PatchTST/`. Drawing a branch
   the shipped scripts never take would have made the figure claim something the
   repository does not do.
6. **`individual` heads are not drawn** for the same reason (`--individual`
   defaults to 0).
7. **`shared_embedding=False`** exists in the self-supervised encoder
   (`src/models/patchTST.py#L189-L193`, a `ModuleList` of per-channel `W_P`),
   but the default is `True` and `patchtst_pretrain.py#L80` passes `True`
   explicitly. Only the default is drawn.
8. **No inter-panel arrows.** The three panels are ordered by their numbers,
   which is the single reading-order device; arrows order things *within* a
   panel. The gate checked this (C1) in all three rounds.
9. **No images were embedded.** Nothing was generated, and nothing from
   `pic/` was used.
10. **The one thing the figure does not say** is the *empirical* benefit of
    channel-independence. That argument lives in the paper, which was out of
    scope by your instruction. The figure shows the mechanism (one weight set,
    attention never crossing a channel) and stops there. The judge confirmed on
    round 3 that this is not derivable from the repository alone.

## 7. Caption, verbatim

Cell `id=cap`, one cell:

> Figure 1. PatchTST on the weather benchmark (M = 21 channels, look-back
> L = 336, horizon T = 96; scripts/PatchTST/weather.sh). A look-back window is
> cut into N = 42 patches of length P = 16 at stride S = 8, so the Transformer
> attends over 42 tokens rather than 336 time steps, and consecutive windows
> overlap because S is smaller than P. The channel axis is then folded into the
> batch axis, so all 21 channels pass through one set of weights and no attention
> is ever computed across channels. The attention square in panel 2 is schematic:
> the matrix is 42 × 42 and is formed inside a single channel. The two rows of
> panel 3 are the same chain with one element changed, the head: fine-tuning
> copies every pre-trained weight except the head, so the dashed link runs from
> the encoder trained by reconstruction to the same encoder under the forecasting
> head. Every number is a default in the repository scripts; the self-supervised
> script has its own defaults (L = 512, P = S = 12, again N = 42). Repository
> commit 204c21efe0b39603ad6e2ca640ef5896646ab1a9.

## 8. What you can delete, and what goes with it

| delete | and you lose |
|---|---|
| `id=cap` | the caption, one cell, nothing else moves |
| `id=ttl` | the title. Papers usually do not want one; slides do |
| `id=legend` (a group) | the whole legend in one click, background and all four rows, no fragments left behind |
| `id=b_ins` plus `i_mhsa`, `i_an1`, `i_ffn`, `i_an2` and the six edges inside it | the expanded encoder layer, and about 130px of height. The encoder box above keeps `× N = 3, d = 128, h = 16` |
| `id=b_att` and the `att**` cells | the attention square. Panel 2 still shows the shared encoder, but the "42 tokens, one channel" point weakens |
| `pA` / `pB` / `pC` | the panel backgrounds and their numbers, i.e. the reading order |

Everything else is a leaf shape or an edge and can be moved without side effects.
Cells are emitted in paint order (containers, then edges, then shapes), so if you
add a box, add it at the end of `<root>`; if you add an arrow, put it before the
shapes or re-run the reordering described below.


## (이 절은 공개본에서 제외되었다)

원문 보고서의 이 위치에는 스킬 자체의 도구·지침에 대한 내부 검토 내용이 있다.
도면의 결함이 아니라 도구의 결함에 관한 기록이라 공개본에서는 제외하였다.
게이트가 검출한 도면 결함은 위 절들에 그대로 남아 있다.
