import re

p = r"C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\out\demo\scoresde\run\figure.drawio"
s = open(p, encoding="utf-8").read()

# check_layout --fix grew the loss text cell and pushed every row below it down by
# 22px. Vertex geometry was moved for us; edges declared with absolute
# sourcePoint / targetPoint / waypoints were not. Move those by the same 22px,
# except the one endpoint that attaches to a shape above the grown cell.
EDGES = {"eLoss": None, "eLoss2": 226, "eBloop": None, "eB1O": None, "eBO4": None}

out = []
for line in s.splitlines(True):
    m = re.search(r'id="(\w+)"', line)
    if m and m.group(1) in EDGES:
        keep = EDGES[m.group(1)]

        def bump(mm):
            v = int(mm.group(1))
            return 'y="%d"' % (v if v == keep else v + 22)

        line = re.sub(r'y="(\d+)"', bump, line)
    out.append(line)

open(p, "w", encoding="utf-8", newline="").write("".join(out))
print("shifted 5 absolute-point edges by 22px")
