# containerd architecture figure — build report

Repository read: `C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\eval\demo\sandbox\containerd`
Outputs: `out\demo\containerd\run\` — `figure.drawio`, `fig.html`, `render.png`, `evidence.json`, `report.md`

Only this checkout was read. No project website, no published containerd architecture diagram, no
web search. Every label in the figure traces to a file in this tree; the table below gives the line.

---

## 1. Classification and commit

**T2 (execution flow).** The request was "show how this project works", which is the project
pipeline, not the internal logic of a method. Confirmed by the code: there is no `nn.Module`
equivalent to draw; the repository is a daemon plus a plugin graph plus a shim, i.e. processes and
artefacts on disk.

**Commit: not determined, and that is in the caption.**

```
$ git -C <containerd folder> rev-parse --show-toplevel
C:/Users/youngseolee/OneDrive - Microsoft/Desktop/work/code/paper-trail
$ Test-Path <containerd folder>\.git
False
```

`--show-toplevel` resolves to the **paper-trail** repository, not to the containerd folder, so the
SHA `09e14774bd557ab7836c18bcaab5ede8144a130b` that `rev-parse HEAD` returns belongs to the outer
repository and would have been a false attribution. The caption therefore says
`commit not determined` and cites the one version string that is really in the tree:
`version/version.go#L27` → `Version = "2.4.0-beta+unknown"`.

## 2. Does the repository already draw itself

Checked before drawing anything, and compared rather than copied:

| Where | What it is | How it was used |
|---|---|---|
| `docs/runtime-v2.md#L418` | mermaid `sequenceDiagram`: ctr / containerd / shim | The author's own decomposition of **step 8 only** (create task, exec shim, ttrpc). My figure keeps that ordering (`Create task` → `containerd-shim-runc-v2 start` → address → `TaskService.Create`) and puts it in the wider pull-to-run context, which that diagram does not cover. |
| `docs/historical/design/architecture.md#L20`, `#L75` | `![Architecture](architecture.png)`, `![data-flow](data-flow.png)` | **The PNG files are not in this checkout.** Only the prose survives. Its data-flow list (`#L79-L91`: distribution → content store → snapshot → bundle → runtime) matches my steps 3-8, which is a useful cross-check on the stage boundaries. |
| `docs/cri/cri.png` | present, referenced from `docs/cri/architecture.md#L8` | Not reproduced. CRI appears in my figure as one line inside the gRPC box, since it is a consumer of the same core services (`plugins/cri/cri.go#L48-L67`). |
| `docs/transfer.md#L63` | mermaid `flowchart TD` for the transfer service | See the caveat in §6. |

## 3. Stage decomposition — please confirm this

Ten numbered steps, in the call order of the code. **This is the part of a T2 figure most worth
your correction**: if a boundary is wrong, the picture is wrong even if every label is right.

| # | Stage | What crosses into it | Evidence |
|---|---|---|---|
| 1 | daemon start: read config, register plugins, sort by `Requires`, init in that order | `/etc/containerd/config.toml` | `cmd/containerd/main.go#L25` (builtins side-effect import), `cmd/containerd/command/main.go#L105`, `cmd/containerd/server/server.go#L384-L387` (`registry.Graph`), `#L189` (`p.Init`), `defaults/defaults_unix.go#L23-L29` |
| 2 | client dials the daemon socket | `/run/containerd/containerd.sock` | `client/client.go#L104-L166`, `defaults/defaults_linux.go#L21`, `Makefile#L87` (`COMMANDS=ctr containerd containerd-stress`) |
| 3 | resolve the reference to a manifest or index, then to layer descriptors | image reference | `client/pull.go#L43`, `#L208` (`Resolver.Fetcher`), `docs/content-flow.md#L40-L47` |
| 4 | fetch and verify layer blobs, drive the unpack | layer blobs | `client/pull.go#L261-L262` (`remotes.FetchHandler`), `#L279` (`images.Dispatch`), `#L134`/`#L165` (`unpack.NewUnpacker`, `Wait`) |
| 5 | content store: blobs by digest | blobs | `plugins/content/local/store.go#L651` (`blobs/<algo>/<digest>`), `#L654-L677` (ingest), `docs/content-flow.md#L16` |
| 6 | snapshotter and differ: apply each layer, commit it | layer blob → committed snapshot | `docs/content-flow.md#L366-L371`, `#L17`, `plugins/types.go#L39`, `defaults/defaults_linux.go#L32` (`overlayfs`), `#L37` (`walking` differ) |
| 7 | metadata and leases: bolt graph, GC roots | image record, snapshot key, `gc.ref` labels | `plugins/metadata/plugin.go#L169` (`meta.db`), `#L184`, `#L198`, `docs/content-flow.md#L445-L448`, `docs/garbage-collection.md#L3-L19` |
| 8 | task service and shim manager: exec a shim, hand it the bundle over ttrpc | `CreateTaskRequest` | `client/container.go#L226`, `#L297`, `core/runtime/v2/shim_manager.go#L328-L347`, `core/runtime/v2/binary.go#L66-L118`, `#L129-L145`, `pkg/shim/util.go#L41-L48`, `pkg/shim/util_unix.go#L46`, `#L69-L88` |
| 9 | the shim forks `runc`; the container process is a child of the shim | OCI bundle | `docs/runtime-v2.md#L65-L67`, `#L81-L82`, `#L583-L586` (sub-reaper, reparenting), `pkg/shim/util_unix.go#L53-L67` (shim OOM score) |
| 10 | after a daemon restart the shim is still running and is re-attached | `bootstrap.json` | `core/runtime/v2/binary.go#L139-L142`, `core/runtime/v2/shim.go#L422-L423`, `shim_manager.go#L369-L391`, `bundle.go#L87` (`rootfs/`), `bundle.go#L111` + `pkg/oci/spec.go#L51` (`config.json`) |

