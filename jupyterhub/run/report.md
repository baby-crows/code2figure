# report.md — JupyterHub architecture figure

**Repository read:** `C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\eval\demo\sandbox\jupyterhub`
**Output folder:** `C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\out\demo\jupyterhub\run\`

Only this repository's code and docs were read. No project website, no upstream architecture drawing, no web search.

---

## 1. Classification: T2 (execution flow)

The request was "show how this project works". Per `SKILL.md` §0-1 that is T2, not T1:
the figure is the whole runtime pipeline, its boxes carry real identifiers (file names,
commands, URL paths, config keys), and the primary input is the codebase.

Cross-check against the T1-M/T1-G discriminator: `nn.Module` / `forward()` count is 0 and
there is no model at all, so nothing in the T1 branch applies.

## 2. Provenance: commit not determined

```
$ git -C <repo> rev-parse --show-toplevel
C:/Users/youngseolee/OneDrive - Microsoft/Desktop/work/code/paper-trail
$ git -C <repo> rev-parse HEAD
09e14774bd557ab7836c18bcaab5ede8144a130b
```

`--show-toplevel` resolves to `paper-trail`, **not** to the jupyterhub folder. The SHA above
therefore belongs to the enclosing repository, not to the figure's subject. Per `SKILL.md` §0
that SHA was **not** written into the caption; the caption says
`Repository commit not determined: this folder is not a git repository of its own.`

## 3. Design claim carried by the figure (T2 rule 6)

The claim is stated in the repo's own prose, in three places:

| Source | Text |
|---|---|
| `docs/source/explanation/concepts.md#L56-59` | "anything which is related to _starting_ the user's workspace/environment is about JupyterHub, anything about _running_ usually isn't" |
| `docs/source/explanation/concepts.md#L198-202` | "the hub itself can shut down and the proxy can continue to allow users to communicate with their notebook servers" |
| `docs/source/reference/technical-overview.md#L48` | "The proxy is the only process that listens on a public interface." |

The claim is **not** written on the figure as a banner. It is carried by three structural devices:

1. **A bypass path.** Steps 7 and 8 go browser → proxy → single-user server and never touch the
   Hub box. The reader can verify this by following the line, not by trusting a sentence.
2. **A route table drawn inside the proxy.** Step 6 writes a row; steps 7-8 consume it. The
   reason the Hub can drop out is visible: the state that keeps the session alive lives in the
   proxy, not in the Hub.
3. **A trust boundary as two zones.** "Public network" holds only the proxy; everything else is
   in "localhost only". That is `technical-overview.md#L48` and `#L97-99` drawn rather than said.

`Authenticator` and `Spawner` are drawn **nested inside** the Hub box rather than as peers,
because `concepts.md#L113` and `#L183` say both run inside the Hub process.

## 4. Stage decomposition (please confirm)

| # | Stage | In | Out | Evidence |
|---|---|---|---|---|
| 1 | `jupyterhub` starts the Hub | `jupyterhub_config.py` | tornado app, `jupyterhub.sqlite` | `pyproject.toml#L63`, `app.py#L3471-3546` (`initialize`), `app.py#L2034` (`init_db`) |
| 2 | Hub launches the proxy, installs default route | Hub bind url | `configurable-http-proxy` child process, route `/` | `app.py#L3866-3877`, `proxy.py#L726-796` (`Popen`), `proxy.py#L479-482` (`add_hub_route`) |
| 3 | Browser hits the public proxy | `GET /hub/login` on `:8000` | forwarded request | `app.py#L762` (`http://:8000`), `handlers/login.py#L96` |
| 4 | Default route carries it to the Hub; Authenticator returns a username | credentials | username | `proxy.py#L482`, `auth.py#L675` (`get_authenticated_user`), `app.py#L1104` (`http://127.0.0.1:8081`) |
| 5 | Spawner launches the single-user server and waits for it | env incl. `JUPYTERHUB_API_TOKEN`, `JUPYTERHUB_API_URL` | running `jupyterhub-singleuser` | `user.py#L976` (`spawner.start()`), `spawner.py#L1032-1033` (cmd), `spawner.py#L1322`/`#L1358` (env), `user.py#L1099-1116` (`_wait_up`) |
| 6 | Hub posts the user route to the proxy admin API | `spawner.proxy_spec`, `spawner.server.host` | new route row | `handlers/base.py#L1170`, `proxy.py#L332-351` (`add_user`), `proxy.py#L999-1004` (`add_route`) |
| 7-8 | Steady state: browser → proxy → user server | `GET /user/danez/lab` | notebook UI | route table; `proxy.py#L568` (`127.0.0.1:8001`), `docs/source/explanation/oauth.md#L134-140` |
| 9 | User server asks the Hub to validate the browser token | token in cookie | user model | `services/auth.py#L554-579` (`_check_hub_authorization`, `/hub/api/user`), `services/auth.py#L469-478` (`cache_max_age = 300`) |

