"""Encode original Blender RGB stills as deployable WebP; no image alteration."""
import hashlib
import json
from pathlib import Path
from PIL import Image
from inspect_source import inspect as inspect_source

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEST = ROOT / 'assets/editorial'
DEST.mkdir(parents=True, exist_ok=True)
records = []
for stem in ['steering-wide', 'steering-portrait', 'vineRobot-wide', 'scanner-wide']:
    source = HERE / 'renders' / (stem + '.png')
    target = DEST / (stem + '.webp')
    with Image.open(source) as im:
        assert im.mode == 'RGB'
        im.save(target, 'WEBP', quality=91, method=6, exact=True)
        dimensions = list(im.size)
    metadata = json.loads(source.with_suffix('.json').read_text())
    # Also upgrade the original proof metadata from before the duplicate-face audit.
    metadata['importedTriangles'] = metadata.get('importedTriangles', metadata['sourceTriangles'])
    metadata.update(inspect_source(stem.split('-')[0]))
    assert metadata['sourceTriangles'] - metadata['importedTriangles'] == metadata['duplicateSourceTriangles']
    metadata['geometryChanges'] = 'Blender removes exactly the audited coincident duplicate source faces during import. Unique surface geometry is unchanged. Uniform scale/translation and shallow-edge shading normals only after import.'
    source.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n')
    metadata.update({
        'image': str(target.relative_to(ROOT)).replace('\\', '/'),
        'imageDimensions': dimensions,
        'imageBytes': target.stat().st_size,
        'imageSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'encoding': 'WebP quality 91; original resolution, no cropping or compositing',
    })
    records.append(metadata)
(HERE / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
print(json.dumps([{k:r[k] for k in ('image', 'imageDimensions', 'imageBytes', 'sourceBytes', 'sourceTriangles')} for r in records], indent=2))
