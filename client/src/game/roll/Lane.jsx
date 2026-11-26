import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  Color,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three'

import { zoneIndexAt } from '@shared/logic'

import { getQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { venueOf } from '../sceneStyle'
import { activeWorld, blendSky, perWorld, skyLook, zones } from '../worldLook'
import { SLOPE_EULER_X, slopeBoxMatrix, trackPoint } from './path'
import { roll } from './rollControl'
import { LANE_STRIPE, STAGE_LOOKS, ZONE_THEMES } from './themes'

/**
 * The royal road the sword flies down, going on forever: a cobbled road down the middle
 * of a long valley, kerb stones along both edges, its distance painted on it every 10
 * metres ("1,340 m"), a lantern on each kerb every 20 metres glowing in the stage's
 * colour, a pair of tall stone obelisks with glowing rune caps every 100 metres for the
 * sword to fly between, a stage marker at the start of every stage - a crenellated stone
 * tower either side of the road with a beacon and a torch, and its name and length on a
 * carved board on a signpost beside the road ("Maple Woods - 106 M") - tall banner poles
 * flying the stage's colours, and trees, bushes, rocks and flower beds just past the
 * kerbs. Nothing stands over the road itself (|x| < 9): the sword's flight is never
 * hidden, and from the chase camera every board reads off to the side. Beyond,
 * the turf runs out to blocky hills in the stage's own look - grassy with trees,
 * sandstone with cacti, snowy with pines, candy with lollipops, glowing lava with
 * obsidian spikes, a neon city, crystals, clouds, moon rock... In Dragonfire Peaks (the
 * lava venue) everything is basalt and obsidian: the kerbs are glowing lava channels in
 * the stage's colour, braziers burn where the lanterns stand, and obsidian spikes, dead
 * trees, lava rocks and torches stand out on the ash, with the lava sea to the east. Each
 * stage brings its own road, turf and stone (STAGE_LOOKS), its own sky (blended in as
 * the sword gets there: ZONE_THEMES) and a glowing line across the road where it starts.
 *
 * Nothing is built per stretch of road. A fixed set of pieces - ground squares, road
 * rows, turf rows and kerb stones, hill slots, lanterns, obelisks, stage markers, banner
 * poles, roadside clutter, a pool of numerals and the markers' name boards - is moved along to
 * wherever you're looking (the sword in flight, the start from the lobby) and recoloured
 * for the stage it lands in. Every pool is a ring: a piece is only placed again when its
 * slot is handed to a new stretch, so racing down the road at hundreds of metres a second
 * touches a handful of pieces a frame. Six draw calls, the same at 60 m or 26 km, and
 * nothing allocated while it runs. On LOW (the preset's decorDensity) the roadside
 * clutter, half the banner poles and half the hills are left out, and the view is shorter
 * (viewDistance).
 *
 * Layers that lie on each other are always at least 3 cm apart (ground 0, turf 0.04, road
 * 0.08, numerals 0.12, stage lines 0.15, everything standing on the turf from 0.04), so
 * nothing z-fights.
 */

const STRIPE = LANE_STRIPE
/** Rows drawn at once: an even number, so each row keeps its light/dark as it's reused. */
const STRIPES = 128
/** Width of the road (the sword flies within |x| <= 7 of its middle). */
export const LANE_WIDTH = 16
const ROAD_HALF = LANE_WIDTH / 2
const FIELD_WIDTH = 280
/** The road starts this far behind the focus (never before the start line). */
const BEHIND = 40
const FIELD_LENGTH = STRIPES * STRIPE
/** The ground is laid in squares this long, each in its stage's look. */
const SEGMENT = 8
const SEGMENTS = FIELD_LENGTH / SEGMENT
/** Ground boxes: the squares, then the stage lines across the road. */
const STAGE_LINE = SEGMENTS
const STAGE_LINES = 7
/** Heights of the layers: the turf's top, the road's top, the numerals and the stage lines. */
const TURF_TOP = 0.04
const ROAD_TOP = 0.08
const GLYPH_Y = 0.12
const LINE_Y = 0.125
/** Kerb stones: their width and height, between the road and the turf. */
const KERB_W = 0.7
const KERB_H = 0.26
const KERB_OUT = ROAD_HALF + KERB_W
/** The turf beside the road runs out this far either side. */
const SIDE_TURF_X = 44
/** Road rows, then the turf rows either side, then the kerb stones either side (stripes mesh). */
const TURF_ROWS = STRIPES
const KERBS = STRIPES * 3
const STRIPE_BOXES = STRIPES * 5

/** Hill slots: one hill every CITY_EVERY metres, alternating sides, beyond the turf's near part. */
const CITY_EVERY = 10
const CITY_SLOTS = Math.ceil(FIELD_LENGTH / CITY_EVERY) + 2
const PARTS = 4

/** Parsed colours, by hex, so recolouring allocates nothing once warmed up. */
const colorCache = new Map()
function colorOf(hex) {
  let c = colorCache.get(hex)
  if (!c) {
    c = new Color(hex)
    colorCache.set(hex, c)
  }
  return c
}
const col = (c) => (typeof c === 'string' ? colorOf(c) : c)

/** Materials STYLE ids by name (STAGE_LOOKS names them). */
const styleId = (name) => STYLE[name] ?? STYLE.STUDS

/** The venue of the world being shown (sceneStyle VENUES): only whether it's the lava one. */
const isLava = () => Boolean(venueOf(activeWorld())?.lava)

const BASALT = new Color('#2a2224')
const OBSIDIAN = new Color('#16101a')
const IRON = colorOf('#2b2b34')
const WOOD = colorOf('#4a3020')
const FLAME = colorOf('#ffb21a')
const FLAME_CORE = colorOf('#ffe98a')
const GOLD = colorOf('#ffd21f')

/**
 * Each theme's road paint, parsed once per venue (so frame code only reads Colors):
 * World 1 as STAGE_LOOKS says; the lava venue darkened towards basalt, its kerbs glowing
 * lava channels in the stage's gate colour, its flower beds embers.
 */
function buildLooks(lava) {
  const out = {}
  for (const [id, look] of Object.entries(STAGE_LOOKS)) {
    const gate = new Color(ZONE_THEMES[id]?.gate ?? '#ffc21a')
    const c = (hex) => new Color(hex)
    const dark = (hex, k) => new Color(hex).lerp(BASALT, k)
    out[id] = lava
      ? {
          road: look.road.map((h) => dark(h, 0.82)),
          roadStyle: STYLE.STUDS,
          kerb: [gate, gate.clone().lerp(FLAME, 0.4)],
          kerbStyle: STYLE.LAVA,
          side: look.turf.map((h) => dark(h, 0.78)),
          field: look.style === 'LAVA' ? c(look.field) : dark(look.field, 0.8),
          fieldStyle: look.style === 'LAVA' ? STYLE.LAVA : STYLE.STUDS,
          stone: look.stone.map((h, i) => new Color(h).lerp(i ? OBSIDIAN : BASALT, 0.8)),
          gate,
          flowers: [gate, FLAME],
          leaves: c(look.hill.leaves),
          trunk: c(look.hill.trunk),
          decor: look.hill.decor,
        }
      : {
          road: look.road.map(c),
          roadStyle: styleId(look.roadStyle ?? 'STUDS'),
          kerb: look.kerb.map(c),
          kerbStyle: styleId(look.kerbStyle ?? 'SMOOTH'),
          side: look.turf.map(c),
          field: c(look.field),
          fieldStyle: styleId(look.style),
          stone: look.stone.map(c),
          gate,
          flowers: look.flowers.map(c),
          leaves: c(look.hill.leaves),
          trunk: c(look.hill.trunk),
          decor: look.hill.decor,
        }
  }
  return out
}
const LOOKS = [buildLooks(false), buildLooks(true)]
/** The road paint at metre `meter` in the venue being shown. */
const paintAt = (meter, lava) => {
  const looks = LOOKS[lava ? 1 : 0]
  return looks[zones()[zoneIndexAt(meter)]?.theme] ?? looks.grassy
}
const lookAt = (meter) => STAGE_LOOKS[zones()[zoneIndexAt(meter)]?.theme] ?? STAGE_LOOKS.grassy

/** Each stage's sky, parsed once per world. */
const stageSkies = perWorld((zs) => zs.map((z) => skyLook(ZONE_THEMES[z.theme]?.sky ?? ZONE_THEMES.grassy.sky)))
/** A stable pseudo-random 0-1 for piece `k` (and a salt): the same on every client. */
function hash(k, salt) {
  let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

const _m = new Matrix4()
const _p = new Vector3()
const _s = new Vector3()
const _q = new Quaternion()
const _e = new Euler()
const ZERO = new Matrix4().makeScale(0, 0, 0)

/**
 * Places instance `i` of a road mesh: a box `sx` across, `sy` tall and `sz` along the road,
 * its centre at metre `m`, `x` across and `h` up, turned `rotY` about the vertical and
 * `rotZ` about the road's axis; in `color` (a Color or hex) and `style`.
 */
function box(mesh, styles, i, m, x, h, sx, sy, sz, color, style, rotY = 0, rotZ = 0) {
  trackPoint(m, x, h, _p)
  _q.setFromEuler(_e.set(m > 0 ? SLOPE_EULER_X : 0, rotY, rotZ))
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(sx, sy, sz)))
  mesh.setColorAt(i, col(color))
  styles[i] = style
}
const hide = (mesh, from, count) => {
  for (let i = from; i < from + count; i += 1) mesh.setMatrixAt(i, ZERO)
}

