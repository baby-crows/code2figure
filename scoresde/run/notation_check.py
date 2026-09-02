import re, html, sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()

e = re.findall(r'[\u2190-\u21ff\u2295-\u22ff\u2600-\u27bf\U0001f000-\U0001faff]', s)
n = len(re.findall(r'style="[^"]+"', s))
f = s.count("fontFamily=Times New Roman")
print("emoji/glyph", sorted(set(e)), "| font", f, "/", n)
print("em-dash", s.count("\u2014"))
print()
print("== labels ==")
vals = {html.unescape(re.sub("<[^>]+>", "", v)).strip()
        for v in re.findall(r'value="([^"]*)"', s) if v.strip()}
for v in sorted(vals):
    print(repr(v))
