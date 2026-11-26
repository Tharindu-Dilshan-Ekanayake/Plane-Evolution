import { CylinderGeometry, OctahedronGeometry } from 'three'

import { PLAZA, SPAWN } from '@shared/world'

import { STYLE } from '../materials'
import { venueOf } from '../sceneStyle'
import { banner, crossedSwords, localBox, wallTorch } from './heraldry'

/**
 * The castle round the courtyard: toy-stone curtain walls just outside the plaza on the
 * south, east and west, and along the north only out beyond the valley's mouth - the
 * throw stage and the road between are left wide open, nothing over them - each with a
 * darker plinth, a string course, a wall-walk coping and merlons along the outer parapet.
 * Square towers stand at the corners and along the walls (arrow slits, a crenellated top,
 * a pointed roof in the academy's blue or red, a gold finial and a pennant), and the spawn
 * gate - a pair of towers, great studded doors in a stone arch and the crest over them -
 * stands behind you as you arrive, between the leaderboards. The academy's banners hang
 * down the inner faces between the towers, with wall torches between them. Out on the
 * hills stand four tall watchtowers, and on the south hills the great banner board with
 * the game's name (a world label, lobbyLabels.js) under a crest of crossed swords.
 *
 * Built in the colours of the world's venue (sceneStyle VENUES `castle`): pale stone,
 * blue and gold at Sunblade Academy, basalt and fire at Dragonfire Peaks.
 *
 * Boxes go into the world's block set and the roofs into its props: no draw calls of their
 * own, nothing to do per frame. Nothing stands inside the plaza (the walls and towers are
 * all outside its edge, where you can't walk). `density` (the preset's decorDensity) thins
 * the merlons, banners and torches on LOW. No two faces share a plane (no z-fighting).
 */

/** The walls' lines, just outside the plaza, and their height, thickness and plinth. */
const WALL = {
  south: PLAZA.maxZ + 3,
  east: PLAZA.maxX + 3.5,
  west: PLAZA.minX - 3.5,
  // Along the north, out beyond the valley's mouth only, its plinth clear of the plaza.
  north: PLAZA.minZ - 0.9,
  height: 6,
  thick: 1.1,
  plinth: 0.9,
}
/** The north walls stop here either side of the valley's mouth (the stage and road stay open). */
export const MOUTH_X = 24.5
/** Towers: their size, height, and where each one stands (never inside the plaza: nothing there has a collider). */
const TOWER = { size: 4.6, height: 10.5 }
const NORTH_TOWERS = PLAZA.minZ - 2.75
/** The spawn gate behind the spawn: its towers either side of the doors. */
export const GATE = { x: SPAWN.x, half: 5.5, width: 7, height: 5.6 }
const TOWERS = [
  // Corners.
  [WALL.west, WALL.south],
  [WALL.east, WALL.south],
  [WALL.west, NORTH_TOWERS],
  [WALL.east, NORTH_TOWERS],
  // South wall: the gate's towers, and one either side behind the leaderboards.
  [GATE.x - GATE.half, WALL.south],
  [GATE.x + GATE.half, WALL.south],
  [-26, WALL.south],
  [26, WALL.south],
  // East and west walls.
  [WALL.east, -12],
  [WALL.east, 14],
  [WALL.east, 40],
  [WALL.west, -12],
  [WALL.west, 14],
  [WALL.west, 40],
  // The north walls' ends at the valley's mouth, and one between each and the corner.
  [-MOUTH_X, NORTH_TOWERS],
  [MOUTH_X, NORTH_TOWERS],
  [-36, NORTH_TOWERS],
  [36, NORTH_TOWERS],
]

/** Wall runs: [x0, z0, x1, z1] centre lines, each facing into the courtyard (`face`: its inner normal). */
const RUNS = [
  { from: [WALL.west, WALL.south], to: [WALL.east, WALL.south], face: [0, -1] },
  { from: [WALL.east, WALL.north], to: [WALL.east, WALL.south], face: [-1, 0] },
  { from: [WALL.west, WALL.north], to: [WALL.west, WALL.south], face: [1, 0] },
  { from: [WALL.west, WALL.north], to: [-MOUTH_X, WALL.north], face: [0, 1] },
  { from: [MOUTH_X, WALL.north], to: [WALL.east, WALL.north], face: [0, 1] },
]

