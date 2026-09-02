import re, sys

p = r"C:\Users\youngseolee\OneDrive - Microsoft\Desktop\work\code\paper-trail\out\demo\scoresde\run\figure.drawio"
s = open(p, encoding="utf-8").read()

# check_layout --fix grew a text cell in panel (a) and shifted every row below it
# by 22px. Shapes moved; the free-standing skip arcs are declared with absolute
# sourcePoint/targetPoint, so they did not. Move them by the same 22px.
def shift(m):
    return 'y="%d"' % (int(m.group(1)) + 22)

out = []
for line in s.splitlines(True):
    if re.search(r'id="sk\d[hab]"', line):
        line = re.sub(r'y="(6\d\d|7\d\d|8\d\d)"', shift, line)
    out.append(line)
open(p, "w", encoding="utf-8", newline="").write("".join(out))
print("shifted skip arcs by 22px")