Per §T2-5, **please confirm the stage boundaries**, especially:
step 2 collapses "start proxy" and "add default route" into one arrow, and steps 7-8 collapse
the full internal OAuth handshake (`oauth.md#L130-260`) down to the request that follows it.

## 5. Box-by-box source evidence

| Element in figure | Text drawn | Source |
|---|---|---|
| CLI box | `jupyterhub -f jupyterhub_config.py` | `pyproject.toml#L63`, `app.py#L3489` |
| Proxy box | `configurable-http-proxy`, `public :8000`, `admin API :8001` | `pyproject.toml#L74`, `app.py#L762`, `proxy.py#L568`, `docs/source/howto/separate-proxy.md#L46` |
| Route table row 1 | `/` → `127.0.0.1:8081` | `proxy.py#L479-482`, `app.py#L1104` |
| Route table row 2 | `/user/danez/` → `127.0.0.1:port` | `proxy.py#L347-351`, `spawner.py#L582-587` (`port = 0`, random), `oauth.md#L135` (the name `danez`) |
| Hub box | `Hub: jupyterhub (Python/Tornado)`, `127.0.0.1:8081/hub` | `technical-overview.md#L20`, `app.py#L1036`/`#L1104` |
| Authenticator card | `PAMAuthenticator`, `returns a username` | `pyproject.toml#L67`, `auth.py#L675-...`, `concepts.md#L76` |
| Spawner card | `LocalProcessSpawner`, `one process per server` | `pyproject.toml#L78`, `concepts.md#L135` |
| Store | `jupyterhub.sqlite`, `users, servers, tokens` | `technical-overview.md#L104-108`, `app.py#L2034` |
| Server box | `jupyterhub-singleuser`, `/user/danez/`, `127.0.0.1:port` | `spawner.py#L1033`, `user.py#L838`, `spawner.py#L582` |
| Edge label 3 | `GET /hub/login` | `handlers/login.py#L96` |
| Edge label 5 | `JUPYTERHUB_API_TOKEN` | `spawner.py#L1322` |
| Edge label 6 | `POST /api/routes/` | `proxy.py#L999-1004` |
| Edge label 7 | `GET /user/danez/lab` | `user.py#L838`, `concepts.md#L267` |
| Edge label 8 | `route /user/danez/` | `proxy.py#L347` (`spawner.proxy_spec`) |
| Edge label 9 | `GET /hub/api/user` | `services/auth.py#L561` |
| Legend | `token check, cached 300 s` | `services/auth.py#L469-477` |

No value in the figure was invented. Nothing was executed; every string above is read from a file.

**Collapsed repetition (T2 rule 3):** the count of user servers is decided at runtime, so it is
drawn as one card plus two stacked ghosts, with the legend line
`stacked card: one server process per user`. The route table's `...` row says the same thing
about routes. No arbitrary "3 servers" was drawn.