const ROOF = new CylinderGeometry(0, 1, 1, 4)
const FINIAL = new OctahedronGeometry(1, 0)

/** A box along a wall run: `a` along it (from..to), `u` across (inner face +), `y` up. */
function runBox(blocks, run, a0, a1, u0, u1, y0, y1, color, style = STYLE.STUDS) {
  const [x0, z0] = run.from
  const [x1] = run.to
  const a = (a0 + a1) / 2
  const u = (u0 + u1) / 2
  const length = a1 - a0
  if (x0 !== x1) blocks.add(x0 + a, (y0 + y1) / 2, z0 + run.face[1] * u, length, y1 - y0, u1 - u0, color, style)
  else blocks.add(x0 + run.face[0] * u, (y0 + y1) / 2, z0 + a, u1 - u0, y1 - y0, length, color, style)
}

/** One curtain wall run: plinth, body, string course, coping, merlons on the outer edge. */
function buildRun(blocks, run, c, { merlonEvery }) {
  const [x0, z0] = run.from
  const [x1, z1] = run.to
  const length = Math.hypot(x1 - x0, z1 - z0)
  const t = WALL.thick
  const h = WALL.height
  runBox(blocks, run, 0, length, -t / 2 - 0.2, t / 2 + 0.2, 0, WALL.plinth, c.dark, STYLE.STUDS)
  runBox(blocks, run, 0, length, -t / 2, t / 2, WALL.plinth, h, c.stone[0], STYLE.STUDS)
  // A darker string course halfway up, proud of both faces.
  runBox(blocks, run, 0, length, -t / 2 - 0.06, t / 2 + 0.06, h * 0.55, h * 0.55 + 0.3, c.stone[2], STYLE.SMOOTH)
  // The wall-walk's coping, overhanging a little.
  runBox(blocks, run, 0, length, -t / 2 - 0.12, t / 2 + 0.12, h, h + 0.3, c.cap, STYLE.SMOOTH)
  // Merlons along the outer edge (the courtyard sees their silhouettes against the sky).
  for (let a = merlonEvery / 2; a < length - 0.5; a += merlonEvery) {
    runBox(blocks, run, a - 0.45, a + 0.45, -t / 2 - 0.06, -t / 2 + 0.44, h + 0.3, h + 1.15, c.stone[1], STYLE.STUDS)
  }
}

/** Is (x, z) by a tower or the gate? (Banners and torches keep clear of them.) */
const crowded = (x, z, clear) =>
  TOWERS.some(([tx, tz]) => Math.abs(tx - x) < clear && Math.abs(tz - z) < clear) ||
  (Math.abs(z - WALL.south) < 2 && Math.abs(x - GATE.x) < GATE.half + clear)

/** Banners and torches down a run's inner face, between the towers. */
function dressRun(blocks, run, c, { bannerEvery, torches }) {
  const [x0, z0] = run.from
  const [x1, z1] = run.to
  const length = Math.hypot(x1 - x0, z1 - z0)
  const ux = (x1 - x0) / length
  const uz = (z1 - z0) / length
  const yaw = Math.atan2(run.face[0], run.face[1])
  const inner = WALL.thick / 2 + 0.06
  let n = 0
  for (let a = bannerEvery / 2; a < length; a += bannerEvery / 2) {
    const wx = x0 + ux * a
    const wz = z0 + uz * a
    if (crowded(wx, wz, TOWER.size / 2 + 2.2)) continue
    const x = wx + run.face[0] * inner
    const z = wz + run.face[1] * inner
    if (n % 2 === 0) banner(blocks, x, WALL.height - 0.4, z, yaw, 1.9, 3.7, c, { field: n % 4 === 0 ? c.banner : c.bannerAlt })
    else if (torches) wallTorch(blocks, x, 3.2, z, yaw, c)
    n += 1
  }
}