// --- Where the stages start: their markers, and what makes way for them ---------------------
//
// Nothing stands over the swords' flight corridor (|x| < CORRIDOR) higher than the kerbs:
// every stage marker, lantern, obelisk, pole and roadside piece keeps outside it.

/** Half the width kept clear over the road: the swords fly within |x| <= 6.5. */
const CORRIDOR = 9
/**
 * The first stage's marker stands this far down the road, past the lobby's THROW STAGE
 * (x within 18, up to metre 0), and further out to the sides than the rest: swords thrown
 * from the stage's far ends are still easing in towards their lanes over the first metres.
 */
const FIRST_MARKER = 18
/** Over the first START_CLEAR metres everything stands at least START_X out from the middle. */
const START_CLEAR = 45
const START_X = 20
/** A stage marker's name board stands on its signpost this far before (south of) its towers. */
const SIGN_BACK = 6
/** The metre of stage `i`'s marker towers. */
const markerMeter = (i) => (i === 0 ? FIRST_MARKER : zones()[i].start)
/** Whether a stage marker's towers or its signpost stand within `d` metres of metre `m`. */
function markerNear(m, d) {
  if (Math.abs(m - FIRST_MARKER) < d || Math.abs(m - FIRST_MARKER + SIGN_BACK) < d) return true
  // Only the last stage starting before m + d + SIGN_BACK can be that close: stages are 94 m and more apart.
  const zi = zoneIndexAt(m + d + SIGN_BACK)
  if (zi <= 0) return false
  const start = zones()[zi].start
  return Math.abs(m - start) < d || Math.abs(m - start + SIGN_BACK) < d
}
/** Whether an obelisk pair stands within `d` metres of metre `m` (one every 100 m, none by a stage marker). */
function obeliskNear(m, d) {
  const k = Math.round(m / OB_EVERY)
  return k >= 1 && Math.abs(m - k * OB_EVERY) < d && !markerNear(k * OB_EVERY, OB_ARCH_GAP)
}

// --- The landmarks: lanterns, obelisks, stage markers, banner poles, roadside clutter ------
//
// One box mesh, in regions, each a ring of slots: a slot is laid again only when a new
// stretch of road takes it (Lane's `laid` records which piece each slot holds).

const LANTERN_EVERY = 20
const LANTERN_SLOTS = Math.ceil(FIELD_LENGTH / LANTERN_EVERY) + 2
const LANTERN_PARTS = 4
/** The lanterns stand just past the kerb stones, their widest part (a brazier's bowl) clear of the corridor. */
const LANTERN_X = CORRIDOR + 1.4

const OB_EVERY = 100
const OB_SLOTS = Math.ceil(FIELD_LENGTH / OB_EVERY) + 2
const OB_PARTS = 4
const OB_X = ROAD_HALF + 3.6
/** No obelisks within this of a stage marker: its towers stand in for them. */
const OB_ARCH_GAP = 9

/** Stage markers: one per stage start in view; their boards' atlas rows match the slots. */
const BANNERS = 8
const ARCH_PARTS = 22
/** A marker's towers: their middle either side of the road, their width and height. */
const TOWER_X = ROAD_HALF + 4.2
const TOWER_W = 2.6
const TOWER_H = 9
/**
 * The name board on its signpost, beside the road: its size (the atlas row's 4:1), the
 * height of its middle - low enough to read from the chase camera, bottom 2.9 m and top
 * 5.9 m - and how far out its inner edge stands (the frame adds 0.25).
 */
const BANNER = { width: 12, height: 3, y: 4.4 }
const SIGN_IN = CORRIDOR + 0.9

const POLE_EVERY = 60
const POLE_SLOTS = Math.ceil(FIELD_LENGTH / POLE_EVERY) + 2
const POLE_PARTS = 4
const POLE_X = ROAD_HALF + 5.4

const NEAR_EVERY = 9
const NEAR_SLOTS = Math.ceil(FIELD_LENGTH / NEAR_EVERY) + 2
const NEAR_PARTS = 3

const LANTERNS = 0
const OBELISKS = LANTERNS + LANTERN_SLOTS * 2 * LANTERN_PARTS
const ARCHES = OBELISKS + OB_SLOTS * 2 * OB_PARTS
const POLES = ARCHES + BANNERS * ARCH_PARTS
const NEAR = POLES + POLE_SLOTS * POLE_PARTS
const MARKS = NEAR + NEAR_SLOTS * NEAR_PARTS

function createMarks() {
  const set = new BlockSet()
  for (let i = 0; i < MARKS; i += 1) set.add(0, 0, 0, 0, 0, 0, '#ffffff', STYLE.SMOOTH)
  const mesh = set.build(sharedMaterials().blocks)
  mesh.frustumCulled = false
  return mesh
}

/**
 * The lanterns at slot metre `k` (both kerbs): a stone foot, a dark post, a lantern glowing
 * in the stage's gate colour and an iron cap - or, in the lava venue, a brazier: a basalt
 * pillar, an iron bowl and its fire. Left out over the first START_CLEAR metres and where
 * a stage marker or an obelisk stands.
 */
function placeLantern(marks, styles, k, lava) {
  const m = k * LANTERN_EVERY + LANTERN_EVERY / 2
  const base = LANTERNS + (k % LANTERN_SLOTS) * 2 * LANTERN_PARTS
  if (m < START_CLEAR || markerNear(m, 4.5) || obeliskNear(m, 3)) {
    hide(marks, base, 2 * LANTERN_PARTS)
    return
  }
  const look = paintAt(m, lava)
  for (let side = 0; side < 2; side += 1) {
    const x = (side ? 1 : -1) * LANTERN_X
    const i = base + side * LANTERN_PARTS
    if (lava) {
      const turn = hash(k * 2 + side, 11) * Math.PI
      box(marks, styles, i, m, x, TURF_TOP + 0.6, 0.9, 1.2, 0.9, look.stone[0], STYLE.STUDS)
      box(marks, styles, i + 1, m, x, TURF_TOP + 1.35, 1.4, 0.3, 1.4, IRON, STYLE.SMOOTH, Math.PI / 4)
      box(marks, styles, i + 2, m, x, TURF_TOP + 1.95, 0.95, 0.9, 0.95, look.gate, STYLE.GLOW, turn)
      box(marks, styles, i + 3, m, x, TURF_TOP + 2.3, 0.45, 0.7, 0.45, FLAME_CORE, STYLE.GLOW, turn + 0.6)
    } else {
      box(marks, styles, i, m, x, TURF_TOP + 0.25, 0.7, 0.5, 0.7, look.stone[1], STYLE.STUDS)
      box(marks, styles, i + 1, m, x, TURF_TOP + 1.9, 0.24, 2.8, 0.24, WOOD, STYLE.SMOOTH)
      box(marks, styles, i + 2, m, x, TURF_TOP + 3.55, 0.62, 0.72, 0.62, look.gate, STYLE.GLOW)
      box(marks, styles, i + 3, m, x, TURF_TOP + 4.0, 0.86, 0.2, 0.86, IRON, STYLE.SMOOTH, Math.PI / 4)
    }
  }
}