### Box-by-box source of every identifier drawn

| Label in the figure | Source |
|---|---|
| `bin/containerd`, `bin/ctr` | `Makefile#L87`, `#L143` |
| `containerd-shim-runc-v2` | `pkg/shim/util_unix.go#L46` + `plugins/types.go#L92` (`io.containerd.runc.v2`) |
| `/etc/containerd/config.toml` | `defaults/defaults_unix.go#L23-L29` |
| `containerd.sock` | `defaults/defaults_linux.go#L21` |
| `/var/lib/containerd` (`--root`), `/run/containerd` (`--state`) | `defaults/defaults_unix.go#L27`, `defaults/defaults_linux.go#L35`, flags at `cmd/containerd/command/main.go#L100-L125` |
| `io.containerd.content.v1`, `.snapshotter.v1`, `.metadata.v1`, `io.containerd.runtime.v2` | `plugins/types.go#L49`, `#L39`, `#L47`, `#L31` |
| "one directory per plugin id" | `cmd/containerd/server/server.go#L166-L175` (`PropertyRootDir = config.Root/<plugin-id>`) |
| `blobs/sha256/` | `plugins/content/local/store.go#L651`, `docs/content-flow.md#L286` |
| `meta.db` | `plugins/metadata/plugin.go#L169` |
| `config.json`, `rootfs/`, `bootstrap.json` | `core/runtime/v2/bundle.go#L111` + `pkg/oci/spec.go#L51`; `bundle.go#L87`; `binary.go#L140` |
| `docker.io/library/redis:5.0.9` | `docs/content-flow.md#L8` |
| `redis1`, `redis2` and the shared committed stack | `docs/content-flow.md#L459-L475` |
| `/run/containerd/s/[hash]` | `pkg/shim/util_unix.go#L69-L88` |
| `runc` `[external]` | `docs/runtime-v2.md#L54-L56`, `#L81-L82`; `SCOPE.md#L24` |

### The design claim, and where the figure carries it structurally

The skill's rule 6 asks for *why* the project is built this way, carried by structure and not by a
banner. Three claims are in the repository's own words:

- `docs/PLUGINS.md#L9-L11`: "containerd has a smart client architecture, meaning any functionality
  which is not required by the daemon is done by the client."
- `docs/runtime-v2.md#L5-L8`: "containerd, the daemon, does not directly launch containers."
- `SCOPE.md#L23`: "there should be defined extension points where implementations can be swapped".
  With the non-goals at `SCOPE.md#L42-L45` (networking, build, volumes, logging all **out**).

Carried by structure, not by text:

1. **Smart client** → the registry connects to the *client* zone, and steps 3 and 4 are boxes
   inside the client process. A reader can check that no arrow runs from the registry into the
   daemon. That is the claim, verifiable against the rest of the picture.
2. **The daemon does not launch containers** → the container process box sits inside the shim zone,
   there is no arrow from the daemon to it, and the only daemon→shim arrow is the ttrpc one. The
   dashed step 10 returns from `bootstrap.json` to the daemon, so "the shim outlives the daemon"
   is drawn as a loop rather than asserted.
3. **Everything is a plugin** → the daemon boxes carry their plugin type strings, and the
   directories underneath carry the same ids ("one directory per plugin id"), which is literally
   `config.Root/<plugin-id>` in `server.go#L170`.