/**
 * A square tower centred at (x, z): plinth, body, arrow slits on all four faces, a
 * corbelled top with merlons round it, a pointed roof (props) with a gold finial, and a
 * pennant on a pole.
 */
function buildTower(blocks, props, x, z, c, i, { height = TOWER.height, size = TOWER.size, detail = true } = {}) {
  const s = size
  blocks.addOn(x, 0, z, s + 0.5, WALL.plinth + 0.2, s + 0.5, c.dark, STYLE.STUDS)
  blocks.addOn(x, WALL.plinth + 0.2, z, s, height - WALL.plinth - 0.2, s, c.stone[i % 2 ? 1 : 0], STYLE.STUDS)
  // Arrow slits, two up each face.
  const slit = c.window === '#ff6a1e' ? STYLE.GLOW : STYLE.SMOOTH
  for (let k = 0; k < 4; k += 1) {
    const yaw = (k * Math.PI) / 2
    for (const y of [height * 0.42, height * 0.72]) localBox(blocks, x, y, z, yaw, 0, 0, s / 2 + 0.02, 0.32, 1.1, 0.06, c.window, slit)
  }
  // The corbelled top: a wider band, then merlons round its edge.
  const top = s + 0.7
  blocks.addOn(x, height, z, top, 0.55, top, c.cap, STYLE.SMOOTH)
  const m = detail ? 4 : 2
  for (let k = 0; k < m; k += 1) {
    const f = (k / (m - 1) - 0.5) * (top - 0.6)
    for (const side of [-1, 1]) {
      blocks.addOn(x + f, height + 0.55, z + side * (top / 2 - 0.3), 0.6, 0.85, 0.6, c.stone[1], STYLE.STUDS)
      if (Math.abs(f) < top / 2 - 0.5) blocks.addOn(x + side * (top / 2 - 0.3), height + 0.55, z + f, 0.6, 0.85, 0.6, c.stone[1], STYLE.STUDS)
    }
  }
  // The roof, rising from inside the merlons, its finial and pennant.
  const roofH = s * 1.1
  const roof = i % 3 === 2 ? c.roofAlt : c.roof
  props.add(ROOF, { position: [x, height + 0.55 + roofH / 2, z], rotation: [0, Math.PI / 4, 0], scale: [s * 0.72, roofH, s * 0.72], color: roof, style: STYLE.STUDS })
  props.add(FINIAL, { position: [x, height + 0.6 + roofH + 0.15, z], scale: 0.3, color: c.trim, style: STYLE.GLOW })
  if (detail) {
    blocks.addOn(x, height + 0.6 + roofH + 0.3, z, 0.1, 2.2, 0.1, c.dark, STYLE.SMOOTH)
    blocks.add(x + 0.7, height + 0.6 + roofH + 2.1, z, 1.3, 0.62, 0.05, i % 2 ? c.bannerAlt : c.banner, STYLE.SMOOTH)
  }
}

/**
 * The spawn gate on the south wall's inner face, between its two towers: great studded
 * wooden doors with iron bands in a stone arch, a gold-lit keystone, the crest of crossed
 * swords over it and a banner either side.
 */