/**
 * The obelisk pair at 100-metre mark `k`: a stone plinth, a tall shaft, a glowing rune band
 * and a floating rune crystal on top, in the stage's stone and gate colour (obsidian with a
 * lava band and a flame in the lava venue).
 */
function placeObelisk(marks, styles, k, lava) {
  const m = k * OB_EVERY
  const base = OBELISKS + (k % OB_SLOTS) * 2 * OB_PARTS
  if (k < 1 || markerNear(m, OB_ARCH_GAP)) {
    hide(marks, base, 2 * OB_PARTS)
    return
  }
  const look = paintAt(m, lava)
  for (let side = 0; side < 2; side += 1) {
    const x = (side ? 1 : -1) * OB_X
    const i = base + side * OB_PARTS
    box(marks, styles, i, m, x, TURF_TOP + 0.6, 2.4, 1.2, 2.4, look.stone[1], STYLE.STUDS)
    box(marks, styles, i + 1, m, x, TURF_TOP + 1.2 + 4.5, 1.4, 9, 1.4, look.stone[0], STYLE.STUDS)
    box(marks, styles, i + 2, m, x, TURF_TOP + 6.9, 1.54, 0.5, 1.54, look.gate, lava ? STYLE.LAVA : STYLE.GLOW)
    box(marks, styles, i + 3, m, x, TURF_TOP + 11.05, 1.1, 1.3, 1.1, lava ? FLAME : look.gate, STYLE.GLOW, Math.PI / 4)
  }
}

/** Where stage `index`'s name board stands: its metre, and its middle across the road (one side, alternating). */
const signMeter = (index) => markerMeter(index) - SIGN_BACK
function signX(index) {
  const side = index % 2 ? 1 : -1
  const inner = index === 0 ? FIRST_TOWER_X - TOWER_W / 2 : SIGN_IN
  return side * (inner + 0.25 + BANNER.width / 2)
}
/** The first stage's towers stand this far out (START_X and more, clear of the throw stage's swords). */
const FIRST_TOWER_X = START_X + 2

/**
 * Stage `index`'s marker in marker slot `slot`, all of it beside the road - nothing over
 * it: a stone tower either side, outside the kerbs, with a band, four merlons, a floating
 * beacon in the stage's colour and a torch facing the road; and, SIGN_BACK metres before
 * them on one side (alternating stage by stage), the stage's name board on a signpost -
 * its frame, two posts, a beam over it and a glowing finial at each end (the board's
 * lettering itself is the banners mesh). The first stage's marker stands further out.
 */
function placeMarker(marks, styles, slot, index, lava) {
  const m = markerMeter(index)
  const base = ARCHES + slot * ARCH_PARTS
  const look = paintAt(m, lava)
  const stone = look.stone[0]
  const trim = look.stone[1]
  const bandStyle = lava ? STYLE.LAVA : STYLE.STUDS
  const band = lava ? look.gate : trim
  const towerX = index === 0 ? FIRST_TOWER_X : TOWER_X
  const top = TURF_TOP + TOWER_H
  let i = base
  for (let side = 0; side < 2; side += 1) {
    const s = side ? 1 : -1
    const x = s * towerX
    box(marks, styles, i++, m, x, TURF_TOP + TOWER_H / 2, TOWER_W, TOWER_H, TOWER_W, stone, STYLE.STUDS)
    box(marks, styles, i++, m, x, top + 0.35, TOWER_W + 0.6, 0.7, TOWER_W + 0.6, band, bandStyle)
    for (let c = 0; c < 4; c += 1) {
      const dx = c % 2 ? 0.95 : -0.95
      const dm = c < 2 ? -0.95 : 0.95
      box(marks, styles, i++, m + dm, x + dx, top + 1.1, 0.75, 0.8, 0.75, stone, STYLE.STUDS)
    }
    box(marks, styles, i++, m, x, top + 2.4, 0.9, 1.1, 0.9, look.gate, STYLE.GLOW, Math.PI / 4)
    // The torch on the face towards the road.
    box(marks, styles, i++, m, x - s * (TOWER_W / 2 + 0.25), TURF_TOP + 5.6, 0.45, 0.65, 0.45, FLAME, STYLE.GLOW, Math.PI / 4)
  }
  // The signpost: the board's frame, its two posts behind it, the beam over it and its finials.
  const mb = signMeter(index)
  const bx = signX(index)
  const boardTop = BANNER.y + BANNER.height / 2 + 0.25
  const beamY = boardTop + 0.2
  const wood = lava ? OBSIDIAN : WOOD
  box(marks, styles, i++, mb, bx, BANNER.y, BANNER.width + 0.5, BANNER.height + 0.5, 0.4, wood, STYLE.SMOOTH)
  for (let e = -1; e <= 1; e += 2) {
    box(marks, styles, i++, mb + 0.38, bx + e * (BANNER.width / 2 - 1.2), (TURF_TOP + beamY) / 2, 0.36, beamY - TURF_TOP, 0.36, trim, STYLE.STUDS)
  }
  box(marks, styles, i++, mb + 0.1, bx, beamY, BANNER.width + 1.2, 0.36, 0.7, trim, STYLE.STUDS)
  for (let e = -1; e <= 1; e += 2) {
    box(marks, styles, i++, mb + 0.1, bx + e * (BANNER.width / 2 + 0.6), beamY + 0.42, 0.42, 0.42, 0.42, look.gate, STYLE.GLOW, Math.PI / 4)
  }
}

/**
 * The banner pole at slot metre `k` (alternating sides): a tall pole, a crossbar, a long
 * flag in the stage's colours hanging towards the road and a glowing gold finial. Every
 * other one on LOW.
 */
function placePole(marks, styles, k, lava, sparse) {
  const m = k * POLE_EVERY + POLE_EVERY / 2
  const base = POLES + (k % POLE_SLOTS) * POLE_PARTS
  if (m < START_CLEAR || (sparse && k % 2) || markerNear(m, 6) || obeliskNear(m, 4)) {
    hide(marks, base, POLE_PARTS)
    return
  }
  const look = paintAt(m, lava)
  const side = k % 2 ? 1 : -1
  const x = side * POLE_X
  const fx = x - side * 1.0
  box(marks, styles, base, m, x, TURF_TOP + 4, 0.22, 8, 0.22, lava ? IRON : look.stone[1], STYLE.SMOOTH)
  box(marks, styles, base + 1, m, fx, TURF_TOP + 7.7, 2.2, 0.16, 0.16, IRON, STYLE.SMOOTH)
  box(marks, styles, base + 2, m, fx, TURF_TOP + 5.9, 1.8, 3.4, 0.12, (k >> 1) % 2 ? look.flowers[0] : look.gate, lava ? STYLE.LAVA : STYLE.SMOOTH)
  box(marks, styles, base + 3, m, x, TURF_TOP + 8.25, 0.42, 0.42, 0.42, GOLD, STYLE.GLOW, Math.PI / 4)
}

/** Reused for the roadside clutter's boxes: [x, h, metre offset, sx, sy, sz, colour, style, turn]. */
const _near = Array.from({ length: NEAR_PARTS }, () => [0, 0, 0, 0, 0, 0, null, 0, 0])
function nearBox(n, x, h, dm, sx, sy, sz, color, style, turn = 0) {
  const b = _near[n]
  b[0] = x
  b[1] = h
  b[2] = dm
  b[3] = sx
  b[4] = sy
  b[5] = sz
  b[6] = color
  b[7] = style
  b[8] = turn
}

