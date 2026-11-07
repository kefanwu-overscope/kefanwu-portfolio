"""Shared constants for the homepage card line drawings (2026-10-27).

The homepage (index.html) shows each card's frame-0 cover through a srcset of
480/960/1200/1800 w files; the 1200 w file is the reference for the line art.
Paths are relative to the repository root (portfolio-site/).
"""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEBSITE = REPO.parent
EVIDENCE = WEBSITE / 'releases' / 'drawn-then-built-20261027' / 'card-lines'
OUT_DIR_REL = 'assets/editorial/lines-20261027'
OUT_DIR = REPO / OUT_DIR_REL

# Homepage order (index.html = case-study numbering = next links).
KEYS = ['steering', 'vineRobot', 'brakeSim', 'scanner', 'javelin', 'materialTest', 'aura', 'carbonSeat',
        'seat', 'ansysCfd', 'pool', 'lineFollower', 'formlabs', 'telecaster', 'education', 'ftc']

# The 1200 w cover each card shows (index.html srcset) and the 1800 w render
# it was resampled from.
COVER_1200 = {key: f'assets/editorial/white-20261022/{key}-wide-1200.webp' for key in KEYS}
COVER_1800 = {key: f'assets/editorial/white-20261011/{key}-wide-1800.webp' for key in KEYS}
COVER_1200['scanner'] = 'assets/editorial/scanner-color-20261024/scanner-wide-1200.webp'
COVER_1800['scanner'] = 'assets/editorial/scanner-color-20261024/scanner-wide-1800.webp'
COVER_1200['aura'] = 'assets/editorial/aura-reframe-20261022/aura-wide-1200.webp'
COVER_1800['aura'] = 'assets/editorial/aura-reframe-20261022/aura-wide-1800.webp'

# Scientific results are never traced (CLAUDE.md: CFD results are qualitative,
# scientific images stay untouched).
SKIP = {'ansysCfd': 'Scientific image: Fluent pressure field and flow paths on the Javelin body (CFD plot, not traced).'}

INK_OUTLINE = (0x11, 0x13, 0x16)   # #111316 silhouettes and part boundaries
INK_CREASE = (0x50, 0x5b, 0x66)    # #505b66 folds >= 30 degrees
INK_GUIDE = (0xc3, 0xc8, 0xce)     # #c3c8ce detail seen through clear parts