function buildGate(blocks, c, detail) {
  const z = WALL.south - WALL.thick / 2
  const yaw = 0
  const face = (lz) => -lz
  const { width, height } = GATE
  // The arch's frame, standing proud of the wall.
  localBox(blocks, GATE.x, height / 2 + 0.2, z, yaw, 0, 0, face(0.25), width + 1.4, height + 0.4, 0.5, c.stone[2], STYLE.STUDS)
  localBox(blocks, GATE.x, height + 0.75, z, yaw, 0, 0, face(0.3), width + 2.2, 0.7, 0.6, c.cap, STYLE.SMOOTH)
  // The doors (a little proud of the frame), their seam, iron bands and studs.
  localBox(blocks, GATE.x, height / 2 + 0.05, z, yaw, 0, 0, face(0.56), width, height - 0.1, 0.12, c.wood, STYLE.SMOOTH)
  localBox(blocks, GATE.x, height / 2 + 0.05, z, yaw, 0, 0, face(0.64), 0.1, height - 0.2, 0.06, c.dark, STYLE.SMOOTH)
  for (const y of [1.1, 2.8, 4.5]) localBox(blocks, GATE.x, y, z, yaw, 0, 0, face(0.65), width - 0.3, 0.22, 0.06, c.dark, STYLE.SMOOTH)
  for (const side of [-1, 1]) localBox(blocks, GATE.x + side * 0.6, 2.6, z, yaw, 0, 0, face(0.7), 0.3, 0.3, 0.12, c.trim, STYLE.GLOW)
  // The keystone, a stone pediment rising over the gate, and the crest on it.
  localBox(blocks, GATE.x, height + 0.75, z, yaw, 0, 0, face(0.66), 0.9, 1.0, 0.2, c.trim, STYLE.GLOW, Math.PI / 4)
  localBox(blocks, GATE.x, height + 3.05, z, yaw, 0, 0, face(0.25), 4.6, 3.9, 0.5, c.stone[1], STYLE.STUDS)
  localBox(blocks, GATE.x, height + 5.1, z, yaw, 0, 0, face(0.3), 5.0, 0.3, 0.7, c.cap, STYLE.SMOOTH)
  if (detail) {
    crossedSwords(blocks, GATE.x, height + 3.0, z, Math.PI, 0, 0, 0.7, 3.4, { blade: c.blade, trim: c.trim, grip: c.wood })
    // A banner down each gate tower's courtyard face.
    for (const side of [-1, 1]) banner(blocks, GATE.x + side * GATE.half, height + 2.6, WALL.south - TOWER.size / 2 - 0.06, Math.PI, 1.6, 4.2, c, { field: side < 0 ? c.banner : c.bannerAlt })
  }
}

/**
 * A tall watchtower out on the hills at (x, z): a wide stone shaft with a beacon chamber
 * at the top glowing out through its windows, merlons, a pointed roof and a great banner
 * hanging down the face turned to the courtyard.
 */
export function addWatchtower(blocks, props, x, z, v, i = 0) {
  const c = v.castle
  const height = 30
  const s = 6
  blocks.addOn(x, 0, z, s + 1, 2, s + 1, c.dark, STYLE.STUDS)
  blocks.addOn(x, 2, z, s, height - 2, s, c.stone[i % 2], STYLE.STUDS)
  blocks.add(x, height * 0.5, z, s + 0.12, 0.4, s + 0.12, c.stone[2], STYLE.SMOOTH)
  // The beacon chamber: four pillars round a glowing core.
  blocks.addOn(x, height, z, s + 1.2, 0.6, s + 1.2, c.cap, STYLE.SMOOTH)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) blocks.addOn(x + dx * (s / 2 - 0.2), height + 0.6, z + dz * (s / 2 - 0.2), 0.9, 3, 0.9, c.stone[1], STYLE.STUDS)
  blocks.addOn(x, height + 0.6, z, s - 2.2, 2.4, s - 2.2, c.glow, STYLE.GLOW)
  blocks.addOn(x, height + 3.6, z, s + 1.2, 0.6, s + 1.2, c.cap, STYLE.SMOOTH)
  const roofH = 7
  props.add(ROOF, { position: [x, height + 4.2 + roofH / 2, z], rotation: [0, Math.PI / 4, 0], scale: [s * 0.78, roofH, s * 0.78], color: c.roof, style: STYLE.STUDS })
  props.add(FINIAL, { position: [x, height + 4.3 + roofH + 0.3, z], scale: 0.55, color: c.trim, style: STYLE.GLOW })
  // The banner down the face that looks towards the courtyard (snapped to a face of the shaft).
  const yaw = Math.round(Math.atan2(0 - x, 14 - z) / (Math.PI / 2)) * (Math.PI / 2)
  const out = s / 2 + 0.06
  banner(blocks, x + Math.sin(yaw) * out, height - 2, z + Math.cos(yaw) * out, yaw, 3.2, 10, c, { field: i % 2 ? c.bannerAlt : c.banner })
}

/** The watchtowers, out on the hills beyond the castle's four corners. */
export const WATCHTOWERS = [
  [50, PLAZA.maxZ + 18],
  [-50, PLAZA.maxZ + 18],
  [54, PLAZA.minZ - 10],
  [-54, PLAZA.minZ - 10],
]