/**
 * The roadside clutter at slot metre `k`: something just past the kerb stones on one
 * side - a smaller copy of the stage's own decor (a tree, a pine, a palm, a cactus, a
 * lollipop, a mushroom, a crystal, coral, a neon sign, a cloud, a boulder, an obsidian
 * spike), a pair of bushes, a pair of boulders or a flower bed, with a patch of flowers
 * at its foot. In the lava venue: obsidian shards, lava rocks and ember vents. Left out
 * on LOW, and wherever a stage marker stands; pushed further out by poles and obelisks,
 * and over the first START_CLEAR metres.
 */
function placeNear(marks, styles, k, lava, sparse) {
  const base = NEAR + (k % NEAR_SLOTS) * NEAR_PARTS
  const m = k * NEAR_EVERY + NEAR_EVERY / 2 + (hash(k, 21) - 0.5) * 3
  if (sparse || m < 18 || markerNear(m, 5)) {
    hide(marks, base, NEAR_PARTS)
    return
  }
  const look = paintAt(m, lava)
  const side = hash(k, 22) < 0.5 ? -1 : 1
  const r = hash(k, 23)
  const turn = hash(k, 24) * Math.PI
  // Clear of the obelisks and poles: further out where they stand.
  const crowded = obeliskNear(m, 4) || Math.abs(m - (Math.floor(m / POLE_EVERY) * POLE_EVERY + POLE_EVERY / 2)) < 4
  const x = m < START_CLEAR ? side * (START_X + hash(k, 25) * 8) : side * ((crowded ? POLE_X + 3 : KERB_OUT + 4.5) + hash(k, 25) * 10)
  if (lava) {
    if (r < 0.4) {
      const h = 2.2 + hash(k, 26) * 3
      nearBox(0, x, TURF_TOP + h / 2, 0, 0.9, h, 0.9, OBSIDIAN, STYLE.SMOOTH, turn)
      nearBox(1, x + 0.7, TURF_TOP + h * 0.3, 0.4, 0.6, h * 0.6, 0.6, look.stone[1], STYLE.SMOOTH, turn + 0.7)
      nearBox(2, x - 0.6, TURF_TOP + 0.25, -0.5, 1.1, 0.5, 1, look.gate, STYLE.LAVA, turn)
    } else if (r < 0.75) {
      nearBox(0, x, TURF_TOP + 0.8, 0, 2.2, 1.6, 1.9, look.gate, STYLE.LAVA, turn)
      nearBox(1, x + 1.3, TURF_TOP + 0.5, 0.7, 1.2, 1, 1.1, look.gate, STYLE.LAVA, turn + 0.8)
      nearBox(2, x - 0.4, TURF_TOP + 1.85, 0, 1.2, 0.6, 1, OBSIDIAN, STYLE.SMOOTH, turn + 0.3)
    } else {
      nearBox(0, x, TURF_TOP + 0.12, 0, 2.2, 0.24, 2.2, look.stone[0], STYLE.STUDS, turn)
      nearBox(1, x, TURF_TOP + 0.5, 0, 0.9, 0.6, 0.9, look.gate, STYLE.GLOW, turn)
      nearBox(2, x, TURF_TOP + 1.05, 0, 0.45, 0.6, 0.45, FLAME_CORE, STYLE.GLOW, turn + 0.6)
    }
  } else if (r < 0.45) {
    // The stage's decor, at two thirds the size of the hills', and flowers at its foot.
    const parts = decorParts(look, x, TURF_TOP, k, 0.62)
    for (let n = 0; n < 2; n += 1) {
      const [px, py, , sx, sy, sz, c, st, rot] = parts[n]
      nearBox(n, px, py, 0, sx, sy, sz, c, st, rot)
    }
    nearBox(2, x + 1.2, TURF_TOP + 0.08, 0.9, 2, 0.16, 1.6, look.flowers[k % 2], STYLE.SMOOTH, turn)
  } else if (r < 0.7) {
    // Two round bushes and a few flowers.
    const leaves = look.leaves
    nearBox(0, x, TURF_TOP + 0.7, 0, 1.8, 1.4, 1.6, leaves, STYLE.STUDS, turn)
    nearBox(1, x + 1.4, TURF_TOP + 0.5, 0.8, 1.2, 1, 1.1, leaves, STYLE.STUDS, turn + 0.6)
    nearBox(2, x - 0.6, TURF_TOP + 1.45, 0.2, 0.6, 0.3, 0.6, look.flowers[k % 2], STYLE.SMOOTH, turn)
  } else if (r < 0.88) {
    // A pair of boulders.
    nearBox(0, x, TURF_TOP + 0.9, 0, 2.4, 1.8, 2.2, look.stone[0], STYLE.STUDS, turn)
    nearBox(1, x + 1.6, TURF_TOP + 0.5, 1, 1.3, 1, 1.2, look.stone[1], STYLE.STUDS, turn + 1)
    nearBox(2, x - 1.2, TURF_TOP + 0.08, -0.6, 1.8, 0.16, 1.4, look.flowers[k % 2], STYLE.SMOOTH, turn)
  } else {
    // A flower bed in a stone border.
    nearBox(0, x, TURF_TOP + 0.15, 0, 3.4, 0.3, 2.2, look.stone[1], STYLE.STUDS, turn)
    nearBox(1, x, TURF_TOP + 0.38, 0, 3, 0.2, 0.8, look.flowers[0], STYLE.SMOOTH, turn)
    nearBox(2, x, TURF_TOP + 0.36, 0, 3, 0.16, 1.8, look.flowers[1], STYLE.SMOOTH, turn)
  }
  for (let n = 0; n < NEAR_PARTS; n += 1) {
    const [px, h, dm, sx, sy, sz, c, st, rot] = _near[n]
    box(marks, styles, base + n, m + dm, px, h, sx, sy, sz, c, st, rot)
  }
}

// --- Hills down both sides (one box mesh) --------------------------------------------------

function createCity() {
  const set = new BlockSet()
  for (let i = 0; i < CITY_SLOTS * PARTS; i += 1) set.add(0, 0, 0, 0, 0, 0, '#ffffff', STYLE.SMOOTH)
  const mesh = set.build(sharedMaterials().blocks)
  mesh.frustumCulled = false
  return mesh
}

/**
 * World 1's piece `k` in a hill slot: a blocky hill in the look of the stage it stands in
 * (STAGE_LOOKS `hill`: grass-capped earth, sandstone, snow, candy, lava, a neon tower
 * block, crystal, clouds, moon rock...) - a big terrace and a higher one stepped up on it
 * behind - and on its front terrace the stage's decor, at a random distance out past the
 * roadside, the same on every client. Alternating sides, so the road runs down a valley
 * between them. Four boxes each; every other pair left out on LOW.
 */
function placeHill(mesh, styles, k, sparse) {
  const slot = (k % CITY_SLOTS) * PARTS
  const metre = k * CITY_EVERY + CITY_EVERY / 2
  const side = k % 2 ? 1 : -1
  if (metre < 60 || (sparse && k % 4 >= 2)) {
    hide(mesh, slot, PARTS)
    return
  }
  const look = lookAt(metre).hill
  const w = 16 + Math.floor(hash(k, 2) * 4) * 4
  const d = 16 + Math.floor(hash(k, 4) * 3) * 4
  const h = 8 + Math.floor(hash(k, 3) * 4) * 4
  const x = side * (ROAD_HALF + 20 + w / 2 + hash(k, 1) * 20)
  const back = side * (w * 0.3)
  const tx = x - side * (w / 2 - 3)
  const style = styleId(look.style)
  box(mesh, styles, slot, metre, x, h / 2, w, h, d, look.dirt[k % 2], style)
  box(mesh, styles, slot + 1, metre, x + back, h + h * 0.4, w * 0.6, h * 0.8, d * 0.75, look.dirt[(k + 1) % 2], style)
  const parts = decorParts({ decor: look.decor, leaves: look.leaves, trunk: look.trunk }, tx, h, k, 1)
  for (let n = 0; n < 2; n += 1) {
    const [px, py, , sx, sy, sz, c, st, turn] = parts[n]
    box(mesh, styles, slot + 2 + n, metre, px, py, sx, sy, sz, c, st, turn)
  }
}

