import re

p = r"C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\out\demo\scoresde\run\figure.drawio"
s = open(p, encoding="utf-8").read()

R = [
    # gate round 2, fix 1: VE uses sampling_eps = 1e-5 (run_lib.py#L96-L98);
    # 1e-3 is only the default argument of get_pc_sampler
    ('value="Denoised x(\u03b5)&lt;br&gt;\u03b5 = 1e-3"',
     'value="Denoised x(\u03b5)&lt;br&gt;\u03b5 = 1e-5 for VE"'),
    # fix 2: likelihood.py returns an unbiased estimate, not an exact value
    ('(b) Reversing the same SDE in time: sampling, and exact likelihoods',
     '(b) Reversing the same SDE in time: sampling, and likelihood estimates'),
    ('value="Latent z, and log-likelihood&lt;br&gt;of x(0) in bits/dim"',
     'value="Latent z, and an unbiased estimate&lt;br&gt;of log p(x(0)) in bits/dim"'),
    # fix 5: reduce_mean = False makes reduce_op 0.5 * sum (losses.py#L71)
    ('|| std s\u03b8 + z ||\u00b2, summed over pixels',
     '0.5 || std s\u03b8 + z ||\u00b2, summed over pixels'),
    # fix 4 / B5: spell the repetition out instead of the shorthand
    ('value="128 ch, \u00d7 4"', 'value="128 ch, 4 blocks"'),
    ('value="128 ch, \u00d7 5"', 'value="128 ch, 5 blocks"'),
    ('value="256 ch, \u00d7 4, Res-attn-Res, \u00d7 5"',
     'value="256 ch, 4 blocks, Res-attn-Res, 5 blocks"'),
    # fix 3: attention is also applied in the bottleneck (ncsnpp.py#L176)
    ('Attention is applied at 16\u00b2 only.',
     'Attention is applied at 16\u00b2 and once in the 4\u00b2 bottleneck.'),
    ("it produces that point's latent code and its exact log-likelihood",
     "it produces that point's latent code and an unbiased estimate of its log-likelihood"),
    ('the number of BigGAN residual blocks at that resolution',
     'the number of BigGAN residual blocks at that resolution, four per encoder level and five per decoder level'),
]

s = s.replace('value="256 ch, \u00d7 4"', 'value="256 ch, 4 blocks"')
s = s.replace('value="256 ch, \u00d7 5"', 'value="256 ch, 5 blocks"')

for a, b in R:
    if a not in s:
        raise SystemExit("pattern not found: " + a[:70])
    s = s.replace(a, b)

# widen the under-block text cells for the longer wording, keeping them centred
# on their block and clear of the two vertical arrows in panel (c)
GEOM = {
    "ch0d": (92, 758, 120), "ch1d": (214, 834, 120), "ch2d": (326, 878, 120),
    "chbot": (360, 924, 270), "ch2u": (586, 878, 120), "ch1u": (718, 834, 120),
    "ch0u": (838, 780, 112),
}
out = []
for line in s.splitlines(True):
    for cid, (x, y, w) in GEOM.items():
        if 'id="%s"' % cid in line:
            head, _, tail = line.partition("<mxGeometry")
            geom = '<mxGeometry x="%d" y="%d" width="%d" height="18" as="geometry"/>' % (x, y, w)
            line = head + geom + tail.split("/>", 1)[1]
    out.append(line)
s = "".join(out)

s = s.replace('<mxGeometry x="660" y="582" width="200" height="46" as="geometry"/>',
              '<mxGeometry x="652" y="582" width="216" height="46" as="geometry"/>')

open(p, "w", encoding="utf-8", newline="").write(s)
print("round-2 gate fixes applied")
