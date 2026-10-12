# Homepage presentation · 2026-10-12

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