/** Reused for decorParts' two boxes: [x, y, z, sx, sy, sz, colour, style, turn] each. */
const _decor = [
  [0, 0, 0, 0, 0, 0, '#ffffff', 0, 0],
  [0, 0, 0, 0, 0, 0, '#ffffff', 0, 0],
]
function decor(i, x, y, sx, sy, sz, color, style, turn = 0) {
  const d = _decor[i]
  d[0] = x
  d[1] = y
  d[2] = 0
  d[3] = sx
  d[4] = sy
  d[5] = sz
  d[6] = color
  d[7] = style
  d[8] = turn
}

/**
 * The two boxes of a decor (`look.decor` in `look.leaves` on a `look.trunk`), standing on
 * height `h` at x, `s` times the hills' size.
 */
function decorParts(look, x, h, k, s) {
  const turn = hash(k, 7) * Math.PI
  const { leaves, trunk } = look
  switch (look.decor) {
    case 'pine':
      decor(0, x, h + 1.0 * s, 0.7 * s, 2.0 * s, 0.7 * s, trunk, STYLE.SMOOTH)
      decor(1, x, h + 3.6 * s, 3.2 * s, 3.6 * s, 3.2 * s, leaves, STYLE.STUDS, Math.PI / 4)
      break
    case 'palm':
      decor(0, x, h + 3.5 * s, 0.7 * s, 7 * s, 0.7 * s, trunk, STYLE.SMOOTH)
      decor(1, x, h + 7.1 * s, 5 * s, 0.4 * s, 5 * s, leaves, STYLE.STUDS, turn)
      break
    case 'cactus':
      decor(0, x, h + 2.2 * s, 1.1 * s, 4.4 * s, 1.1 * s, leaves, STYLE.STRIPES)
      decor(1, x, h + 2.6 * s, 2.8 * s, 0.8 * s, 0.8 * s, leaves, STYLE.STUDS, turn)
      break
    case 'lollipop':
      decor(0, x, h + 2 * s, 0.35 * s, 4 * s, 0.35 * s, trunk, STYLE.SMOOTH)
      decor(1, x, h + 5.4 * s, 3 * s, 3 * s, 0.7 * s, leaves, STYLE.STRIPES, turn)
      break
    case 'mushroom':
      decor(0, x, h + 1.3 * s, 1.3 * s, 2.6 * s, 1.3 * s, trunk, STYLE.SMOOTH)
      decor(1, x, h + 3.3 * s, 4.6 * s, 1.4 * s, 4.6 * s, leaves, STYLE.STUDS, turn)
      break
    case 'crystal':
      decor(0, x, h + 2.6 * s, 1.3 * s, 5.2 * s, 1.3 * s, leaves, STYLE.GLOW, turn)
      decor(1, x + 1.4 * s, h + 1.4 * s, 0.9 * s, 2.8 * s, 0.9 * s, trunk, STYLE.GLOW, turn + 0.6)
      break
    case 'coral':
      decor(0, x, h + 1.8 * s, 0.8 * s, 3.6 * s, 0.8 * s, leaves, STYLE.GLOW)
      decor(1, x, h + 2.6 * s, 2.6 * s, 0.8 * s, 0.8 * s, trunk, STYLE.GLOW, turn)
      break
    case 'neon':
      decor(0, x, h + 2.5 * s, 0.3 * s, 5 * s, 0.3 * s, trunk, STYLE.SMOOTH)
      decor(1, x, h + 5.6 * s, 3.6 * s, 1.6 * s, 0.4 * s, leaves, STYLE.GLOW, turn)
      break
    case 'cloud':
      decor(0, x, h + 1.2 * s, 4.4 * s, 1.8 * s, 3.2 * s, leaves, STYLE.STUDS, turn)
      decor(1, x, h + 2.4 * s, 2.6 * s, 1.4 * s, 2.2 * s, leaves, STYLE.STUDS, turn + 0.5)
      break
    case 'rock':
      decor(0, x, h + 1.1 * s, 3.2 * s, 2.2 * s, 3 * s, leaves, STYLE.STUDS, turn)
      decor(1, x + 2.2 * s, h + 0.6 * s, 1.6 * s, 1.2 * s, 1.5 * s, trunk, STYLE.STUDS, turn + 1)
      break
    case 'spike':
      decor(0, x, h + 2.8 * s, 1.2 * s, 5.6 * s, 1.2 * s, trunk, STYLE.SMOOTH, turn)
      decor(1, x, h + 6.0 * s, 0.8 * s, 1.0 * s, 0.8 * s, leaves, STYLE.GLOW, turn)
      break
    default:
      decor(0, x, h + 1.4 * s, 0.9 * s, 2.8 * s, 0.9 * s, trunk, STYLE.SMOOTH)
      decor(1, x, h + 3.9 * s, 3.6 * s, 2.4 * s, 3.6 * s, leaves, STYLE.STUDS)
  }
  return _decor
}

/** Dragonfire Peaks' pieces beyond the road: basalt, and the lava sea east of SHORE_X. */
const LAVA_LAND = { trunk: '#2a2020', obsidian: ['#1a1220', '#241a2c'], rock: '#ff5a14', flame: '#ff6a1e', core: '#ffd27a' }
/** In the lava venue the ground stops here on the east (the lava sea runs on beyond: Ocean.jsx). */
const SHORE_X = 50
/** Reused for placeLavaPiece's four boxes. */
const _lava = Array.from({ length: PARTS }, () => [0, 0, 0, 0, 0, 0, '#ffffff', 0, 0])
function lavaPart(n, x, y, z, sx, sy, sz, color, style, turn) {
  const b = _lava[n]
  b[0] = x
  b[1] = y
  b[2] = z
  b[3] = sx
  b[4] = sy
  b[5] = sz
  b[6] = color
  b[7] = style
  b[8] = turn
}

/**
 * The lava venue's piece `k` in a hill slot: on the west, obsidian spikes, dead trees with
 * bare branches, glowing lava rocks and fire torches scattered over the basalt; on the
 * east, a row of lava rocks and torches along the shore of the lava sea. Four boxes each,
 * the same on every client.
 */