Reuse is drawn rather than claimed: `redis1` and `redis2` both point at the same top committed
snapshot, six committed layers below, which is exactly the `ctr snapshot ls` output in
`docs/content-flow.md#L463-L472`.

---

## 4. Verification — raw output

### Gate 1: XML parses, viewer renders

```
$ python -c "import xml.etree.ElementTree as ET; ET.parse('figure.drawio'); print('xml ok')"
xml ok

$ python scripts/render_view.py <outdir> figure.drawio=fig
fig.html <- figure.drawio (21063 chars)

$ python scripts/render_view.py <outdir> figure.drawio=containerd_arch_k4
containerd_arch_k4.html <- figure.drawio (21063 chars)
```

Served with `python -m http.server 8913 --directory <outdir>` (unique port) and judged through a
uniquely named page `containerd_arch_k4.html`, as the skill requires so that a concurrent agent
cannot land on someone else's figure. `fig.html` is the same figure under the requested name.

### Gate 2: `check_layout.py` — XML measurements

Final run:

```
$ python scripts/check_layout.py --max 6 --repo <containerd> figure.drawio
== figure.drawio ==
  edges 18, labelled 0
  ok
```

**Passed on round 4.** The three failing rounds, verbatim:

Round 1:
```
== figure.drawio ==
  edges 15, labelled 0
  FLAG  'Figure 1. containerd, from a' does not fit its shape (1160x72) -- grow it to 5589x72
  FLAG  'daemon start: read  /etc/con' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  'redis1' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  'redis2' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '1' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '2' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '3' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '4' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '5' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '6' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '7' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '8' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '9' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  '10' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  'n' has no arrow in or out -- wire it into the order or move it to the caption
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

Round 2 (after wrapping the caption, wiring `redis1`/`redis2` to their parent snapshot and the
daemon-start box to the API box):
```
== figure.drawio ==
  edges 17, labelled 0
  FLAG  'Figure 1. containerd, from a' does not fit its shape (1160x72) -- grow it to 1160x89
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

Round 3 (after moving the legend into the empty column, which reintroduced a fit and an order
flag):
```
== figure.drawio ==
  edges 18, labelled 0
  FLAG  'external program or service' does not fit its shape (182x22) -- grow it to 191x22
  FLAG  1 layer(s) paint an arrow on top of a shape -- re-emit as containers, edges, then shapes
```

### Gate 3: `check_render.js` — measured on the rendered SVG

```
{ "texts": 91, "shapes": 34, "edges": 22, "counts": {}, "flags": [] }
```

**`flags` is empty. Passed on round 3.** It was run in the browser on the live viewer page, not
inferred. The two failing runs:

Run 1 — every numbered badge sat astride the border of the box it labelled, plus one arrow
crossing:
```
counts: { "onborder": 10, "cross": 1 }
flags:
  onborder '1'  at [260,88]    label sits astride a shape border - it reads as belonging to neither side
  onborder '2'  at [25,162]
  onborder '3'  at [25,248]
  onborder '4'  at [25,334]
  onborder '5'  at [260,282]
  onborder '6'  at [408,282]
  onborder '7'  at [573,282]
  onborder '8'  at [489,182]
  onborder '9'  at [783,232]
  onborder '10' at [759,532]
  cross         at [727,249]   two arrows cross - route one around, or add a line jump
```

Run 2, after replacing the badges with numeric prefixes inside the box labels and removing the
redundant daemon→bundle arrow that crossed the restore arrow in the corridor between the zones:
```
{ "texts": 90, "shapes": 35, "edges": 20, "counts": {}, "flags": [] }
```

### Notation check

```
emoji/glyph [] | font 71 / 71
em-dash 0
```

No emoji, no circled glyphs, every style carries `fontFamily=Times New Roman`, no em-dash,
all labels English, no body font below 14.

### Aspect ratio and readability

```
$ python scripts/extent.py figure.drawio
  FULL   1160 x 960  ratio 1.21:1
```

Within the 1.6:1 single-column guidance, so nothing to decide. The body-text ratio check inside
`check_layout.py` is silent, which means the smallest body label (14 px on a 1160 px canvas,
1.21 % of canvas width) is inside the canonical 1.2-1.9 % band and renders at about 6.2 pt at full
column width. That number drove the layout: it is why the canvas is 1160 px wide and not 1600, and
why the plugin ids are split over two lines instead of set in one wide Courier run.

### Gate 3b: my own screenshot inspection, before handing it to the judge

I opened `render.png` and looked at each item. Observations, not assurances:

1. **arrow through a shape** — none. The three grey store arrows land on the cylinder and panel
   tops; the ttrpc and restore arrows use the 24 px corridor between the daemon and shim zones.
