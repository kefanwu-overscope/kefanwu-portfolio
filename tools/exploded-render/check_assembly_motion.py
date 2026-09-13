"""Build and report triangle-checked rigid assembly extraction plans in Blender."""
import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from inspect_motion import renderer_helpers
from assembly_motion import build_motion, KEYS, PLAN_DIR

ns = renderer_helpers()
keys = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(KEYS)
for key in keys:
    objects, ground = ns['stage'](key)
    if key == 'javelin':
        objects = ns['restore_javelin_parts'](objects)
    parts = ns['make_parts'](objects, key)
    ns['movement'](key, parts)
    ns['reunite_finish_surfaces'](key, parts)
    motion = build_motion(key, parts, bpy.context.scene)
    motion.apply(1)
    print('MOTION_RESULT', key, len(motion.stages), motion.report['retainedGroups'], flush=True)
