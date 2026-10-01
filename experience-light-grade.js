// Art-directed response to the existing Cycles bake and source PBR materials.
// Exposure/albedo/textures stay fixed. Daytime fill and cabinet lighting leave
// highlight headroom; the accepted night rig is retained byte-for-byte here.
export const ROOM_LIGHT_GRADE = Object.freeze({
  day: Object.freeze({ key: .86, hemi: .54, fill: .16, env: .32, bench: 0, resume: 0, moon: 0, pendant: 1.9, cabinet: .72, deskBake: .5 }),
  night: Object.freeze({ key: .22, hemi: .16, fill: .05, env: .35, bench: .95, resume: 1.5, moon: 11, pendant: .3, cabinet: 1, deskBake: .7 }),
});
