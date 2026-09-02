# SwAV — 논문 Figure 1 방법론 그림 제작 보고서

- 대상 저장소: `C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\eval\demo\repos\swav`
- `git rev-parse --show-toplevel` = 대상 경로와 동일 ✔, `HEAD` = `06b1b7cbaf6ba2a792300d79c7299db98b93b7f9` (캡션에 `06b1b7c`)
- 산출물: `figure.drawio`, `fig.html`, `report.md` (이 폴더)
- 입력 제한 준수: **이 저장소의 코드/스크립트만** 읽었다. 논문, 저자 그림, README가 링크한 외부 이미지는 열지 않았다. 웹 검색 0건.

---

## 1. 판별

| 질문 | 답 | 근거 |
|---|---|---|
| T1인가 T2인가 | **T1 (논리 구조)** | 요청이 "논문 Figure 1 자리에 들어갈 방법론 그림". 프로젝트 실행 흐름이 아니라 방법의 내부 논리 |
| T1-M인가 T1-G인가 | **T1-M (모델 구조)** | `src/resnet50.py`에 `nn.Module` 서브클래스 3개(`Bottleneck`, `ResNet`, `MultiPrototypes`)와 `forward()`·`forward_backbone()`·`forward_head()`, `__init__`의 채널 인자(`width_per_group`, `hidden_mlp`, `output_dim`, `nmb_prototypes`)가 있다. LLM/API 클라이언트 호출 0건 |
| 위상 | **M-P6 변형 (두 갈래 + 교환 예측)** | `main_swav.py#L290-L315`: `crops_for_assign=[0,1]` 두 갈래가 서로의 code를 예측한다. 가중치가 갈래마다 다른 teacher–student가 아니라 **한 네트워크를 모든 crop이 공유**하므로, teacher 회색 처리 대신 "shared weights" 점선으로 표기 |

`evidence.py` 실행 결과(요약): `components=20 losses=4`, `nn.Module` 계열 컴포넌트 `conv1/bn1/…/layer1..layer4/projection_head/prototypes`. 이 결과 자체가 T1-M 판별의 실측 근거다. (`evidence.json`은 3파일 제약 때문에 작업 후 삭제)

**관통 예시**: T1-M이므로 도메인 문장이 아니라 **텐서·설정값**을 관통시켰다. 한 벌의 실제 설정으로 `scripts/swav_800ep_pretrain.sh`를 골라 그림 전체(crop 크기·scale, `d=128`, `K=3000`, `τ=0.1`, `ε=0.05`, Sinkhorn 3회, 313 iters)를 그 한 벌로 채웠고 캡션에 출처를 적었다. 사용자에게 따로 물은 것은 없다.

---

## 2. 각 박스의 근거

| 그림 요소 | 라벨 | 근거 |
|---|---|---|
| 입력 카드 | Training image / labels unused | `src/multicropdataset.py#L56` `path, _ = self.samples[index]` (라벨 버림) |
| Global crop ×2 | 3 × 224 × 224, scale 0.14 to 1.0 | `scripts/swav_800ep_pretrain.sh` `--nmb_crops 2 6`, `--size_crops 224 96`, `--min_scale_crops 0.14 0.05`, `--max_scale_crops 1. 0.14`; `multicropdataset.py#L42-L52` |
| Local crops × 6 | 3 × 96 × 96 | 같은 스크립트 + `multicropdataset.py#L52` `* nmb_crops[i]` |
| 사다리꼴 backbone | ResNet-50 [trainable] | `src/resnet50.py#L340-` `resnet50()`, `main_swav.py#L150-L155` |
| `224² → 7²` / `96² → 3²` | 해상도 감소 (실루엣이 나르는 값) | `resnet50.py#L176` conv1 `stride=2`, `#L180` maxpool `stride=2`, `#L184/188/192` layer2·3·4 `stride=2` → 224→112→56→28→14→7 |
| `64 → 2048 ch` | 채널 증가 | `resnet50.py#L174` `num_out_filters = width_per_group(64)`, `#L182/186/190` `*= 2`, `Bottleneck.expansion = 4` → 512×4 = 2048 |
| Projection head | 2048 → 2048 → 128, unit-norm | `resnet50.py#L205-L210` `Linear(2048, hidden_mlp=2048) → BN → ReLU → Linear(2048, output_dim=128)`, `#L301-L302` `normalize(dim=1, p=2)` |
| Prototypes C | 128 × 3000 [trainable], gradients off first 313 iters | `resnet50.py#L217` `nn.Linear(output_dim, nmb_prototypes, bias=False)`; `main_swav.py#L67` `--nmb_prototypes 3000`; `#L325-L328` `if iteration < args.freeze_prototypes_niters: p.grad = None`, `#L83` 기본 313 |
| scores `s = zᵀC` | 1 × 3000 | `resnet50.py#L304-L305` `self.prototypes(x)` |
| `p = softmax(s / τ)`, τ = 0.1 | 예측 분포 | `main_swav.py#L312-L313` `x = output[...] / args.temperature`, `F.log_softmax` |
| Sinkhorn-Knopp, 3 iterations, ε = 0.05, code q | 할당 | `main_swav.py#L353-L376` `distributed_sinkhorn`, `#L61-L64` `--epsilon 0.05 --sinkhorn_iterations 3` |
| 파란 경로(gradient 없음) | assignment path | `main_swav.py#L291` `with torch.no_grad():`, `#L353` `@torch.no_grad()` |
| loss 글자 3개 | `− Σ q log p` | `main_swav.py#L310-L315` `subloss -= mean(sum(q * log_softmax(x)))`, `v ≠ crop_id` |
| "shared weights" 점선 | 한 네트워크가 모든 crop을 처리 | `resnet50.py#L308-L323` `forward()`가 crop 묶음을 순회하며 **같은** `forward_backbone`/`forward_head` 사용 |