/** The great banner board on the south hills, on two pylons: its lettering is a world label (lobbyLabels.js). */
export const SCOREBOARD = { x: 0, z: PLAZA.maxZ + 14, y: 23.6, width: 30, height: 12 }

/**
 * The great board: two stone pylons, a stone frame with a gold-lit edge round the board's
 * dark face (the game's name is a world label on it), a row of lanterns along its top and
 * the academy's crest - a pair of giant crossed swords - standing over it.
 */
export function addScoreboard(blocks, v) {
  const c = v.castle
  const { x, z, y, width, height } = SCOREBOARD
  for (const side of [-1, 1]) {
    blocks.addOn(x + side * (width / 2 - 3), 0, z + 0.4, 2.2, y, 2, c.stone[1], STYLE.STUDS)
    blocks.addOn(x + side * (width / 2 - 3), y - 1.2, z + 0.4, 2.8, 1.2, 2.6, c.cap, STYLE.SMOOTH)
  }
  blocks.addOn(x, y, z, width + 1.6, height + 1.6, 1.4, c.stone[0], STYLE.STUDS)
  blocks.addOn(x, y + 0.8, z - 0.2, width, height, 1.4, v.board ?? '#14234a', STYLE.SMOOTH)
  blocks.addOn(x, y + 0.5, z - 1, width - 0.6, 0.35, 0.2, c.trim, STYLE.GLOW)
  blocks.addOn(x, y + height + 0.7 - 0.35, z - 1, width - 0.6, 0.35, 0.2, c.trim, STYLE.GLOW)
  for (const side of [-1, 1]) blocks.addOn(x + side * (width / 2 - 0.3), y + 0.8, z - 1, 0.35, height, 0.2, c.trim, STYLE.GLOW)
  for (let i = 0; i < 8; i += 1) {
    blocks.addOn(x - width / 2 + 2 + i * ((width - 4) / 7), y + height + 1.6, z, 1.1, 1.1, 1.1, i % 2 ? c.trim : c.glow, STYLE.GLOW)
  }
  // The crest over the board, facing the courtyard (north).
  crossedSwords(blocks, x, y + height + 8.5, z, Math.PI, 0, 0, 0.3, 13, { blade: c.blade, trim: c.trim, grip: c.wood })
  localBox(blocks, x, y + height + 6.6, z, Math.PI, 0, 0, 0.9, 4.2, 4.6, 0.5, c.trim, STYLE.SMOOTH)
  localBox(blocks, x, y + height + 6.7, z, Math.PI, 0, 0, 1.2, 3.5, 3.9, 0.3, c.banner, STYLE.SMOOTH)
  localBox(blocks, x, y + height + 4.2, z, Math.PI, 0, 0, 1.05, 2.6, 2.6, 0.4, c.banner, STYLE.SMOOTH, Math.PI / 4)
}

/**
 * Builds the castle into `blocks` (roofs into `props`) in the colours of `world`'s venue.
 * `density` (0-1, the preset's decorDensity): LOW gets merlons every 4 m instead of 2,
 * fewer banners and no torches. Returns how many towers were built (for tests/debug).
 */
export function buildCastle(blocks, props, { density = 1, world = 0 } = {}) {
  const c = venueOf(world).castle
  const detail = density >= 0.5
  for (const run of RUNS) {
    buildRun(blocks, run, c, { merlonEvery: detail ? 2 : 4 })
    dressRun(blocks, run, c, { bannerEvery: detail ? 11 : 22, torches: detail })
  }
  TOWERS.forEach(([x, z], i) => buildTower(blocks, props, x, z, c, i, { detail }))
  buildGate(blocks, c, detail)
  // Torches on the north end towers' inner faces, lighting the valley's mouth.
  if (detail) {
    for (const side of [-1, 1]) {
      for (const dx of [-1.2, 1.2]) wallTorch(blocks, side * MOUTH_X + dx, 3.6, NORTH_TOWERS + TOWER.size / 2 + 0.02, 0, c)
    }
  }
  return TOWERS.length
}