function placeLavaPiece(mesh, styles, k, sparse) {
  const slot = (k % CITY_SLOTS) * PARTS
  const metre = k * CITY_EVERY + CITY_EVERY / 2
  const side = k % 2 ? 1 : -1
  if (metre < 70 || (sparse && k % 4 >= 2)) {
    hide(mesh, slot, PARTS)
    return
  }
  const kind = side > 0 ? (k % 3 === 0 ? 'torch' : 'rock') : ['spike', 'tree', 'rock', 'torch'][k % 4]
  const x = side > 0 ? SIDE_TURF_X + 2 + hash(k, 1) * 3 : -(SIDE_TURF_X - 14 + hash(k, 1) * 60)
  const turn = hash(k, 3) * Math.PI
  const h = 4 + hash(k, 2) * 5
  const L = LAVA_LAND
  if (kind === 'spike') {
    lavaPart(0, 0, h / 2, 0, 1.4, h, 1.4, L.obsidian[0], STYLE.SMOOTH, turn)
    lavaPart(1, 0.6, h * 0.35, 0.4, 0.9, h * 0.7, 0.9, L.obsidian[1], STYLE.SMOOTH, turn + 0.7)
    lavaPart(2, 0, h + 0.2, 0, 0.5, 0.6, 0.5, L.flame, STYLE.GLOW, turn)
    lavaPart(3, -1.2, 0.4, -0.6, 1.4, 0.8, 1.2, L.rock, STYLE.LAVA, turn)
  } else if (kind === 'tree') {
    lavaPart(0, 0, h / 2, 0, 0.6, h, 0.6, L.trunk, STYLE.SMOOTH, 0)
    lavaPart(1, 0.8, h * 0.75, 0, 1.8, 0.28, 0.28, L.trunk, STYLE.SMOOTH, turn)
    lavaPart(2, -0.7, h * 0.58, 0, 1.4, 0.24, 0.24, L.trunk, STYLE.SMOOTH, turn + 1.2)
    lavaPart(3, 0, 0.3, 0, 1.6, 0.6, 1.6, L.rock, STYLE.LAVA, turn)
  } else if (kind === 'torch') {
    lavaPart(0, 0, 1.6, 0, 0.35, 3.2, 0.35, L.trunk, STYLE.SMOOTH, 0)
    lavaPart(1, 0, 3.45, 0, 0.8, 0.5, 0.8, L.trunk, STYLE.SMOOTH, turn)
    lavaPart(2, 0, 3.95, 0, 0.6, 0.7, 0.6, L.flame, STYLE.GLOW, turn)
    lavaPart(3, 0, 4.35, 0, 0.32, 0.5, 0.32, L.core, STYLE.GLOW, turn)
  } else {
    lavaPart(0, 0, 1.1, 0, 3, 2.2, 2.6, L.rock, STYLE.LAVA, turn)
    lavaPart(1, 1.6, 0.7, 0.8, 1.6, 1.4, 1.5, L.rock, STYLE.LAVA, turn + 0.8)
    lavaPart(2, -0.4, 2.5, 0, 1.6, 0.8, 1.4, L.obsidian[0], STYLE.SMOOTH, turn + 0.3)
    lavaPart(3, -1.5, 0.4, -0.9, 1, 0.8, 1, L.obsidian[1], STYLE.SMOOTH, turn)
  }
  for (let n = 0; n < PARTS; n += 1) {
    const [px, py, pz, sx, sy, sz, c, st, rot] = _lava[n]
    box(mesh, styles, slot + n, metre + pz, x + px, TURF_TOP + py, sx, sy, sz, c, st, rot)
  }
}

// --- Painted distances: one atlas, one instanced quad per glyph ----------------------------

const MARK_EVERY = 10
const MAX_GLYPHS = 440
/** Glyph cells in the atlas, and their size on the road (metres). */
const CHARS = '0123456789,m'
const COMMA = 10
const UNIT_M = 11
const GLYPH_W = 1.6
const GLYPH_H = 2.6
const ADVANCE = { digit: 1.4, comma: 0.7, space: 0.8 }
const FONT = '"Fredoka One", "Arial Rounded MT Bold", sans-serif'

/** Glyphs lie flat on the road, upright as read from behind (looking down the road). */
const FLAT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2 + SLOPE_EULER_X, 0, 0))
/** One label's glyph cells, reused: at most "99,999,999 m". */
const label = new Int8Array(20)

/** Writes the glyph cells of "1,344" for metre `n` into `label`; returns how many. */
function spell(n) {
  let digits = 0
  let count = 0
  // Digits right to left, a comma every three, then turned round in place.
  do {
    if (digits > 0 && digits % 3 === 0) label[count++] = COMMA
    label[count++] = n % 10
    n = Math.floor(n / 10)
    digits += 1
  } while (n > 0 && count < 13)
  for (let i = 0, j = count - 1; i < j; i += 1, j -= 1) {
    const t = label[i]
    label[i] = label[j]
    label[j] = t
  }
  return count
}

/** The atlas: each character white with a dark edge (readable on pale roads too), in its own cell. */
function glyphAtlas(size) {
  const cell = size / 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = Math.round(cell * 1.6)
  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  const draw = () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = `${Math.round(canvas.height * 0.8)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (let i = 0; i < CHARS.length; i += 1) {
      const x = (i + 0.5) * cell
      const y = canvas.height * 0.54
      ctx.lineWidth = canvas.height * 0.1
      ctx.strokeStyle = 'rgba(30, 24, 40, 0.55)'
      ctx.strokeText(CHARS[i], x, y)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(CHARS[i], x, y)
    }
    texture.needsUpdate = true
  }
  draw()
  document.fonts?.load(`64px ${FONT}`).then(draw, () => null)
  return texture
}

const glyphVertex = /* glsl */ `
  attribute float aGlyph;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = vec2((aGlyph + uv.x) / 16.0, uv.y);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const glyphFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uFar;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec4 t = texture2D(uAtlas, vUv);
    // Fades out far down the road rather than shimmering into mush.
    float a = t.a * 0.9 * (1.0 - smoothstep(uFar * 0.6, uFar, vDepth));
    if (a < 0.02) discard;
    gl_FragColor = vec4(t.rgb, a);
    #include <colorspace_fragment>
  }