**그리지 않은 것**: 선택적 feature queue(`main_swav.py#L207-L231`, `#L294-L304`). swav 스크립트 7개 중 5개가 `--queue_length 0`이고, 넣으려면 Sinkhorn 두 박스로 들어가는 추가 화살표가 필요해 오른쪽 통로와 충돌한다. **지운 것이 아니라 안 그린 것임을 캡션에 명시**했다("the optional feature queue (queue_length > 0) is not drawn").

---

## 3. 검사 결과 (stdout 그대로)

### 게이트 ① 렌더

```
xml ok
```
```
fig.html <- figure.drawio (22497 chars)
```
`python -m http.server 8907 --directory <출력폴더>` 로 서빙, `http://localhost:8907/fig.html`. **통과 — 1라운드.**

### 게이트 ② `check_layout.py` (XML 검사)

라운드 1 (`--fix` 없이):
```
== figure.drawio ==
  edges 27, labelled 0
  FLAG  'Projection head' does not fit its shape (115x76) -- grow it to 115x89
  FLAG  'Projection head' does not fit its shape (115x76) -- grow it to 115x89
  FLAG  'Projection head' does not fit its shape (115x76) -- grow it to 115x89
  FLAG  commit '06b1b7c' claimed in 'Figure 1. SwAV pretraining as implemente' but not verified -- rerun with --repo <path>, or write 'commit not determined'
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
  (zone, container, and crossing flags are not auto-fixable except --fix growing; the numbers above are the fix)
exit=1
```

라운드 2·3 (`--fix --repo` 로 재실행): **스킬 스크립트가 죽는다.**
```
== figure.drawio ==
  edges 27, labelled 0
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
[스킬 도구 관련 출력은 공개본에서 제외되었다]
exit=1
```

라운드 4 (박스 높이 76→90 수동 조정, 셀을 컨테이너→엣지→도형 순으로 재배치):
```
== figure.drawio ==
  edges 27, labelled 0
  ok
exit=0
```

라운드 5 (엣지 9개를 좌표 고정 free edge로 교체한 뒤 재검사):
```
== figure.drawio ==
  edges 27, labelled 0
  ok
exit=0
```

라운드 6 (게이트 ④ 지적으로 범례 항목 추가 후):
```
== figure.drawio ==
  edges 27, labelled 0
  FLAG  'lgs3' hangs out of its container -- widen it to 586x32
  FLAG  '× 6 marks a branch drawn onc' hangs out of its container -- widen it to 876x32
exit=1
```

라운드 7 (범례 배경 560 → 880 확장):
```
== figure.drawio ==
  edges 27, labelled 0
  ok
exit=0
```

**통과 — 처음 0플래그는 4라운드, 최종본 기준 7라운드.** 엣지 라벨은 T1-M 상한 0개를 처음부터 지켰다(`labelled 0`).

### 게이트 ③ `check_render.js` (렌더 실측)

라운드 1:
```json
{
  "texts": 131, "shapes": 20, "edges": 31,
  "counts": { "online": 1, "cross": 1 },
  "flags": [
    { "kind": "online", "a": "[trainable]", "at": [303, 501],
      "note": "an arrow runs across this label without belonging to it - move the label off the line" },
    { "kind": "cross", "at": [104, 313],
      "note": "two arrows cross - route one around, or add a line jump" }
  ]
}
```