**Images:** none embedded. No logo, screenshot, or generated picture is in the figure. All
artifact shapes (the route table grid, the stacked cards) are draw.io primitives.

---

## 6. Gate results

### Gate ① render / XML parse — PASS, round 1

```
$ python -c "import xml.etree.ElementTree as ET,sys; ET.parse(sys.argv[1]); print('ok')" figure.drawio
ok
```

### Gate ② check_layout.py — PASS, round 2

Round 1 (report only):

```
== figure.drawio ==
  edges 10, labelled 6
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

```
[스킬 도구 관련 출력은 공개본에서 제외되었다]
```

The paint-order fix was therefore applied by importing `check_layout.paint_order` directly and
re-emitting the cells with the module's own `want` ordering, so the fix is the script's, not mine.
Round 2 and every run since:

```
== figure.drawio ==
  edges 10, labelled 6
  ok
```

Final run:

```
$ python check_layout.py --max 6 --repo <repo> figure.drawio
== figure.drawio ==
  edges 10, labelled 6
  ok
```

Edge labels: 6, exactly at the T2 cap of 6. Nothing was auto-deleted.

### Gate ③ check_render.js — PASS, round 3

Round 1:

```
{
 "counts": { "onborder": 2, "cross": 1 },
 "flags": [
  { "kind": "onborder", "a": "single-user server", "at": [738, 651],
    "note": "label sits astride a shape border - it reads as belonging to neither side" },
  { "kind": "onborder", "a": "5", "at": [876, 523],
    "note": "label sits astride a shape border - it reads as belonging to neither side" },
  { "kind": "cross", "at": [498, 562],
    "note": "two arrows cross - route one around, or add a line jump" }
 ]
}
```

Fixes: the server box label was moved to vertical centre and the stacked ghosts re-offset so no
ghost border runs under the label; badge 5 was moved off the Hub's bottom border; the
Hub-to-database edge was moved out of the `POST /api/routes/` horizontal's span.

Round 2:

```
{ "counts": { "cross": 1 },
  "flags": [ { "kind": "cross", "at": [668, 582],
               "note": "two arrows cross - route one around, or add a line jump" } ] }
```

Cause found by dumping the rendered path data: the Hub-to-database edge ignored its `exitX`
and left the Hub at 0.5 instead. A line break my editor inserted inside the style string had
produced the token `"                exitX"`, which draw.io does not recognise. Whitespace
normalised in every style string.

Round 3 and every run since:

```
{ "counts": {}, "texts": 57, "shapes": 32, "edges": 11, "flags": [] }
```

`flags` is empty. (`edges: 11` counts the cylinder's top-cap arc as a path; there are 10 real edges.)

#### ③-a label text cross-check

Every label was extracted from the XML and compared one by one against the symbols above. All
match their source; no typo, no label present in the body but absent from the legend, no legend
entry without a body counterpart.

```
'...'                                    route table ellipsis        (collapse marker)
'1' ... '9'                              step badges
'Hub: jupyterhub (Python/Tornado)' / '127.0.0.1:8081/hub'
'configurable-http-proxy'
'single-user server' / 'jupyterhub-singleuser' / '/user/danez/' / '127.0.0.1:port'
'jupyterhub.sqlite' / 'users, servers, tokens'
'/'  '/user/danez/'  '127.0.0.1:8081'  '127.0.0.1:port'   route table cells
'jupyterhub' / '-f jupyterhub_config.py'
'Authenticator' / 'PAMAuthenticator' / 'returns a username'
'Spawner' / 'LocalProcessSpawner' / 'one process per server'
'GET /hub/login'  'GET /user/danez/lab'  'GET /hub/api/user'
'JUPYTERHUB_API_TOKEN'  'POST /api/routes/'  'route /user/danez/'
'Public network'  'localhost only'  'browser'  'route table'  'routespec'  'target'
'public :8000 · admin API :8001'
legend: 'login and spawn traffic' / 'steady state: the Hub is not on this path' /
        'token check, cached 300 s' / 'Hub state on disk' /
        'stacked card: one server process per user'
