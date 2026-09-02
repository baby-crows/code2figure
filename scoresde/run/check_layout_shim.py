"""Wrapper around the skill's scripts/check_layout.py.

check_layout.py --fix crashes with `NameError: apply_readability` and then
`NameError: readk`. Neither name exists anywhere in the file, and readability()
documents that this check is deliberately NOT auto-fixed ("This is deliberately
NOT auto-fixed ... The numbers to hit are printed instead"), so the two calls
are dead code left over from an earlier revision. This wrapper deletes exactly
that dead block and runs the script otherwise unchanged.
"""
import sys
import types

SKILL = r"C:\Users\youngseolee\.scout\m-skills\method-figure\scripts\check_layout.py"

DEAD = """    raised = apply_readability(root, readk)
    if raised:
        print(f"  FIX   {raised} font sizes raised {readk:.2f}x using the slack "
              f"already inside the shapes (canvas unchanged)")
    raised = apply_readability(root, readk)
    if raised:
        print(f"  FIX   {raised} font sizes raised {readk:.2f}x for readability")
        # the labels are bigger now, so the fit numbers taken before the raise
        # are stale; re-measure and let the shapes that overflow grow
        _, grow = fit(root)
        _, widen = zones(root, want_fix=True)
"""

src = open(SKILL, encoding="utf-8").read()
if DEAD not in src:
    sys.exit("dead block not found; check the skill script by hand")
src = src.replace(DEAD, "")

mod = types.ModuleType("__main__")
mod.__file__ = SKILL
sys.argv[0] = SKILL
exec(compile(src, SKILL, "exec"), mod.__dict__)