원인을 SVG `path` 데이터로 실측했다(추정하지 않았다):

```
"M 255 502 L 270 502 L 270 522.8 L 345.61 522.8"   <- crop → backbone. 도형 안에서 끝난다
"M 355 481.2 L 440 481.2 L 440 502 L 445.61 502"   <- backbone → head. 도형 안에서 시작한다
"M 115 320 L 127 320 L 127 108 L 130.61 108"       <- 세 갈래가 (127,320) 한 점을 공유 → cross
```
`shape=trapezoid;direction=north` 에서는 `exitX/entryX` 고정점이 회전돼 **경사면 안쪽**으로 붙는다(스킬 §T1-M 함정과 같은 증상). 사다리꼴에 붙던 엣지 6개와 부채꼴 3개를 **좌표 고정 free edge**로 바꾸고, 세 갈래의 분기 y와 통로 x를 각각 300/320/340, 122/132/127로 분리했다.

라운드 2:
```json
{ "texts": 131, "shapes": 20, "edges": 31, "counts": {}, "flags": [] }
```
라운드 3 (범례 항목 추가 후 최종본):
```json
{ "texts": 132, "shapes": 21, "edges": 32, "counts": {}, "flags": [] }
```
**통과 — 2라운드에 flags 0, 최종본 재확인 포함 3라운드.**

### 크기·표기

```
FULL   1015 x 724  ratio 1.40:1
```
전폭 상한 3:1, 단일 컬럼 상한 1.6:1 **둘 다 만족**. 본문 글자는 전부 12px = 캔버스 폭의 **1.18%** (하한 1.16%).

```
emoji/glyph ['→'] | font 61 / 61
em-dash count: 0
```
허용된 `→`만 남았고(`×`는 U+00D7이라 이 스캔에 안 잡힌다), 모든 style에 `fontFamily=Times New Roman`이 들어갔으며 em-dash는 0건이다.

### ③-a 라벨 대조 (그림 안 문자열 전체)

```
224² → 7²
64 → 2048 ch
96² → 3²
Global crop x1 / 3 × 224 × 224 / scale 0.14 to 1.0
Global crop x2 / 3 × 224 × 224 / scale 0.14 to 1.0
Local crops / 3 × 96 × 96 / × 6
Projection head / [trainable] / 2048 → 2048 → 128 / unit-norm z1 (z2, zv)
Prototypes C / 128 × 3000 / [trainable] / gradients off / first 313 iters
ResNet-50 / backbone / [trainable]
Sinkhorn-Knopp / 3 iterations, ε = 0.05 / code q1 of crop x1 (q2 of crop x2)
Training image / labels unused
p1 = softmax(s1 / τ) / τ = 0.1     (p2, pv; pv는 v = 3 … 8)
s1 = z1^T C / 1 × 3000 scores      (s2, sv)
forward pass / assignment, no gradient / shared weights / × 6 marks a branch drawn once for six crops
− Σk q2k log p1k
− Σk q1k log p2k
− Σk q1k log pvk − Σk q2k log pvk
Figure 1. …(캡션)
```
위 2절 표의 코드 심볼과 1:1로 대조했다. 오타 0건, 범례 표기와 본문 표기 불일치 0건.

### ③ 스크린샷 육안 점검 (12항목)

| # | 볼 것 | 관측 |
|---|---|---|
| 1 | 선이 도형을 관통하는가 | 라운드 1에서 backbone 3개를 관통했다(위 path 데이터). free edge 교체 후 최종본에서 사다리꼴 좌·우 수직변에서 정확히 멈춘다 |
| 2 | 그리라고 한 선이 실제로 그려졌는가 | 27개 엣지 전부 렌더 확인. 특히 점선 4개(backbone A–B, B–C, head A–B, B–C)가 x=300·512.5에 보인다 |
| 3 | 선끼리 교차·절단 | 라운드 1의 부채꼴 공유 꼭짓점 1건 → 통로 분리 후 0건 |
| 4 | 화살표가 엉뚱한 곳에 닿았는가 | 파란 s₂ 경로가 오른쪽 여백 x=1035로 우회해 위쪽 Sinkhorn 우변에 정확히 들어간다 |
| 5 | 글자가 박스 밖으로 | Projection head 3개가 76px에서 넘쳐 90px로 키웠다. 최종 0건 |
| 6 | 범례 기호 = 본문 기호 | 검정 실선·파란 실선·회색 점선·카드 견본 네 개가 본문과 같은 색·같은 선종류 |
| 7 | 라벨이 남의 테두리에 얹혔는가 | loss 글자 3개가 각각 위·아래 박스와 5px 이상 떨어져 있다 (`onborder` 0건) |
| 8 | 철자 | 위 ③-a 목록으로 대조 |
| 9 | 라벨이 도형 안에 다 들어갔는가 | `spill` 0건 |
| 10 | 작은 도형·인셋 | 인셋 없음. 가장 작은 도형은 범례 카드 견본(26×17)이고 글자를 넣지 않았다 |
| 11 | 발명한 기호 | 없음. `//`·`⊘`·정지구배 기호를 쓰지 않았다 |
| 12 | 긴 선이 다른 요소를 가로지르는가 | 파란 s₂ 우회선이 유일한 긴 선이고, 행 B 아래(y=440)와 도형 오른쪽 바깥(x=1035)만 지난다 |