title:  "How JupyterHub runs a user's notebook server"
```

#### ③ eyeball pass, item by item

I opened `render.png`, `zoom-left.png`, `zoom-right.png`, `zoom-bottom.png` and looked.

| # | What I looked at | What I saw |
|---|---|---|
| 1 | line through a shape | none. The four verticals under the Hub sit at x = 560, 660, 760, 860, all in empty space |
| 2 | a line I asked for that is missing | all 10 present. I specifically checked the dashed grey Hub-to-sqlite line, which is the faintest; it is drawn, with arrowheads on both ends |
| 3 | lines crossing or cutting each other | none. The only near-miss in round 1 was the `POST /api/routes/` corner beside the dashed line; they are now 100 px apart |
| 4 | arrow landing in the wrong place | step 4 lands on the Authenticator card, not on the Hub's outer wall, which is what I wanted; step 8's arrowhead lands on the server card's left edge, not on a ghost |
| 5 | text outside its box | none. `-f jupyterhub_config.py` is the widest mono line and clears the CLI box by roughly 20 px each side |
| 6 | legend symbol vs body symbol | black bar = black arrows, thick blue bar = the two thick blue arrows, teal bar = the teal arrow, three grey dashes = the dashed grey line, two offset cards = the ghosts behind the server box. All five match |
| 7 | label sitting on another shape's border | round 1 had two (`single-user server` on a ghost border, badge `5` on the Hub's bottom edge). Both re-measured clean after the move |
| 8 | spelling | done as a list, §③-a above |
| 9 | label overflowing its shape | route table cell `127.0.0.1:port` is the tightest at 16 mono characters in a 150 px column; it clears |
| 10 | small inset readable | the route table is the only inset; at 13 px its rows read at 1:1 |
| 11 | invented notation | none. The only non-alphanumeric marks are `·` in the proxy subtitle and `...` in the route table's last row, both ordinary |
| 12 | long line crossing things | step 8 is the longest at 446 px. It runs below the database cylinder with 20 px of clearance and touches nothing |

### Gate ④ independent visual gate — PASS on round 2

Judged by a separate `general-purpose` sub-agent given only the PNGs, the raw machine output,
and the repository path. It was not given this report, my intent, or the stage table. Verbatim
verdicts:

**Round 1: FAIL**

```
GATE: FAIL
A1 PASS
A2 PASS
A3 FAIL  black POST /api/routes/ arrow crosses vertical database arrow near (538,560)
A4 PASS
A5 FAIL  caption text at bottom, around (15,890)-(795,943), is too small to read comfortably
A6 PASS  machine output: 960 x 984, check_render flags=[]

B1 PASS  "JupyterHub starts a Hub and proxy, authenticates a browser user, spawns a per-user notebook server, and routes later requests directly through the proxy."
B2 PASS
B3 PASS
B4 PASS  legend says "steady state: the Hub is not on this path"; caption says the Hub can restart without cutting a running session
B5 PASS
B6 PASS

C1 FAIL  uses numbered step squares 1-9 plus phase/color legend: "startup", "first visit", "steady state"
C2 PASS
C3 PASS
C4 PASS
C5 PASS