`

function createGlyphs() {
  const atlas = glyphAtlas(Math.min(512, getQuality().maxTexture || 512))
  const geometry = new PlaneGeometry(1, 1)
  const glyph = new InstancedBufferAttribute(new Float32Array(MAX_GLYPHS), 1)
  geometry.setAttribute('aGlyph', glyph)
  const material = new ShaderMaterial({
    uniforms: { uAtlas: { value: atlas }, uFar: { value: 300 } },
    vertexShader: glyphVertex,
    fragmentShader: glyphFragment,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new InstancedMesh(geometry, material, MAX_GLYPHS)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  mesh.userData.atlas = atlas
  return mesh
}

// --- The markers' name boards: one atlas row per marker, one instanced plane ---------------

/** Atlas: BANNERS rows, each a quarter as tall as it is wide (the board's shape). */
const BANNER_COLS = 512
const BANNER_ROW = BANNER_COLS / 4

/** A gold diamond, centred at (x, y). */
function diamond(ctx, x, y, r) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r * 0.7, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r * 0.7, y)
  ctx.closePath()
  ctx.fill()
}

/** Paints marker `slot`'s board: carved dark wood in a gold border, the name in gold over its length. */
function drawBanner(canvas, slot, name, sub) {
  const ctx = canvas.getContext('2d')
  // Laid out in BANNER_COLS units; the canvas may be smaller (createBanners).
  const k = canvas.width / BANNER_COLS
  ctx.setTransform(k, 0, 0, k, 0, 0)
  const y0 = slot * BANNER_ROW
  ctx.clearRect(0, y0, BANNER_COLS, BANNER_ROW)
  const wood = ctx.createLinearGradient(0, y0, 0, y0 + BANNER_ROW)
  wood.addColorStop(0, '#5a3820')
  wood.addColorStop(1, '#2e1a0e')
  ctx.fillStyle = wood
  ctx.fillRect(0, y0, BANNER_COLS, BANNER_ROW)
  ctx.strokeStyle = '#ffcf4a'
  ctx.lineWidth = 5
  ctx.strokeRect(9, y0 + 9, BANNER_COLS - 18, BANNER_ROW - 18)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#a8761c'
  ctx.strokeRect(17, y0 + 17, BANNER_COLS - 34, BANNER_ROW - 34)
  ctx.fillStyle = '#ffcf4a'
  diamond(ctx, 40, y0 + BANNER_ROW / 2, 16)
  diamond(ctx, BANNER_COLS - 40, y0 + BANNER_ROW / 2, 16)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  // The name as big as fits between the diamonds.
  ctx.font = `64px ${FONT}`
  const size = Math.min(62, (64 * (BANNER_COLS - 120)) / Math.max(1, ctx.measureText(name).width))
  ctx.font = `${size}px ${FONT}`
  const y = y0 + BANNER_ROW * 0.42
  ctx.lineWidth = size * 0.16
  ctx.strokeStyle = '#1a0c04'
  ctx.strokeText(name, BANNER_COLS / 2, y)
  const gradient = ctx.createLinearGradient(0, y - size * 0.45, 0, y + size * 0.45)
  gradient.addColorStop(0, '#fffbd0')
  gradient.addColorStop(0.5, '#ffd21f')
  gradient.addColorStop(1, '#ff9c00')
  ctx.fillStyle = gradient
  ctx.fillText(name, BANNER_COLS / 2, y)
  ctx.font = `26px ${FONT}`
  ctx.fillStyle = '#ffe9b8'
  ctx.fillText(sub, BANNER_COLS / 2, y0 + BANNER_ROW * 0.8)
}

const bannerVertex = /* glsl */ `
  attribute float aRow;
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    // Canvas row 0 is the top of the atlas (flipY), so its v is the highest.
    vUv = vec2(uv.x, (${BANNERS}.0 - aRow - 1.0 + uv.y) / ${BANNERS}.0);
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`
const bannerFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(texture2D(uAtlas, vUv).rgb, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

function createBanners() {
  const canvas = document.createElement('canvas')
  // Scaled down to the preset's texture cap (LOW: 256 x 512), drawn through that scale.
  const k = Math.min(1, (getQuality().maxTexture || 512) / (BANNER_ROW * BANNERS))
  canvas.width = Math.round(BANNER_COLS * k)
  canvas.height = Math.round(BANNER_ROW * BANNERS * k)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  const geometry = new PlaneGeometry(1, 1)
  const rows = new InstancedBufferAttribute(new Float32Array(BANNERS), 1)
  for (let i = 0; i < BANNERS; i += 1) rows.setX(i, i)
  geometry.setAttribute('aRow', rows)
  const material = new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uAtlas: { value: texture } }]),
    vertexShader: bannerVertex,
    fragmentShader: bannerFragment,
    fog: true,
  })
  const mesh = new InstancedMesh(geometry, material, BANNERS)
  for (let i = 0; i < BANNERS; i += 1) mesh.setMatrixAt(i, ZERO)
  mesh.frustumCulled = false
  mesh.userData = { canvas, texture, texts: new Array(BANNERS).fill(null) }
  return mesh
}

/** Draws every board again (the font has just loaded). */
function redrawBanners(mesh) {
  const { canvas, texture, texts } = mesh.userData
  texts.forEach((t, slot) => t && drawBanner(canvas, slot, t[0], t[1]))
  texture.needsUpdate = true
}

// --- The ground, the road, its kerbs and the turf (two box meshes) --------------------------

/** The ground's squares, then the stage lines across the road. */
function createField() {
  const set = new BlockSet()
  for (let i = 0; i < SEGMENTS; i += 1) set.add(0, 0, 0, 0, 0, 0, '#3aa834', STYLE.STUDS)
  for (let i = 0; i < STAGE_LINES; i += 1) set.add(0, 0, 0, 0, 0, 0, '#ffffff', STYLE.GLOW)
  const mesh = set.build(sharedMaterials().blocks)
  mesh.frustumCulled = false
  return mesh
}

/**
 * Row k of the road lands on instance k % STRIPES (light or dark by k's parity), the turf
 * either side of it after the road rows, and its two kerb stones after those.
 */
function createStripes() {
  const set = new BlockSet()
  for (let i = 0; i < STRIPE_BOXES; i += 1) set.add(0, 0, 0, 0, 0, 0, '#ffffff', STYLE.STUDS)
  const mesh = set.build(sharedMaterials().blocks)
  mesh.frustumCulled = false
  return mesh
}

/** Road row `k`: its cobbles, the turf either side and its two kerb stones, in their stage's paint. */
function placeRow(stripes, styles, k, lava) {
  const m = k * STRIPE + STRIPE / 2
  const look = paintAt(m, lava)
  const slot = k % STRIPES
  box(stripes, styles, slot, m, 0, ROAD_TOP / 2, LANE_WIDTH, ROAD_TOP, STRIPE, look.road[k % 2], look.roadStyle)
  for (let side = 0; side < 2; side += 1) {
    const s = side ? 1 : -1
    box(stripes, styles, TURF_ROWS + slot * 2 + side, m, (s * (KERB_OUT + SIDE_TURF_X)) / 2, TURF_TOP / 2, SIDE_TURF_X - KERB_OUT, TURF_TOP, STRIPE, look.side[k % 2], STYLE.STUDS)
    box(stripes, styles, KERBS + slot * 2 + side, m, s * (ROAD_HALF + KERB_W / 2), KERB_H / 2, KERB_W, KERB_H, STRIPE - 0.16, look.kerb[(k + side) % 2], look.kerbStyle)
  }
}

/** Ground square `j` (a SEGMENT long), out to the hills - or, in the lava venue, to the shore. */
function placeSegment(field, styles, j, lava) {
  const m = j * SEGMENT + SEGMENT / 2
  const look = paintAt(m, lava)
  if (lava) {
    const west = -FIELD_WIDTH / 2
    box(field, styles, j % SEGMENTS, m, (west + SHORE_X) / 2, -0.5, SHORE_X - west, 1, SEGMENT, look.field, look.fieldStyle)
  } else {
    box(field, styles, j % SEGMENTS, m, 0, -0.5, FIELD_WIDTH, 1, SEGMENT, look.field, look.fieldStyle)
  }
}

/** A fresh `laid` record: nothing in any slot. */
function emptyLaid() {
  return {
    band: -1,
    mark: -1,
    far: 0,
    world: -1,
    markWorld: -1,
    sparse: false,
    rows: new Int32Array(STRIPES).fill(-1),
    segs: new Int32Array(SEGMENTS).fill(-1),
    slots: new Int32Array(CITY_SLOTS).fill(-1),
    lanterns: new Int32Array(LANTERN_SLOTS).fill(-1),
    obelisks: new Int32Array(OB_SLOTS).fill(-1),
    arches: new Int32Array(BANNERS).fill(-1),
    poles: new Int32Array(POLE_SLOTS).fill(-1),
    near: new Int32Array(NEAR_SLOTS).fill(-1),
    banners: new Array(BANNERS).fill(null),
  }
}

/**
 * Lays every ring for the stretch from `from` on: only slots handed to a new piece are
 * placed. Returns which meshes changed (bit 1 field, 2 stripes, 4 hills, 8 marks).
 */
function layStretch(field, stripes, city, marks, banners, laid, from, lava, sparse) {
  let changed = 0
  // Road rows, turf and kerbs.
  const stripeStyles = stripes.geometry.getAttribute('aStyle').array
  const k0 = Math.floor(from / STRIPE)
  for (let k = k0; k < k0 + STRIPES; k += 1) {
    if (laid.rows[k % STRIPES] === k) continue
    laid.rows[k % STRIPES] = k
    placeRow(stripes, stripeStyles, k, lava)
    changed |= 2
  }
  // Ground squares.
  const fieldStyles = field.geometry.getAttribute('aStyle').array
  const j0 = Math.floor(from / SEGMENT)
  for (let j = j0; j < j0 + SEGMENTS; j += 1) {
    if (laid.segs[j % SEGMENTS] === j) continue
    laid.segs[j % SEGMENTS] = j
    placeSegment(field, fieldStyles, j, lava)
    changed |= 1
  }
  // A glowing line across the road where each stage in the stretch starts, in its colour.
  const stages = zones()
  const to = from + FIELD_LENGTH
  let line = 0
  for (let i = 1; i < stages.length && line < STAGE_LINES; i += 1) {
    const start = stages[i].start
    if (start < from || start > to) continue
    box(field, fieldStyles, STAGE_LINE + line, start, 0, LINE_Y, LANE_WIDTH - 0.2, 0.05, 1.4, colorOf(ZONE_THEMES[stages[i].theme]?.gate ?? '#ffffff'), STYLE.GLOW)
    line += 1
  }
  for (; line < STAGE_LINES; line += 1) field.setMatrixAt(STAGE_LINE + line, ZERO)
  changed |= 1

  // Hills (or the lava venue's pieces).
  const cityStyles = city.geometry.getAttribute('aStyle').array
  const c0 = Math.floor(from / CITY_EVERY)
  for (let k = c0; k < c0 + CITY_SLOTS; k += 1) {
    if (laid.slots[k % CITY_SLOTS] === k) continue
    laid.slots[k % CITY_SLOTS] = k
    if (lava) placeLavaPiece(city, cityStyles, k, sparse)
    else placeHill(city, cityStyles, k, sparse)
    changed |= 4
  }

  // Landmarks.
  const ms = marks.geometry.getAttribute('aStyle').array
  const l0 = Math.floor(from / LANTERN_EVERY)
  for (let k = l0; k < l0 + LANTERN_SLOTS; k += 1) {
    if (laid.lanterns[k % LANTERN_SLOTS] === k) continue
    laid.lanterns[k % LANTERN_SLOTS] = k
    placeLantern(marks, ms, k, lava)
    changed |= 8
  }
  const o0 = Math.floor(from / OB_EVERY)
  for (let k = o0; k < o0 + OB_SLOTS; k += 1) {
    if (laid.obelisks[k % OB_SLOTS] === k) continue
    laid.obelisks[k % OB_SLOTS] = k
    placeObelisk(marks, ms, k, lava)
    changed |= 8
  }
  const p0 = Math.floor(from / POLE_EVERY)
  for (let k = p0; k < p0 + POLE_SLOTS; k += 1) {
    if (laid.poles[k % POLE_SLOTS] === k) continue
    laid.poles[k % POLE_SLOTS] = k
    placePole(marks, ms, k, lava, sparse)
    changed |= 8
  }
  const n0 = Math.floor(from / NEAR_EVERY)
  for (let k = n0; k < n0 + NEAR_SLOTS; k += 1) {
    if (laid.near[k % NEAR_SLOTS] === k) continue
    laid.near[k % NEAR_SLOTS] = k
    placeNear(marks, ms, k, lava, sparse)
    changed |= 8
  }
  // A marker beside the road at the start of each stage in view, its name board on its signpost.
  for (let i = 0; i < stages.length; i += 1) {
    const m = markerMeter(i)
    if (m < from - 30) continue
    if (m > to) break
    const slot = i % BANNERS
    if (laid.arches[slot] === i) continue
    laid.arches[slot] = i
    placeMarker(marks, ms, slot, i, lava)
    banners.setMatrixAt(slot, slopeBoxMatrix(signMeter(i) - 0.45, signX(i), BANNER.y, BANNER.width, BANNER.height, 1, 0, _m))
    banners.instanceMatrix.needsUpdate = true
    const key = `${laid.world}:${i}`
    if (laid.banners[slot] !== key) {
      laid.banners[slot] = key
      const length = (stages[i + 1]?.start ?? stages[i].start + 100) - stages[i].start
      banners.userData.texts[slot] = [stages[i].name, `${length} M`]
      drawBanner(banners.userData.canvas, slot, stages[i].name, `${length} M`)
      banners.userData.texture.needsUpdate = true
    }
    changed |= 8
  }
  return changed
}

/** Takes every stage marker and name board down (they're kept by stage, not by stretch). */
function clearArches(marks, banners) {
  hide(marks, ARCHES, BANNERS * ARCH_PARTS)
  for (let i = 0; i < BANNERS; i += 1) banners.setMatrixAt(i, ZERO)
  banners.instanceMatrix.needsUpdate = true
}

/** Uploads what changed in a box mesh. */
function flush(mesh) {
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.geometry.getAttribute('aStyle').needsUpdate = true
}

export default function Lane() {
  const scene = useThree((s) => s.scene)
  const fieldRef = useRef(null)
  const stripesRef = useRef(null)
  const cityRef = useRef(null)
  const glyphsRef = useRef(null)
  const marksRef = useRef(null)
  const bannersRef = useRef(null)
  /** What every ring's slots were last laid out for, and for which world and density. */
  const laidFor = useRef(emptyLaid())
  const assets = useMemo(
    () => ({
      field: createField(),
      stripes: createStripes(),
      city: createCity(),
      glyphs: createGlyphs(),
      marks: createMarks(),
      banners: createBanners(),
    }),
    [],
  )

  // The boards' lettering again once the font is in.
  useEffect(() => {
    let cancelled = false
    document.fonts?.load(`64px ${FONT}`).then(
      () => !cancelled && redrawBanners(assets.banners),
      () => null,
    )
    return () => {
      cancelled = true
    }
  }, [assets])

  useEffect(
    () => () => {
      disposeBlocks(assets.field)
      disposeBlocks(assets.stripes)
      disposeBlocks(assets.city)
      disposeBlocks(assets.marks)
      assets.glyphs.geometry.dispose()
      assets.glyphs.material.dispose()
      assets.glyphs.userData.atlas.dispose()
      assets.glyphs.dispose()
      assets.banners.geometry.dispose()
      assets.banners.material.dispose()
      assets.banners.userData.texture.dispose()
      assets.banners.dispose()
    },
    [assets],
  )

  useFrame((_state, delta) => {
    const field = fieldRef.current
    const stripes = stripesRef.current
    const city = cityRef.current
    const glyphs = glyphsRef.current
    const marks = marksRef.current
    const banners = bannersRef.current
    if (!field || !stripes || !city || !glyphs || !marks || !banners) return
    const focus = roll.active ? Math.max(0, roll.meter) : 0

    // The sky of the stage the sword is over, eased in. (Roll.jsx puts the lobby's back after.)
    if (roll.active) blendSky(stageSkies()[zoneIndexAt(focus)], 1 - Math.exp(-2.5 * Math.min(delta, 0.1)), scene.fog)

    let laid = laidFor.current
    const band = Math.floor(Math.max(0, focus - BEHIND) / STRIPE)
    const world = activeWorld()
    const lava = isLava()
    const sparse = getQuality().decorDensity < 0.5
    if (world !== laid.world || sparse !== laid.sparse) {
      // Another world's stages, or another density of scenery: lay everything afresh.
      laid = emptyLaid()
      laid.world = world
      laid.sparse = sparse
      laidFor.current = laid
      clearArches(marks, banners)
      // LOW leaves the roadside clutter out altogether: not drawn (it's the last region),
      // rather than drawn shrunk to nothing.
      marks.count = sparse ? NEAR : MARKS
    }

    if (band !== laid.band) {
      laid.band = band
      const changed = layStretch(field, stripes, city, marks, banners, laid, band * STRIPE, lava, sparse)
      if (changed & 1) flush(field)
      if (changed & 2) flush(stripes)
      if (changed & 4) flush(city)
      if (changed & 8) flush(marks)
    }

    // The painted distances, from just behind the focus to as far as the preset sees.
    const far = Math.min(getQuality().viewDistance, 420)
    const first = Math.max(1, Math.floor((focus - 20) / MARK_EVERY))
    if (first === laid.mark && far === laid.far && world === laid.markWorld) return
    laid.mark = first
    laid.far = far
    laid.markWorld = world
    glyphs.material.uniforms.uFar.value = far
    const cells = glyphs.geometry.getAttribute('aGlyph')
    let n = 0
    for (let k = first; k * MARK_EVERY < focus + far && n < MAX_GLYPHS - 14; k += 1) {
      const metre = k * MARK_EVERY
      const count = spell(metre)
      label[count] = UNIT_M
      const total = count + 1
      let width = ADVANCE.space
      for (let i = 0; i < total; i += 1) width += label[i] === COMMA ? ADVANCE.comma : ADVANCE.digit
      let x = -width / 2
      for (let i = 0; i < total; i += 1) {
        const cell = label[i]
        const advance = cell === COMMA ? ADVANCE.comma : ADVANCE.digit
        if (i === count) x += ADVANCE.space
        // Just short of its metre (towards the throw zone), reading from behind you.
        trackPoint(metre - 1.9, x + advance / 2, GLYPH_Y, _p)
        glyphs.setMatrixAt(n, _m.compose(_p, FLAT, _s.set(GLYPH_W, GLYPH_H, 1)))
        cells.setX(n, cell)
        n += 1
        x += advance
      }
    }
    glyphs.count = n
    glyphs.instanceMatrix.needsUpdate = true
    cells.needsUpdate = true
  })

  return (
    <>
      <primitive ref={fieldRef} object={assets.field} />
      <primitive ref={stripesRef} object={assets.stripes} />
      <primitive ref={cityRef} object={assets.city} />
      <primitive ref={glyphsRef} object={assets.glyphs} />
      <primitive ref={marksRef} object={assets.marks} />
      <primitive ref={bannersRef} object={assets.banners} />
    </>
  )
}