렌더 PNG는 3파일 제약 때문에 이 폴더에 두지 않고 작업 폴더에 남겼다:
`C:\Users\youngseolee\OneDrive - Microsoft\Documents\Microsoft Scout\swav_full.png` (+ `swav_zoom_left.png`, `swav_zoom_right.png`, `swav_zoom_caption.png`). `fig.html`을 로컬 서버로 열면 같은 화면이 나온다.

### 게이트 ④ 독립 시각 게이트 (다른 에이전트, PNG + 검사 원문만 전달)

심사자에게 준 것: 렌더 PNG 4장(전체 1 + 확대 3), `check_layout.py`·`check_render.js`·`extent.py`·표기 스캔의 **원문 출력**, 저장소 경로, 루브릭 파일 경로, 그리고 "이 그림이 swav 저장소 것이 아니면 심사를 멈추라"는 오염 방지 문구. **주지 않은 것**: 이 보고서, 단계 분해, 의도 설명.

**라운드 1 판정문(전문)**

> Before reading code, I understand the figure to claim: SwAV pretraining takes one unlabeled image, creates two global and six local crops, runs all crops through shared trainable ResNet-50 and projection-head weights, scores normalized embeddings against 3000 trainable prototypes, computes balanced Sinkhorn assignments only for the two global crops without gradients, then trains predictions from other crops using swapped cross-entropy losses.
>
> Group A:
> - A1 PASS: no visible label escapes its shape in full image.
> - A2 PASS: no enclosing zone box is used.
> - A3 PASS: arrows do not visibly cross labels; blue assignment path routes around loss text.
> - A4 PASS: no cut words in full figure or caption zoom.
> - A5 PASS: smallest caption text is readable in `swav_zoom_caption.png`.
> - A6 PASS: machine check reports `ok`, no body-ratio flags.
>
> Group B:
> - B1 PASS: figure states unlabeled multi-crop SwAV pretraining.
> - B2 PASS: left-to-right order is clear from “Training image labels unused” to losses.
> - B3 PASS: carried objects are named: `z`, `s`, `p`, `q`, `C`.
> - B4 PASS: “labels unused”, shared weights, no-gradient assignments, and swapped losses explain the self-supervised design.
> - B5 PASS: formulas are explanatory, not just code names.
> - B6 PASS: no unexplained major shape; prototype tall box is understandable.
>
> Group C:
> - C1 PASS: reading order uses arrows only.
> - C2 PASS: document cards, trapezoids, prototype block, score boxes, and assignment boxes differ by role.
> - C3 PASS: legend has line samples for forward pass, assignment/no-gradient, shared weights.
> - C4 PASS: legend top and caption bottom are separate bands; no conflicting title band.
> - C5 FAIL: repetition is folded as “Local crops … × 6”, but the legend has no folded-repetition sample or line explaining that notation.
>
> Factual errors from repository code: none found. `main_swav.py`, `src/resnet50.py`, `src/multicropdataset.py`, and `scripts/swav_800ep_pretrain.sh` support the crop counts/sizes/scales, shared ResNet/projection/prototypes, 128-dim embeddings, 3000 prototypes, τ=0.1, ε=0.05, 3 Sinkhorn iterations, first-313-iteration prototype-gradient freeze, and queue omitted because `queue_length 0`.
>
> GATE: FAIL
> 1. Add a legend entry explaining folded repetition, specifically that `× 6` represents six local crop branches collapsed into one drawn branch.

조치: 범례에 카드 견본 + `× 6 marks a branch drawn once for six crops` 항목을 추가하고 범례 배경을 880px로 넓혔다.

