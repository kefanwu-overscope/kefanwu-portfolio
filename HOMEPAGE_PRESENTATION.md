# Homepage presentation

## Preserve fine hardware from the original photo · 2026-10-13

The user's rear-suspension feedback supersedes the per-component silhouette
mask. That earlier SVG approximated narrow links, allowing real pixels outside
the traced shapes to fall into the faded background. Overall framing checks
did not catch this pixel-level detail loss.

The active foreground now reveals two overlapping continuous original-photo
zones covering the complete car and driver/cage context. It does not trace
parts or cut holes between them. The protected source regions stay fully opaque;
all original links, hardware, gaps and contact shadows there retain the original
photograph. Soft transitions occur outside these broad regions. No sharpening,
generated parts or raster photo edits are used. Source/crop/scale and the current
racetrack background settings remain unchanged.

The new immutable directory is `assets/hero-fsae-context-20261013/`; source hashes
and method are in provenance.json. The old immutable SVG remains stored but is
not used by the homepage. Never restore its per-part tracing or edit either
published mask in place. Pixel checks,3× detail comparison, layouts and exact
release/restore records: `../.codex/hero-detail-preservation-20261013/`.

## Clearer track / gentler white transition · 2026-10-13

The latest request makes track context stronger while keeping the whole real
car/person. Background opacity .78 and saturation .94 retain more natural
road/grass color. A broad seven-stop fade keeps the scene clear near the car
and eases into white across a longer distance. No subject crop, scale, camera
position, mask path or source pixels change. Complete subject bounds were checked
at320/430/768/1024/1280/1920px. Evidence/release/restore:
`../.codex/hero-track-natural-20261013/`.

## Retained racetrack context · 2026-10-13

Latest user feedback keeps more of the real track. Background opacity is now
.52 with saturation .78 and a broader soft radial reveal, retaining readable
asphalt texture and a little grass around the car. It still fades into white
near the name/page edges. Subject colors, source photograph, immutable mask,
responsive placement and all interactions are unchanged. Exact verification
and restoration evidence: `../.codex/hero-track-context-20261013/`.

## Real race-car hero composition · 2026-10-13

The user clarified the abrupt cover means the homepage race-car photo and
approved preserving the clear subject while fading background context. The
hero now layers two copies of the same existing responsive photograph. An
alpha-only SVG reveals the real car/driver with its original color and contrast;
the background alone receives a gentle radial fade and reduced saturation.
The subject keeps the helmet, roll hoop, suspension gaps, tires and original
contact shadow. No image-generation or invented vehicle geometry is used.

Both images share absolute sizing, source/srcset/sizes and object-position.
The SVG mask uses the same cover scale and position through one responsive
CSS variable. The foreground is decorative/aria-hidden; the original image
supplies alt text and high-priority loading. Equal URLs share browser caching.
Mask support enables the new composition; unsupported browsers retain a
single-photo fallback. The scene has no runtime JS or new animation loop.

Phone composition preserves the full vehicle and driver in a shallow transparent
field, positioned close to the name. Its background fades to white without
a photographic band. Tablet framing keeps the car clear of the text/buttons.
The original16-project gallery, fine range controls,14 skills, case data and
3D return stay unchanged.

Source hashes/method: `assets/hero-fsae-20261013/provenance.json`. The three
original hero WebPs are byte-identical to47757cec. Only the small vector mask
is a new visual asset; its dated directory receives immutable caching. Use a
fresh version path for future mask edits after publication. Audit screenshots,
responsive measurements, exact deployment and restoration chain:
`../.codex/hero-fusion-20261013/`.

## Current presentation: original16-project gallery

The user's later feedback supersedes the featured-three presentation below.
The homepage again opens directly into the original16-project grid with its
original metadata/summary sizes. No extra featured section or featured script
is loaded. The original Vine framing is restored. Title-side decorative arrows
are removed; full-card links, downloads, search and filtering remain usable.
Gallery range controls retain native keyboard/scroll/touch semantics with a
2px neutral track,8px thumb and44px transparent input target. Focus is visible
inside the media boundary. Cover pixels, model poses, scientific figures and
case data are unchanged. Hero refinements, top skills and real process photos
from the previous update remain. Verification/release/backup evidence is in
`../.codex/gallery-refinement-20261012/`.

## Previous featured presentation (superseded)

The user approved all three recommendations from the October 12 aesthetic
review, including publication. This continues the white portfolio at6d7bd303.

- Hero auxiliary text uses a clearer, consistent scale and spacing. The real
  race-car photograph, white fade, large name and top skills cards are retained.
- Steering, Vine Robot and LiDAR Scanner receive a larger featured presentation
  before the complete16-project directory. `featured-work-20261012.js` reads
  existing directory media/body nodes; it has no second content catalog. Keep
  it before `exploded.js` so it clones only original covers and content.
- The Approach section adds three photographs from the existing project galleries.
  The images keep their full aspect ratios, original pixels and colors.

## Sources of the newly displayed material

| Existing asset | Existing source | New caption |
| --- | --- | --- |
| `assets/linkedin-u-joint.webp` | `project-data.js`: steering.gallery[0]; case-study-data.js: fabricated hardware | Machined steering hardware |
| `assets/vine-body-3partition.webp` | `project-data.js`: vineRobot.gallery[0] | Vine robot on the test bench |
| `assets/material-bending-fixture.webp` | `project-data.js`: materialTest.gallery[6] | Bamboo bending test |

The first photo shows finished hardware installed in the chassis, not machining
in progress. The Vine caption identifies the physical prototype without
assigning it a pressure value or reinforcement revision. The bending photo
shows a physical test without adding a numerical result. These are existing
public photos, not newly published private documents. No project outcomes,
roles, scientific figures or engineering records have been rewritten.

## Motion and maintenance

Featured hosts use `.featured-project.case-animation-host`, outside directory
filtering. The directory remains16 entries. The existing offline preview loader
now registers by host element so two presentations of one project have their
own controls. It retains one manifest, original asset URLs, interaction-only
loading, three concurrent requests and the160MiB decoded-memory limit.

Every model field uses the complete640:427 source aspect ratio with `contain`.
Vine uses the same1.12 scale and5.2% horizontal shift on poster and frames.
Conservative projected part masks from every animation pose leave its transformed
geometry inside x23.7–76.2% and y12.7–87.3%. Those source masks are at
`assets/exploded/white-20261011/anchors.json`; preserve the full motion envelope
when changing scale. Do not apply an independent cover zoom. Current models,
materials, cover/start poses, immutable frames and live detail motion are unchanged.

Main and3D details continue to use the same case-study data and renderer. The
complete engineering archive and retained-room return are preserved. Regression
tests: `node --test tools/readability-tests/featured-hosts.test.mjs` and
`node tools/readability-tests/verify.mjs`. Browser and exact release/online/backup
evidence is recorded outside the public repository in `../.codex/aesthetic-20261012/`.