Things to fix (highest priority first):
1. Remove the arrow crossing near POST /api/routes/.
2. Enlarge or shorten the caption.
3. Use either numbered steps or phase colors as the reading-order device, not both.
```

What I changed in response:

- **A3.** `check_render.js` reported zero crossings, so the geometry was not actually crossing;
  what the judge saw was a short vertical stub turning a corner 40 px away from a parallel
  dashed line. Ambiguity is a real defect even when the geometry is clean, so I spread the four
  verticals under the Hub to 560 / 660 / 760 / 860 and re-routed the token-check edge from an
  L-shape to a straight vertical. The corner now stands alone.
- **A5.** Caption raised from 11.5 px to 13 px, shortened, and its box grown from 110 to 132 px.
- **C1.** This was the substantive one and the judge was right. Four arrow colours (purple,
  black, blue, teal) mapped one-to-one onto four time phases, so colour was a second reading
  order competing with the numbers. Purple was merged into black, the blue and teal badges were
  made black so numbers alone carry order, and the legend was rewritten to describe **kinds of
  traffic** rather than phases: `login and spawn traffic`, `steady state: the Hub is not on this
  path`, `token check, cached 300 s`, `Hub state on disk`. The one emphasis colour that remains
  is blue, and it carries the design claim, not a position in the sequence. A legend line for the
  dashed grey edge was added at the same time, which had been missing.

**Round 2: PASS**

```
GATE: PASS
A1 PASS
A2 PASS
A3 PASS
A4 PASS
A5 PASS
A6 PASS  machine output: 960 x 1006; check_render flags=[]

B1 PASS  "JupyterHub starts a Hub and proxy, authenticates users, spawns per-user notebook servers, and routes later browser traffic through the proxy."
B2 PASS
B3 PASS
B4 PASS  legend: "steady state: the Hub is not on this path"; caption says the Hub can restart without cutting a running session
B5 PASS
B6 PASS

C1 PASS
C2 PASS
C3 PASS
C4 PASS
C5 PASS
```

`render-r1.png` is the render as it stood when round 1 was judged. `render.png` is the render
that passed on round 2 and is the current file.

### Notation check

```
$ python -c "<emoji / font scan from SKILL.md>" figure.drawio
emoji/glyph [] | font 66 / 66
em-dash 0
```

Zero emoji or circled glyphs. `fontFamily=Times New Roman` on all 66 styles. No em-dash.
All labels are English.

### Size

```
$ python extent.py figure.drawio
  FULL   960 x 1006  ratio 0.95:1
```

0.95:1, well inside the 1.6:1 single-column guidance. Body text is 13 px on a 960 px canvas
(1.35%), inside the 1.2-1.9% band measured on the canonical T2 figures and above the 1.16% floor.
`check_layout.py` raises no readability flag.

---


## (이 절은 공개본에서 제외되었다)

원문 보고서의 이 위치에는 스킬 자체의 도구·지침에 대한 내부 검토 내용이 있다.
도면의 결함이 아니라 도구의 결함에 관한 기록이라 공개본에서는 제외하였다.
게이트가 검출한 도면 결함은 위 절들에 그대로 남아 있다.
## 8. Files

| File | What it is |
|---|---|
| `figure.drawio` | the editable source, draw.io XML |
| `fig.html` | viewer page produced by `render_view.py` (serve it over HTTP; `file://` will not load the viewer) |
| `jhub_run_x7.html` | same viewer under a unique name, used for the independent gate |
| `render.png` | the final render, the one that passed gate ④ round 2 |
| `render-r1.png` | the render as judged in gate ④ round 1, before the three fixes |
| `zoom-left.png`, `zoom-right.png`, `zoom-bottom.png` | 2x crops handed to the gate |
| `evidence.json` | raw output of `scripts/evidence.py` (68 components, 765 artifacts, 12 examples, 119 files) |
| `check_render.js` | copy of the render checker, fetched by the viewer page |

## 9. Editing it afterwards

- The caption is the single cell `id=cap`. Delete it and nothing else moves.
- The legend is the group `id=legend`. Click once, delete, and the whole strip goes.
- The title is a separate cell `id=title`, so a slide can keep it and a paper can drop it.
- Deleting the two ghost cards `gh1`/`gh2` removes the "one process per user" claim, so the
  legend line `stacked card: one server process per user` should go with them.
- Deleting the route table (`g00`-`g31`, `t00`-`t31`) removes the evidence for why the Hub can
  drop off the request path; steps 6 to 8 stop being verifiable from the drawing alone.