**라운드 2 판정문(전문)**

> C5 is now satisfied: the legend includes a card sample and the text “× 6 marks a branch drawn once for six crops.”
>
> Nothing new broke: the widened legend stays in its top band, all four legend entries are inside the legend box, and I see no new overlaps or collisions.
>
> GATE: PASS

**통과 — 2라운드.** 심사자가 코드를 직접 읽고 확인한 사실 오류는 0건이다.

### 게이트 요약

| 게이트 | 결과 | 라운드 |
|---|---|---|
| ① 렌더 (XML 파싱 + 뷰어) | 통과 | 1 |
| ② `check_layout.py` | 통과 (`ok`, exit 0) | 4 (최종본 기준 7) |
| ③ `check_render.js` | 통과 (`flags: []`) | 2 (최종본 재확인 포함 3) |
| ④ 독립 시각 게이트 | **GATE: PASS** | 2 |

---

## 4. 설계 판단 (왜 이렇게 그렸는가)

- **교환(swap)을 교차 화살표로 그리지 않았다.** SwAV의 교환 예측을 두 갈래 사이 대각선 두 개로 그리면 위상적으로 반드시 교차하고, `check_render.js`의 `cross` 플래그가 뜬다(플래그는 비어 있어야 한다). 대신 **code 박스를 상대 갈래의 prediction 박스 바로 옆에 배치**했다: `q₂`(crop x₂의 code)는 `p₁` 바로 아래, `q₁`은 `p₂` 바로 위에 있고, 두 박스가 만나는 자리에 loss가 글자로 적힌다(L6이 loss를 다루는 방식). 어느 code가 어느 갈래에서 왔는지는 파란 화살표가 나른다.
- **loss를 박스로 그리지 않았다.** 양방향 화살표도 쓰지 않았다(§관례 B).
- **ResNet-50 내부를 인셋으로 펴지 않았다.** 저자의 기여는 층 구성이 아니라 multi-crop + 교환 예측이므로, 가져다 쓴 백본은 사다리꼴 하나로 요약하고 숫자(`224² → 7²`, `64 → 2048 ch`)를 밑에 적었다(§관례 A의 사다리꼴 요약). 테이퍼 방향이 나르는 값이 **해상도**임을 캡션에 적었다.
- **local crop 갈래의 사다리꼴을 작게** 그렸다. 입력이 96²이므로 도형 크기와 숫자가 같은 말을 한다.
- **prototypes를 세 행에 걸친 하나의 세로 박스**로 뒀다. `C`가 모든 crop에 공유된다는 사실이 배치로 보이고, 행마다 따로 그렸을 때 생기는 되돌아오는 화살표·교차가 없어진다.
- **색**: 학습되는 것(backbone·head·prototypes)만 주황, gradient가 끊기는 할당 쪽만 파랑, 나머지는 흰색/회색. 색이 "무엇이 학습되고 무엇이 안 되는가"라는 주장을 한다.

---


## (이 절은 공개본에서 제외되었다)

원문 보고서의 이 위치에는 스킬 자체의 도구·지침에 대한 내부 검토 내용이 있다.
도면의 결함이 아니라 도구의 결함에 관한 기록이라 공개본에서는 제외하였다.
게이트가 검출한 도면 결함은 위 절들에 그대로 남아 있다.
## 6. 편집 안내 (지우면 무엇이 사라지는가)

- **캡션**: `id="cap"` 셀 **하나**. 선택 후 삭제하면 캡션만 사라진다(논문 본문에 캡션을 직접 쓰는 경우).
- **범례**: `id="legend"` **그룹**. 클릭 한 번에 배경·선 견본·카드 견본·글자가 함께 선택된다. 지우면 색·선종류의 의미 설명이 사라지므로, 지울 거면 그 내용을 캡션에 한 줄로 옮기는 것을 권한다.
- **해상도·채널 글자**: `dimA1/A2`, `dimB1/B2`, `dimC1/C2` 여섯 셀. 지우면 사다리꼴이 "무엇이 줄어드는지"를 말하지 못하게 된다.
- **loss 글자**: `loss1`, `loss2`, `loss3`. 지우면 교환 예측이라는 주장이 그림에서 사라진다(배치만 남는다).
- 제목 셀은 만들지 않았다. 슬라이드용이면 범례 위 빈 띠(y < 12)에 한 줄 추가하면 된다.

파일: `figure.drawio` (draw.io / diagrams.net에서 바로 편집), `fig.html` (로컬 HTTP 서버로 열어 보는 뷰어. `file://`로는 안 뜬다).