2. **an arrow I asked for that is not drawn** — I dumped all 22 rendered `path` elements and
   matched them to the 18 declared edges. All present. This found a real gap: box 7 (metadata) had
   no incoming arrow at all, so I added the snapshotter→metadata edge (the snapshot key and the
   `gc.ref` label are what land in the bolt graph, `docs/content-flow.md#L445`).
3. **arrows crossing** — one, at the corridor, found by the tool and removed.
4. **arrowheads landing in the wrong place** — none; every head sits on the edge of its target.
5. **text outside its box** — none.
6. **legend symbols matching the body** — two real mismatches found here, both fixed. The dashed
   arrow swatch rendered as nothing at all (a 26×10 `flexArrow` collapses), so it is now a real
   dashed edge cell inside the legend group. The number sample was a white-on-black chip while the
   body numbers are plain "1." prefixes; the sample is now a plain "1.".
7. **a label sitting on a neighbour's border** — the ten badges, caught by the render check.
8. **spelling** — the label dump is in §5 below, checked one by one against the code.
9. **labels fitting their shapes** — the fit check is clean.
10. **small insets legible** — the six committed snapshot bars are deliberately unlabelled; their
    number and stacking is the information, and the panel title says what they are.
11. **invented notation** — none. Everything in the figure appears in the legend or is a literal
    path or plugin id.
12. **a long line crossing other elements** — found by eye and not by any checker: the three store
    arrows entered the disk zones straight through the words `/var/lib/containerd (--root)`. Both
    disk zone titles were moved to the bottom band of their zone and the contents lifted, so the
    arrows now enter clean space. This is the one defect in this figure that only the eye caught.

### Gate 3a: label text against source

Every label, dumped from the XML and checked against the tree. No typos, no invented strings:

```
'1.'
'1. daemon start: read /etc/containerd/config.toml, register plugins, sort them by their Requires, init in that order'
'10. bundle, one per container / written before the shim starts / config.json / rootfs/ / bootstrap.json'
'2. Go client / bin/ctr, nerdctl, docker / dials the daemon socket'
'3. Resolve the reference / name to a manifest or index, / then to layer descriptors'
'4. Fetch and verify / layer blobs by digest, / then drive the unpack'
'5. Content store / io.containerd.content.v1 / blobs by digest'
'6. Snapshotter, differ / io.containerd.snapshotter.v1 / applies each layer'
'7. Metadata, leases / io.containerd.metadata.v1 / bolt graph, GC roots'
'8. Task service and shim manager / io.containerd.runtime.v2 / execs a shim, never runc'
'9. runc [external] / creates and starts / the container'
'/run/containerd ( --state ) / sockets and bundles'
'/var/lib/containerd ( --root ) / one directory per plugin id'
'containerd-shim-runc-v2 / ttrpc TaskService on / /run/containerd/s/[hash] / outlives the daemon'
'Client process / pull runs here, not in the daemon'
'Legend'
'OCI registry [external] / docker.io/library/redis:5.0.9'
'Shim process, one per container or pod / started by the daemon, then detached'
'binary in this repository'
'container process / child of the shim, / not of the daemon'
'containerd daemon: bin/containerd / every subsystem below is a plugin'
'containerd: how an image reference becomes a running container'
'content store / blobs/sha256/'
'dashed outline is external'
'directory on the host disk'
'gRPC API on containerd.sock / images, containers, tasks / plus the cri service for kubelet'
'metadata db / meta.db'
'only after a daemon restart'
'order of calls in the code'
'redis1'
'redis2'
'snapshots / committed once, shared'
```

### Gate 4: independent visual gate

A separate agent was given only the rendered PNG plus three zoomed crops, the raw output of the two
machine checks, the repository path and the rubric in `references/visual-gate.md`. It was not given
this report, the stage table, or any statement of intent. Its verdict, in full:

```
Contamination check passed — the figure is about containerd (repo verified: `version/version.go` =
`2.4.0-beta+unknown`, `cmd/containerd`, `cmd/ctr`, `cmd/containerd-shim-runc-v2` exist; plugin type
strings `io.containerd.content.v1` / `snapshotter.v1` / `metadata.v1` / `runtime.v2` all present in
`plugins/types.go`; `Registry.Graph` sorts by `Requires`; default config `/etc/containerd/config.toml`
confirmed). Every claim I spot-checked is true of this checkout.

GATE: PASS

A1 PASS
A2 PASS
A3 PASS
A4 PASS
A5 PASS
A6 PASS  check_layout.py reports "ok", no body-ratio flag
B1 PASS  "containerd is a daemon that turns an OCI image reference into a
         running container: a client dials its socket, it resolves the
         reference, fetches and unpacks layer blobs into a content store and
         snapshots, records them in a metadata bolt graph, then execs a
         per-container shim that runs runc to start the process."
B2 PASS  numbers 1-10 carry order; box 1 is explicitly "daemon start", so
         the jump to client boxes 2-4 is not disorienting
B3 PASS  node text names what crosses (manifest to layer descriptors, blobs by
         digest, applies each layer, bundle over ttrpc)
B4 PASS  the "why" is carried by the Shim zone captions ("outlives the
         daemon", "container process child of the shim, not of the daemon",
         legend "only after a daemon restart" + "re-attached from
         bootstrap.json") and the snapshots box ("committed once, shared...add
         only one writable snapshot each")
B5 PASS  every plugin-id box is paired with a plain-language role (e.g.
         "io.containerd.metadata.v1 / bolt graph, GC roots"), not bare names
B6 PASS  redis1/redis2 shared-snapshot stack and the bundle note both earn
         their place; no orphan shape
C1 PASS  single ordering device (numbers); zones group by process/location,
         not a second sequence
C2 PASS  distinct shapes: solid rounded rect = repo binary, dashed = external,
         cylinder/circle = host directory
C3 PASS  every legend line has a sample inside the legend box
C4 PASS  title (top band), legend (own box), caption (bottom band) separated
C5 PASS  the two-container expansion (redis1/redis2) is explained by the
         caption, not arbitrary

고쳐야 할 것 (우선순위 순):
(no blocking items — optional polish only)
1. runc (9) is drawn as a dashed hexagon, but the "external program or
   service" legend sample is a dashed rounded rectangle; use the same shape
   as the OCI-registry external box, or add a hexagon legend line, so the
   external convention is consistent.
2. Edges are unlabelled (check_layout: labelled 0). Comprehension survives
   because node text carries the payload, but a one-word label on the
   client→gRPC and shim→runc arrows would remove the last inference step.
```

**Gate 4: PASS on round 1**, so `render-r1.png` was not produced — the deliverable list says it is
only needed when the first submission fails.

The judge's optional item 1 was applied afterwards: the legend line now reads "dashed outline is
external", which names the property that actually carries the convention (the dash) rather than a
shape, so it covers both the rounded registry box and the `runc` hexagon. Gates 2 and 3 were re-run
after that edit and both are still clean (`ok` / `flags: []`); `render.png` is the post-edit render.
Item 2 was **not** applied, deliberately: see §6.

### Summary

| Gate | Result | Rounds |
|---|---|---|
| ① render / XML parse | PASS | 1 |
| ② `check_layout.py` | PASS | 4 |
| ③ `check_render.js` | PASS | 3 |
| ③b my own screenshot pass | 3 defects found and fixed (see items 2, 6, 12) | 3 |
| ④ independent visual gate | **PASS** | **1** |

---


## (이 절은 공개본에서 제외되었다)

원문 보고서의 이 위치에는 스킬 자체의 도구·지침에 대한 내부 검토 내용이 있다.
도면의 결함이 아니라 도구의 결함에 관한 기록이라 공개본에서는 제외하였다.
게이트가 검출한 도면 결함은 위 절들에 그대로 남아 있다.
## 6. Editing the file

`figure.drawio` opens in draw.io or the VS Code Draw.io extension. It is native XML, not an image.

- The **caption** is a single cell, `id="cap"`. Delete it and nothing else moves.
- The **title** is a separate cell, `id="title"` — slides want it, papers usually do not.
- The **legend** is one group, `id="legend"`. Click once, delete, and the whole block goes with no
  orphan pieces left behind. Its slot is the empty column under the client process.
- The four **process and disk zones** are `zclient`, `zdaemon`, `zshim`, `zroot`, `zstate`. The disk
  zone titles sit at the *bottom* of their zone on purpose, so the incoming arrows do not run
  through the words.
- Cell order in the file is containers → edges → leaf shapes. If you add an arrow, put it before
  the boxes or it will be painted on top of them; `check_layout.py` will tell you.

## 7. What I would like you to check

1. **The stage boundaries in §3.** Ten steps, cut at process boundaries and at the points where
   something is written to disk. If the cut is wrong the whole figure is wrong.
2. **Who this is for.** A new contributor needs the process boundaries, which is what this draws.
   Someone operating containerd would want more of the config surface and less of the client
   internals. That choice changes the figure more than any styling would.
3. **Client-side pull versus the transfer service** (§5.6) — which one your reader needs.
