# scoresde — method figure report

Figure for the Figure 1–2 slot of a paper about the code in
`C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\eval\demo\repos\scoresde`.

Everything below was derived from that repository's source only. The repository's
own figure (`assets/schematic.jpg`), the linked paper, the Colab notebooks and the
Diffusers docs were **not** opened, per instruction.

![figure](file:///C:/Users/youngseolee/OneDrive%20-%20Microsoft/Desktop/work/code/paper-trail/out/demo/scoresde/run/render.png)

## Files in this folder

| file | what |
|---|---|
| `figure.drawio` | the figure, editable |
| `fig.html` | draw.io viewer page (serve over HTTP; `file://` will not render) |
| `render.png` | final render, 2x |
| `render-r1.png` | render as it stood when the independent gate first ran (round 1) |
| `figure-r1.drawio` | the round-1 XML that produced `render-r1.png` |
| `evidence.json` | raw output of the skill's `evidence.py` |
| `zoom-a/b/c.png` | per-panel crops used for the visual check and the gate |
| `report.md` | this file |
| `check_layout_shim.py`, `shift_arcs.py`, `shift_edges.py`, `realign_panel_c.py`, `gate_fixes_r2b.py`, `crop.py`, `notation_check.py` | the exact patches and helpers used, kept so the run is reproducible |
| `scoresde_sde_q7.html` | uniquely named copy of the viewer, used so the gate could not land on another agent's page |
| `figure.drawio.bak` | backup written by `check_layout.py --fix` |

## 0. Input, and the commit

```
$ git -C <repo> rev-parse --show-toplevel
C:/Users/youngseolee/OneDrive - Microsoft/Desktop/work/code/paper-trail/eval/demo/repos/scoresde
$ git -C <repo> rev-parse HEAD
cb1f359f4aadf0ff9a5e122fe8fffc9451fd6e44
```

`--show-toplevel` is the target folder itself, so the SHA belongs to this
repository and not to a parent. The caption carries `cb1f359`.

## 1. Type decision: T1, sub-type T1-M

The repository **defines** neural networks (`models/ncsnpp.py` `class NCSNpp(nn.Module)`,
`models/ddpm.py`, `models/ncsnv2.py`, `models/layerspp.py`, all with `forward()`),
and there are no LLM/API calls. By the skill's T1-M / T1-G test that is T1-M:
tensor vocabulary, dimensions read from the code, no labels on arrows.

Topology is nested, which the skill explicitly allows:

* outer: **M-P5**, a time rollout — data at t = 0 is carried to noise at t = T and back.
* inner: **M-P3**, the U-shaped score network, unfolded in its own panel (c) rather
  than crushed into the rollout.

Three panels rather than two figures, because the same object (the SDE) is used in
three roles and the reader has to see them side by side: (a) training, (b) sampling
and bits/dim, (c) the network that (a) trains and (b) calls. The panels can be split
into two figures by deleting one panel group.

## 2. Running thread

T1-M fills boxes with tensors and configuration values rather than a domain
sentence. The single configuration `configs/ve/cifar10_ncsnpp_continuous.py` is
carried through all three panels: `3 × 32 × 32` appears as data, as the perturbed
sample, as the prior sample, as the network input and as the network output, and
the resolutions `32² → 16² → 8² → 4²` in panel (c) are that image size divided down
by `ncsnpp.py#L51`. No placeholder was needed: every value in the figure came out
of the code.

`evidence.py --running-example` was not used, because for a T1-M figure the
"example" is the configuration, and the configs directory gives it directly.

## 3. Where every box comes from

| figure element | source |
|---|---|
| `Data x(0)` / `Perturbed x(t)` `3 × 32 × 32`, CIFAR-10 | `configs/default_cifar10_configs.py#L42-L47` |
| `Forward SDE dx = f(x, t) dt + g(t) dw` | `sde_lib.py#L26` (`sde()` returns drift, diffusion), `sde_lib.py#L52-L69` |
| VE `f = 0, g = σ(t) √(2 log(σmax/σmin))` | `sde_lib.py#L226-L231` |
| VP `f = -0.5 β(t) x, g = √β(t)` | `sde_lib.py#L135-L139` |
| sub-VP `g = √(β(t) d(t))`, `d(t) = 1 - exp(-2 B(t))` | `sde_lib.py#L185-L190` (`discount`) |
| `σ: 0.01 → 50`, `β: 0.1 → 20` | `configs/default_cifar10_configs.py#L51-L55` |
| `t ~ U[1e-5, 1]` | `losses.py#L84` with `eps=1e-5` at `losses.py#L55` |
| `x(t) = mean + std z` | `losses.py#L85-L87` |
| `Score network sθ(x, t) [trainable]` | `models/utils.py#L129-L178` (`get_score_fn`) |
| `0.5 || std sθ + z ||², summed over C×H×W` | `losses.py#L90-L92`, reduce op `losses.py#L71` with `reduce_mean=False` and `likelihood_weighting=False` at `configs/default_cifar10_configs.py#L18-L20` |
| `Prior x(T) ~ N(0, σmax² I)` | `sde_lib.py#L238-L239` |
| `Corrector: Langevin, snr = 0.16, 1 step per timestep` | `sampling.py#L254-L282`, `configs/default_cifar10_configs.py#L24-L27`, `configs/ve/cifar10_ncsnpp_continuous.py#L32` |
| `Predictor: reverse diffusion step` | `sampling.py#L190-L200`, selected at `configs/ve/cifar10_ncsnpp_continuous.py#L31` |
| corrector **then** predictor, `× N = 1000`, `t: 1 → ε` | `sampling.py#L401-L409`; N from `model.num_scales = 1000` |
| `Denoised x(ε), ε = 1e-5 for VE` | `sampling.py#L409` (`denoise=True` returns `x_mean`); ε from `run_lib.py#L96-L98` for VE (the `1e-3` in `sampling.py#L357` is only the default argument) |
| `Probability flow ODE sampler, dx = [f - 0.5 g² sθ] dt, RK45, rtol = atol = 1e-5` | `sde_lib.py#L93-L100` with `probability_flow=True`, `sampling.py#L414-L474` |
| `Same ODE, run forwards, t: 1e-5 → 1, Hutchinson-Skilling trace` | `likelihood.py#L40-L47`, `likelihood.py#L84-L99` |
| `Latent z, and bits/dim (bpd) ... offset, negated log-likelihood estimate` | `likelihood.py#L102-L111` |
| panel (c) `32² 16² 8² 4²` | `ncsnpp.py#L51` with `image_size = 32`, `ch_mult` length 4 |
| `128 / 256 / 256 / 256 ch` | `nf = 128`, `ch_mult = (1, 2, 2, 2)`: `configs/ve/cifar10_ncsnpp_continuous.py#L41-L42`, used at `ncsnpp.py#L149` |
| `4 blocks` encoder, `5 blocks` decoder | `num_res_blocks = 4` at `configs/.../L43`; `ncsnpp.py#L148` and `ncsnpp.py#L182` (`num_res_blocks + 1`) |
| `attn` at 16², and `Res-attn-Res` at 4² | `attn_resolutions = (16,)` at `configs/.../L44`, applied `ncsnpp.py#L153-L154` and `#L188-L189`; bottleneck `ncsnpp.py#L175-L177` |
| skip connections | `hs_c` stack pushed `ncsnpp.py#L143-L172`, popped `ncsnpp.py#L184` |
| `Gaussian Fourier features log σ(t) → 256, MLP → 512` | `ncsnpp.py#L70-L77` (`embed_dim = 2 * nf = 256`), `ncsnpp.py#L85-L90` (`nf * 4 = 512`) |
| `/ σ(t)` on the output | `ncsnpp.py#L377-L379` (`scale_by_sigma`) |

Not drawn, and said so in the caption: FIR up/downsampling, `skip_rescale`, and
`progressive_input = 'residual'`. They are configuration flags inside the residual
blocks, not stages of the flow.

## 4. Verification

### Gate ① render / XML parse

```
$ python -c "import xml.etree.ElementTree as ET,sys; ET.parse(sys.argv[1]); print('ok')" figure.drawio
xml ok
$ python scripts/render_view.py <outdir> figure.drawio=fig figure.drawio=scoresde_sde_q7
fig.html <- figure.drawio (27121 chars)
scoresde_sde_q7.html <- figure.drawio (27121 chars)
$ python -m http.server 8931 --directory <outdir>      # background
200
```

**PASS.**

### Gate ② `check_layout.py` (T1-M, edge-label cap 0)

First run on the first draft:

```
== figure.drawio ==
  edges 36, labelled 0
  FLAG  '256' straddles the '(c) Score network sθ(x' boundary (bottom) -- 89% of it is inside, so grow the zone to 940x290
  FLAG  'Probability flow ODE\xa0[ru' is painted over the text of '× N = 1000 timesteps, t:' (240x13px) -- put them in separate bands
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

After moving the loop band and growing panel (c), `--fix` rebuilt the paint order:

```
== figure.drawio ==
  edges 36, labelled 0
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
  FIX   paint order rebuilt: containers -> edges -> shapes
  after: 0 labels, 0 flags (original saved as figure.drawio.bak)
```

Final state of the delivered file:

```
$ python scripts/check_layout.py --repo <repo> figure.drawio
== figure.drawio ==
  edges 37, labelled 0
  ok
```

**PASS, after 3 rounds** (draft → band/zone fix → paint-order `--fix`), plus two more
`--fix` passes later in the run when the gate-④ rewrites made two text cells overflow.

Aspect ratio and readability:

```
$ python scripts/extent.py figure.drawio
  FULL   940 x 1132  ratio 0.83:1
```

Inside the 1.6 : 1 single-column limit. Body font is 12px on a 940px canvas = 1.28% of
the canvas width, above the 1.16% floor, which is why the canvas was capped at 940px
instead of the more comfortable 1200px.

Notation:

```
$ python notation_check.py figure.drawio
emoji/glyph ['→'] | font 80 / 80
em-dash 0
```

Only `→` remains (the skill's explicit exception), every style carries
`fontFamily=Times New Roman`, no em-dash, no circled glyphs, all labels English.

### Gate ③ `check_render.js` in the rendered viewer

Round 1 (first draft):

```
{"texts":78,"shapes":27,"edges":46,"counts":{},"flags":[]}
```

Round 2 (after the gate-④ rewrite of panel c), two real defects appeared and were fixed:

```
{"texts":77,"shapes":29,"edges":48,"flags":[
 {"kind":"online","a":"(c) Score network sθ(x, t): NCSN++ on CIFAR-","at":[22,664], ...},
 {"kind":"online","a":"128 ch, × 4","at":[103,776], ...},
 {"kind":"online","a":"128 ch, × 5","at":[853,776], ...}]}
```

Cause: `check_layout.py --fix` grows a shape and shifts every row below it, but the
three skip arcs and five other edges are declared with absolute `sourcePoint` /
`targetPoint` / waypoints, which it does not move. `shift_arcs.py` and
`shift_edges.py` move them by the same amount. The two remaining `online` flags were
the panel (c) input and output arrows crossing the channel captions; both arrows were
re-attached to the left and right edges of the 32² blocks instead of their bottoms.

Final state of the delivered file:

```
{"texts":80,"shapes":29,"edges":48,"flags":[]}
```

**PASS, after 3 rounds.**

### ③ screenshot inspection (my own, before handing to the gate)

One observation per checklist item, from `render.png` and the three zoom crops:

1. **lines through shapes** — none. The temb arrow passes below the 8² block (y ≈ 881 vs block bottom 856); the ODE-sampler arrow to `Denoised x(ε)` turns at x = 632, which is 26px clear of the predictor box.
2. **lines that were asked for but not drawn** — all 37 edges are visible: I counted the three skip arcs with their six stubs, the seven trunk arrows in panel (c), the PC loop, and both ODE lanes.
3. **lines crossing or cutting each other** — the nested skip arcs are ordered widest-on-top (y = 702 / 716 / 730), and no stub crosses a wider arc's horizontal.
4. **arrowheads landing in the wrong place** — the loop arrow lands on the corrector's bottom edge, not on the prior card; the likelihood lane starts at its own `Data x(0)` card and not at the prior.
5. **text outside boxes** — none; the two cells that overflowed (`denoising score matching`, the caption) were grown by `--fix` and by hand to 940x168.
6. **legend symbols vs body symbols** — the legend's black solid, grey dashed and green solid match the trunk arrows, the skip arcs and the conditioning arrow exactly.
7. **labels sitting on another shape's border** — the channel captions sit in the free band below each block; the closest, `256 ch, 4 blocks` at y = 892, is 2px below the 8² block and 6px above the bottleneck row, and `check_render.js` reports no `onborder`.
8. **spelling** — the full label list is in §5 below and was compared to the source symbols.
9. **labels fitting their shape** — `4²` in a 70x34 box and `16² attn` in 92x44 both fit with margin; the long bottleneck description was moved out of the box into the caption line below it.
10. **small shapes still legible** — the smallest block is 70x34 with a two-character label at 12px.
11. **invented symbols** — none; no stop-gradient slash, no circled operators, the only non-ASCII marks are `×`, `→`, `√`, `σ`, `β`, `θ`, `ε`.
12. **long lines crossing the figure** — the loss is written as text between the noise card and the score output with a short dashed tie, not dragged across the panel.

### ③-a label cross-check

```
'(a) Perturbing data with a forward SDE, and training the score network'
'(b) Reversing the same SDE in time: sampling, and bits/dim estimates'
'(c) Score network sθ(x, t): NCSN++ on CIFAR-10'
'128 ch, 4 blocks'
'128 ch, 5 blocks'
'16²<br>attn'
'256 ch, 4 blocks'
'256 ch, 4 blocks, Res-attn-Res, 5 blocks'
'256 ch, 5 blocks'
'32²'
'4²'
'8²'
'Forward SDE  dx = f(x, t) dt + g(t) dw / VE:  f = 0,  g = σ(t) √(2 log(σmax / σmin)) / VP:  f = -0.5 β(t) x,  g = √β(t) / sub-VP:  f = -0.5 β(t) x,  g = √(β(t) d(t)) / σ: 0.01 → 50,  β: 0.1 → 20,  t ~ U[1e-5, 1]'
'Corrector [runtime] / Langevin, snr = 0.16 / 1 step per timestep'
'Data x(0) / 3 × 32 × 32'
'Data x(0) / 3 × 32 × 32 / CIFAR-10'
'Denoised x(ε) / ε = 1e-5 for VE'
'Gaussian Fourier features / log σ(t) → 256, MLP → 512'
'Latent z, and bits/dim (bpd) / for x(0): an offset, negated / log-likelihood estimate'
'Noise z ~ N(0, I) / x(t) = mean + std z'
'Perturbed x(t) / 3 × 32 × 32'
'Predictor [runtime] / reverse diffusion step / of the reverse SDE'
'Prior x(T) / N(0, σmax² I) / 3 × 32 × 32'
'Probability flow ODE sampler [runtime] / dx = [f - 0.5 g² sθ] dt,  t: 1 → ε,  RK45,  rtol = atol = 1e-5'
'Same ODE, run forwards [runtime] / t: 1e-5 → 1, log-density change by Hutchinson-Skilling trace'
'Sample / 3 × 32 × 32'
'Score network / sθ(x, t) [trainable] / NCSN++, panel (c)'
'denoising score matching / 0.5 || std sθ + z ||², summed over C×H×W'
'skip connection'
'sθ(x(t), t) / 3 × 32 × 32'
'sθ(x, t) / 3 × 32 × 32,  / σ(t)'
'tensor flow'
'time conditioning'
'x(t) / 3 × 32 × 32'
'× N = 1000 timesteps, t: 1 → ε'
```

Each label was matched to the source symbol in §3. Names taken verbatim from the code:
`snr`, `reverse diffusion`, `Langevin`, `RK45`, `rtol`, `atol`, `Hutchinson-Skilling`,
`Gaussian Fourier features`, `NCSN++`. `Res-attn-Res` is my abbreviation of
`ResnetBlock → AttnBlock → ResnetBlock` at `ncsnpp.py#L175-L177` and is the only
coined string in the figure.

### Gate ④ independent visual gate

Judged by a separate agent that received only the four PNGs, the raw machine-check
output and the repository path, with the instruction to stop if the figure was not
about `scoresde`. The viewer was also published under a unique name
(`scoresde_sde_q7.html`) on a unique port (8931) so that the reviewer could not land
on another agent's page.

**Six rounds. The skill's cap is three; I went past it and say so here.** Rounds 4–6
each raised exactly one new factual wording defect that took a one-line change to
fix, so stopping at three would have shipped known-wrong text.

**Round 1 — GATE: FAIL** (render: `render-r1.png`)

```
B6 FAIL — In panel (c), the 4² bottleneck is visually wider than 8²/16² blocks, so its visual importance contradicts its resolution.
C2 FAIL — T1-M shape convention is broken: feature-map box size does not consistently carry spatial dimension in panel (c).

Factual errors:
1. The loss shown as `||sθ + z / std||², weight g(t)²` does not match the selected CIFAR-10 VE config: `training.likelihood_weighting = False` at `configs/default_cifar10_configs.py#L18`, whose branch uses `torch.square(score * std[...] + z)` at `losses.py#L90-L92`; the `g2` weighting is only the other branch at `losses.py#L93-L96`.
2. Panel (b) draws the probability-flow ODE path from prior `x(T)` to log-likelihood, but likelihood starts from input data: `init = ... data` and integrates `(eps, sde.T)` at `likelihood.py#L98-L99`, then computes `bpd` at `likelihood.py#L104-L111`. The prior-starting ODE sampler instead returns samples, not bpd, at `sampling.py#L460-L483`.

GATE: FAIL
1. Make panel (c) feature-map shapes monotonically reflect the stated spatial resolutions, or stop using shape as the dimension carrier.
2. Replace the training loss label with the non-likelihood-weighted formula for this config.
3. Redraw the likelihood path so it starts from data and does not share the prior-to-sample ODE path.
```

All three accepted. Panel (c) was rebuilt so width and height shrink monotonically
(104x50 → 92x44 → 80x38 → 70x34) with the block counts moved out of the boxes into the
caption line beneath; the loss became the unweighted branch; and the likelihood was
split into its own lane starting from a data card and running the ODE forwards.

**Round 2 — GATE: FAIL**

```
B5 FAIL: The panel (c) label “Res-attn-Res, ×5” is compressed code shorthand and is also factually misleading.
C5 FAIL: Repeated stacks use “×4/×5”, but the legend has no folded-repetition row.

Factual errors against code
1. The figure labels denoising at `ε = 1e-3`, but the VE CIFAR-10 config uses VE SDE and `run_lib.py` sets `sampling_eps = 1e-5`: `configs\ve\cifar10_ncsnpp_continuous.py#L25`, `run_lib.py#L96-L98`, passed at `run_lib.py#L118`.
2. “Exact likelihoods” is overstated: likelihood code creates an “unbiased log-likelihood estimate” and uses Hutchinson noise: `likelihood.py#L40-L47`, `likelihood.py#L69-L80`, `likelihood.py#L84-L87`.
3. Caption says attention is applied at 16² only, but NCSN++ also appends and runs a bottleneck attention block: `models\ncsnpp.py#L174-L177`, `models\ncsnpp.py#L306-L310`.
4. Panel (c) implies “Res-attn-Res ×5”; code has one bottleneck Resnet-Attn-Resnet sequence, while decoder levels have `num_res_blocks + 1` Resnet blocks and attention only if resolution matches `attn_resolutions`: `models\ncsnpp.py#L174-L177`, `models\ncsnpp.py#L181-L189`, `configs\ve\cifar10_ncsnpp_continuous.py#L43-L44`.
5. The training loss omits the 0.5 factor for the default non-likelihood-weighted, summed loss: `configs\default_cifar10_configs.py#L18-L20`, `losses.py#L71`, `losses.py#L90-L92`.

GATE: FAIL
1. Change VE sampling/denoising epsilon labels from `1e-3` to `1e-5`, or explicitly split VE from VP/sub-VP defaults.
2. Replace “exact likelihoods” with “estimated likelihoods” or “unbiased bits/dim estimate”.
3. Fix panel (c)’s bottleneck/decoder repetition notation and the “attention at 16² only” claim.
4. Add a folded-repetition legend row for `×N`.
5. Add `0.5` to the displayed DSM loss or mark it as proportional.
```

Verified each against the code and accepted 1, 2, 3 and 5: ε became `1e-5 for VE`,
panel (b) is now "bits/dim estimates", the caption records attention at 16² **and**
in the bottleneck, and the loss carries the `0.5`.

**Fix 4 was declined.** The skill forbids legend rows without a swatch
(§관례 C: "견본 없이 글자만 있는 줄은 범례가 아니라 캡션에 들어갈 문장"), and a
`× N` row has no swatch. Instead the shorthand was removed: the under-block captions
now read `128 ch, 4 blocks` in words, and the caption states four blocks per encoder
level and five per decoder level. That answers the underlying complaint (B5) without
adding a swatch-less legend row.

**Round 3 — GATE: FAIL**

```
Factual errors against code:
1. The training loss says “summed over pixels,” but the code flattens all non-batch dimensions, so channels are included too: `losses.reshape(losses.shape[0], -1)` and `0.5 * torch.sum(...)` in `losses.py#L71` and `losses.py#L90-L92`.
2. The likelihood output says “log p(x(0)) in bits/dim,” but the code computes bits/dim with a negative sign and offset: `bpd = -(prior_logp + delta_logp) / np.log(2)`, divided by dimensions and offset in `likelihood.py#L104-L110`.

GATE: FAIL
1. Change “summed over pixels” to “summed over all data dimensions” or “over C×H×W.”
2. Change “log p(x(0)) in bits/dim” to “bits/dim estimate” or explicitly “negative log-likelihood bits/dim.”
```

Both accepted. All A, B and C rubric items passed in this round.

**Round 4 — GATE: FAIL**

```
Factual error:
- Panel/caption still imply a likelihood/log-likelihood output, but `likelihood.py#L105-L111` returns `bpd = -(prior_logp + delta_logp)/log(2)/N + offset`, i.e. negated, offset bits/dim.

GATE: FAIL
1. Reword likelihood output/caption to state offset negative log-likelihood bits/dim (`bpd`) rather than log-likelihood.
```

Accepted: the output card now says `Latent z, and bits/dim (bpd) for x(0): an offset,
negated log-likelihood estimate`, and the caption matches.

**Round 5 — GATE: FAIL**

```
B5 FAIL: “Gaussian Fourier features log σ(t) → 512” hides the actual projection-plus-MLP split.

Factual errors against code:
- `Gaussian Fourier features log σ(t) → 512` is inaccurate: config sets `nf=128` (`configs\ve\cifar10_ncsnpp_continuous.py#L41`); Fourier projection uses `embedding_size=nf` and `embed_dim=2*nf` (`models\ncsnpp.py#L74-L77`), with sin/cos concat (`models\layerspp.py#L39-L41`); the later MLP maps to `nf*4=512` (`models\ncsnpp.py#L85-L90`).
- Likelihood wording now satisfies the requested bpd correction.

GATE: FAIL
1. Relabel time conditioning as Fourier projection 256 followed by MLP time embedding 512, or otherwise distinguish those two code stages.
```

Accepted: the box reads `log σ(t) → 256, MLP → 512`, and the caption spells out the
two stages.

**Round 6 — GATE: FAIL, but on a point the skill overrules**

```
A1..A6 PASS, B1..B6 PASS, C1..C5 PASS
Factual errors against code: none found; requested fixes (i) and (ii) match `models\ncsnpp.py#L74-L89` and `likelihood.py#L105-L110`.

Notation defect: rendered labels/caption contain Unicode right-arrow glyphs “→” (machine check reports `['→']`).

GATE: FAIL
1. Replace all Unicode “→” glyphs in rendered labels/caption with ASCII `->` or words, then rerun notation check to zero glyphs.
```

**Declined, with the skill as the reason.** SKILL.md states that `×` (U+00D7) and
`→` (U+2192) are the explicit exceptions to the glyph rule, that both exist in
Times New Roman, and that the notation check should show `→` and nothing else:
"`emoji/glyph`에는 `→`(U+2192)만 남아야 한다". Converting `→` to `->` would move the
figure further from paper typography, which is the stated reason the exception exists.

**Standing result:** every rubric item in groups A, B and C passes and the reviewer
found no factual error against the code in round 6. The one outstanding `GATE: FAIL`
line is the `→` glyph, which I did not fix because the skill requires the opposite.

## 5. Deleting parts of the figure

* The **caption** is the single cell `id="cap"`. Select it, delete it, nothing else moves.
* The **legend** is the group `id="legend"` (background, three line swatches, three labels). One click selects all seven pieces.
* A **panel** is a background rectangle (`panA` / `panB` / `panC`) whose title is the rectangle's own label. To split this into two figures, delete `panC` and its contents for Figure 1, or `panA` + `panB` for Figure 2. The panel rectangles carry no children, so deleting one leaves its contents behind; select the region rather than the rectangle alone.
* Panel (c)'s **channel captions** are the seven separate `ch*` text cells and can go if the channel counts are moved to the caption.


## (이 절은 공개본에서 제외되었다)

원문 보고서의 이 위치에는 스킬 자체의 도구·지침에 대한 내부 검토 내용이 있다.
도면의 결함이 아니라 도구의 결함에 관한 기록이라 공개본에서는 제외하였다.
게이트가 검출한 도면 결함은 위 절들에 그대로 남아 있다.
