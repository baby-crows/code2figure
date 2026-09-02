import re

p = r"C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\out\demo\scoresde\run\figure.drawio"
s = open(p, encoding="utf-8").read()

# the second --fix pass grew two text cells and pushed the rows below them down
# by 12px again. Vertices moved, the free-standing skip arcs did not.
def bump12(m):
    return 'y="%d"' % (int(m.group(1)) + 12)

# place every under-block caption just below its block at the current y values
GEOM = {
    "ch0d": (100, 792, 112), "ch1d": (214, 846, 120), "ch2d": (326, 892, 120),
    "chbot": (360, 936, 270), "ch2u": (586, 892, 120), "ch1u": (718, 846, 120),
    "ch0u": (838, 792, 112),
}

out = []
for line in s.splitlines(True):
    if re.search(r'id="sk\d[hab]"', line):
        line = re.sub(r'y="(\d+)"', bump12, line)
    for cid, (x, y, w) in GEOM.items():
        if 'id="%s"' % cid in line:
            head, _, tail = line.partition("<mxGeometry")
            line = (head
                    + '<mxGeometry x="%d" y="%d" width="%d" height="18" as="geometry"/>' % (x, y, w)
                    + tail.split("/>", 1)[1])
    out.append(line)

open(p, "w", encoding="utf-8", newline="").write("".join(out))
print("arcs shifted 12px, under-block captions repositioned")
