import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import { hash2, mulberry32 } from '@shared/rng'
import {
  BALL_SHOP,
  BOARD_OUT,
  counterRect,
  EGG_STANDS,
  FREE_REWARD,
  LEADERBOARDS,
  PAD_COUNT,
  PLAZA,
  PORTALS,
  SPHINX_STAND,
  STAGE_TOWERS,
  SWORD_COLUMN_PITCH,
  SWORD_COLUMNS,
  SWORD_COUNTER,
  SWORD_WALL,
  THROW_STAGE,
  TRACK_START_Z,
  TRAINING_CENTER,
  TRAINING_RADIUS,
} from '@shared/world'

import { venueOf } from '../sceneStyle'
import { APRON, COURTYARD, FLOWER_BEDS, PATHS, PLAZA_DISC, SPOKES } from './pitch'

/**
 * The courtyard floor: one big plane whose colours come from a "ground map" texture
 * painted in world units (a few texels to the metre). The lawn; the round flagstone
 * courtyard round the spawn; the cobbled avenue from there straight up to the throw
 * stage's steps, through the open flagstone plaza in the middle, with spokes west to the
 * training circle and east to the Sword Wall; the training circle's sand (sweeping round
 * its arc) and the Sword Wall's marble apron, the counter's gold square on it; the
 * flagstones round the stage, under the two egg rows, the leaderboards, the free reward
 * and the Sphinx; the Enchant Altar's rune circle; the portal's rings and the flower beds
 * are painted into it, so the whole floor is a single draw call however many regions it
 * has. In Dragonfire Peaks the lawn is ash and basalt, split by glowing lava cracks.
 */

const MAP = { minX: -64, maxX: 64, minZ: -44, maxZ: PLAZA.maxZ + 12 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the valley's own floor takes over there. */
export const GROUND_NORTH_EDGE = TRACK_START_Z

/** A canvas drawn on in world metres: x east, z south (the map's +v is north). */
function worldCanvas(texelsPerMetre) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(MAP_W * texelsPerMetre)
  canvas.height = Math.round(MAP_H * texelsPerMetre)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(texelsPerMetre, 0, 0, texelsPerMetre, -MAP.minX * texelsPerMetre, -MAP.minZ * texelsPerMetre)
  return { canvas, ctx }
}

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ)
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, z, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  const ring = (x, z, radius, width, color) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(x, z, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  const line = (x0, z0, x1, z1, width, color) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(x0, z0)
    ctx.lineTo(x1, z1)
    ctx.stroke()
  }
  return { rect, disc, ring, line }
}

/** A path round an annulus sector about (x, z), radii r0..r1, angles a0..a1 (radians; +x towards +z). */
function sectorPath(ctx, x, z, r0, r1, a0, a1) {
  ctx.beginPath()
  ctx.arc(x, z, r1, a0, a1)
  ctx.arc(x, z, r0, a1, a0, true)
  ctx.closePath()
}

/**
 * Stones laid over `r` (a rect), clipped to it: rows `size` deep, each row's joints
 * offset by half a stone, every stone `size * ratio` long and its own shade of `shades`,
 * with `grout` round it. `seed` keeps each area's shading its own (and the same on every
 * client).
 */
function stones(ctx, r, { size, ratio = 1.4, shades, grout, gap = 0.16, seed = 0 }) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ)
  ctx.clip()
  ctx.fillStyle = grout
  ctx.fillRect(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ)
  const long = size * ratio
  for (let row = 0, z = r.minZ; z < r.maxZ; row += 1, z += size) {
    const offset = row % 2 ? long / 2 : 0
    for (let k = 0, x = r.minX - offset; x < r.maxX; k += 1, x += long) {
      ctx.fillStyle = shades[Math.floor(hash2(k + seed * 31, row, seed) * shades.length)]
      ctx.fillRect(x + gap / 2, z + gap / 2, long - gap, size - gap)
    }
  }
  ctx.restore()
}

/** The same, clipped to a disc. */
function stoneDisc(ctx, x, z, radius, opts) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, z, radius, 0, Math.PI * 2)
  ctx.clip()
  stones(ctx, { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius }, opts)
  ctx.restore()
}

/** The ground map for `world`'s venue: lawn, courtyards, paths, yards (and the cracks). */
export function createGroundMap(maxTexture, world = 0) {
  const v = venueOf(world)
  const texels = maxTexture >= 1024 ? 8 : 4
  const { canvas, ctx } = worldCanvas(texels)
  const paint = painter(ctx)

  paintLawn(ctx, paint, v.ground)
  if (v.ground.cracks) paintCracks(ctx, v.ground.cracks)
  paintTraining(ctx, paint, v.ground)
  paintApron(ctx, paint, v.ground)
  paintPaths(ctx, paint, v.ground)
  paintYards(ctx, paint, v.ground)
  paintBeds(ctx, paint, v.ground)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/** Lawn in soft 4 m bands, with darker tufts here and there. */
function paintLawn(ctx, { rect }, G) {
  rect(MAP, G.grass[0])
  for (let z = MAP.minZ, k = 0; z < MAP.maxZ; z += 4, k += 1) rect({ minX: MAP.minX, maxX: MAP.maxX, minZ: z, maxZ: z + 4 }, G.grass[k % 2])
  const rand = mulberry32(11)
  ctx.fillStyle = 'rgba(0, 40, 0, 0.12)'
  for (let i = 0; i < 260; i += 1) {
    ctx.beginPath()
    ctx.arc(MAP.minX + rand() * MAP_W, MAP.minZ + rand() * MAP_H, 0.4 + rand() * 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** The training circle's arc: from just inside the mats out past the boards, and the bed behind. */
const TRAINING_ARC = {
  r0: TRAINING_RADIUS - 4.3,
  r1: TRAINING_RADIUS + BOARD_OUT + 1.6,
  a0: (111 * Math.PI) / 180,
  a1: (111 * Math.PI) / 180 + ((PAD_COUNT - 1) * 15 + 18) * (Math.PI / 180),
}

/** The training circle: sand round its arc, edged, speckled; a bed of flowers round its back. */
function paintTraining(ctx, _paint, G) {
  const { x, z } = TRAINING_CENTER
  const { r0, r1, a0, a1 } = TRAINING_ARC
  sectorPath(ctx, x, z, r0 - 0.4, r1 + 0.4, a0 - 0.012, a1 + 0.012)
  ctx.fillStyle = G.edge
  ctx.fill()
  sectorPath(ctx, x, z, r0, r1, a0, a1)
  ctx.fillStyle = G.sand[0]
  ctx.fill()
  ctx.save()
  ctx.clip()
  const rand = mulberry32(5)
  ctx.fillStyle = G.sand[1]
  for (let i = 0; i < 1400; i += 1) ctx.fillRect(x - r1 + rand() * r1 * 2, z - r1 + rand() * r1 * 2, 0.25, 0.25)
  ctx.restore()
  // The bed round the back, behind the boards.
  const b0 = r1 + 0.8
  const b1 = r1 + 2.2
  sectorPath(ctx, x, z, b0 - 0.2, b1 + 0.2, a0, a1)
  ctx.fillStyle = G.edge
  ctx.fill()
  sectorPath(ctx, x, z, b0, b1, a0 + 0.01, a1 - 0.01)
  ctx.fillStyle = G.soil
  ctx.fill()
  const bloom = mulberry32(23)
  for (let i = 0; i < 420; i += 1) {
    const a = a0 + 0.02 + bloom() * (a1 - a0 - 0.04)
    const r = b0 + 0.2 + bloom() * (b1 - b0 - 0.4)
    ctx.fillStyle = G.flowers[Math.floor(bloom() * G.flowers.length)]
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r, z + Math.sin(a) * r, 0.18 + bloom() * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The Sword Wall's apron (pitch.js APRON): pale marble flagstones from the wall's face out
 * into the courtyard, edged; a gold line along the wall's foot with a short tick under
 * every column, and the Sword Counter's dais framed in a gold square with a rune ring in
 * front of it - the one place to stand to buy.
 */
function paintApron(ctx, { rect, ring, line }, G) {
  rect({ minX: APRON.minX - 0.5, maxX: APRON.maxX, minZ: APRON.minZ - 0.5, maxZ: APRON.maxZ + 0.5 }, G.edge)
  stones(ctx, APRON, { shades: G.flag, grout: G.grout, size: 2, seed: 1 })
  // Along the wall's foot, a tick under each column's middle.
  line(SWORD_WALL.x - 0.6, SWORD_WALL.minZ, SWORD_WALL.x - 0.6, SWORD_WALL.maxZ, 0.2, G.ring)
  for (let c = 0; c < SWORD_COLUMNS; c += 1) {
    const z = SWORD_WALL.minZ + (c + 0.5) * SWORD_COLUMN_PITCH
    line(SWORD_WALL.x - 0.6, z, SWORD_WALL.x - 1.6, z, 0.16, G.ring)
  }
  // The counter: a gold square round its dais, a rune ring out in front where you walk up.
  const { minX, maxX, minZ, maxZ } = counterRect
  ctx.strokeStyle = G.ring
  ctx.lineWidth = 0.3
  ctx.strokeRect(minX - 0.6, minZ - 0.6, maxX - minX + 1.2, maxZ - minZ + 1.2)
  ring(SWORD_COUNTER.x, SWORD_COUNTER.z, SWORD_COUNTER.half + 2.4, 0.22, G.rune)
  ring(SWORD_COUNTER.x, SWORD_COUNTER.z, SWORD_COUNTER.half + 1.9, 0.1, G.rune)
}

/**
 * The cobbled avenue (pitch.js PATHS) and its spokes west and east (SPOKES), the open
 * flagstone plaza it runs through in the courtyard's middle (PLAZA_DISC: a gold ring round
 * it, a compass star at its heart - paint only, nothing to walk round), and the spawn
 * courtyard.
 */
function paintPaths(ctx, { rect, disc, ring, line }, G) {
  const cobble = { shades: G.path, grout: G.edge, size: 1.2, ratio: 1.15, gap: 0.14 }
  const edged = (r, seed, alongX = false) => {
    if (alongX) rect({ minX: r.minX, maxX: r.maxX, minZ: r.minZ - 0.5, maxZ: r.maxZ + 0.5 }, G.edge)
    else rect({ minX: r.minX - 0.5, maxX: r.maxX + 0.5, minZ: r.minZ, maxZ: r.maxZ }, G.edge)
    stones(ctx, r, { ...cobble, seed })
  }
  SPOKES.forEach((p, i) => edged(p, 8 + i, true))
  PATHS.forEach((p, i) => edged(p, 6 + i))
  // The plaza: flagstones over the avenue, a gold ring round them, a star at the heart.
  const { x: px, z: pz, radius } = PLAZA_DISC
  disc(px, pz, radius + 0.5, G.edge)
  stoneDisc(ctx, px, pz, radius, { shades: G.flag, grout: G.grout, size: 1.6, seed: 11 })
  ring(px, pz, radius - 1, 0.3, G.ring)
  ring(px, pz, 3.2, 0.22, G.ring)
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2
    const reach = k % 2 ? 4.2 : 7.5
    line(px + Math.cos(a) * 3.4, pz + Math.sin(a) * 3.4, px + Math.cos(a) * reach, pz + Math.sin(a) * reach, k % 2 ? 0.16 : 0.26, G.ring)
  }
  // The spawn courtyard.
  disc(COURTYARD.x, COURTYARD.z, COURTYARD.radius + 0.5, G.edge)
  stoneDisc(ctx, COURTYARD.x, COURTYARD.z, COURTYARD.radius, { shades: G.flag, grout: G.grout, size: 1.8, seed: 12 })
  ring(COURTYARD.x, COURTYARD.z, COURTYARD.radius - 0.9, 0.3, G.ring)
}

/**
 * The flagstones round the throw stage (in front of its steps and either side of it, to
 * its flag towers), under the eggs, the leaderboards, the free reward and the Sphinx; the
 * Enchant Altar's rune circle; the portal's rings.
 */
function paintYards(ctx, { rect, disc, ring, line }, G) {
  const flag = { shades: G.flag, grout: G.grout }
  // Round the stage: from the road's edge to a few metres in front of its steps, out past its towers.
  const reach = Math.max(...STAGE_TOWERS.map((t) => Math.abs(t.x))) + 3
  const apron = { minX: -reach, maxX: reach, minZ: GROUND_NORTH_EDGE, maxZ: THROW_STAGE.maxZ + 6 }
  rect({ minX: apron.minX - 0.5, maxX: apron.maxX + 0.5, minZ: apron.minZ, maxZ: apron.maxZ + 0.5 }, G.edge)
  stones(ctx, apron, { shades: G.runway, grout: G.edge, size: 2.2, ratio: 1.25, gap: 0.18, seed: 13 })
  // A gold line along the foot of the steps.
  line(THROW_STAGE.minX, THROW_STAGE.maxZ + 0.6, THROW_STAGE.maxX, THROW_STAGE.maxZ + 0.6, 0.2, G.chalk)
  // The leaderboards' flagstones, along the south wall.
  const bx = LEADERBOARDS.map((b) => b.x)
  stones(ctx, { minX: Math.min(...bx) - 6, maxX: Math.max(...bx) + 6, minZ: LEADERBOARDS[0].z - 3, maxZ: PLAZA.maxZ }, { ...flag, size: 1.6, seed: 14 })
  // Each egg row on a flagstone strip (west and east of the avenue), a round pad under each
  // egg - kept off the spawn courtyard's round, which they'd otherwise nick - and pads under
  // the free reward and the Sphinx.
  ctx.save()
  ctx.beginPath()
  ctx.rect(MAP.minX, MAP.minZ, MAP_W, MAP_H)
  ctx.arc(COURTYARD.x, COURTYARD.z, COURTYARD.radius + 0.5, 0, Math.PI * 2)
  ctx.clip('evenodd')
  for (const side of [-1, 1]) {
    const row = EGG_STANDS.filter((s) => Math.sign(s.x) === side)
    if (!row.length) continue
    const xs = row.map((s) => s.x)
    const zs = row.map((s) => s.z)
    const strip = { minX: Math.min(...xs) - 2.4, maxX: Math.max(...xs) + 2.4, minZ: Math.min(...zs) - 2.2, maxZ: Math.max(...zs) + 1.6 }
    rect({ minX: strip.minX - 0.3, maxX: strip.maxX + 0.3, minZ: strip.minZ - 0.3, maxZ: strip.maxZ + 0.3 }, G.edge)
    stones(ctx, strip, { ...flag, size: 1.2, seed: 18 + side })
  }
  for (const s of EGG_STANDS) {
    const r = s.big ? 4.1 : 3.2
    disc(s.x, s.z, r + 0.3, G.edge)
    stoneDisc(ctx, s.x, s.z, r, { ...flag, size: 1.2, seed: 15 })
  }
  ctx.restore()
  disc(FREE_REWARD.x, FREE_REWARD.z, 3.3, G.edge)
  stoneDisc(ctx, FREE_REWARD.x, FREE_REWARD.z, 3, { ...flag, size: 1.2, seed: 16 })
  rect({ minX: SPHINX_STAND.x - 4.3, maxX: SPHINX_STAND.x + 4.3, minZ: SPHINX_STAND.z - 4.3, maxZ: SPHINX_STAND.z + 4.3 }, G.edge)
  stones(ctx, { minX: SPHINX_STAND.x - 4, maxX: SPHINX_STAND.x + 4, minZ: SPHINX_STAND.z - 4, maxZ: SPHINX_STAND.z + 4 }, { ...flag, size: 1.6, seed: 17 })
  // The Enchant Altar's rune circle, in front of it and under it.
  const ax = BALL_SHOP.x + 1.6
  const az = BALL_SHOP.z
  const r = BALL_SHOP.radius
  disc(ax, az, r + 2.6, G.edge)
  stoneDisc(ctx, ax, az, r + 2.3, { ...flag, size: 1.2, seed: 5 })
  ring(ax, az, r + 1.6, 0.22, G.rune)
  ring(ax, az, r + 1.05, 0.1, G.rune)
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2
    line(ax + Math.cos(a) * (r + 1.15), az + Math.sin(a) * (r + 1.15), ax + Math.cos(a + 0.12) * (r + 1.5), az + Math.sin(a + 0.12) * (r + 1.5), 0.14, G.rune)
  }
  for (const p of PORTALS) {
    disc(p.x, p.z, 6, G.ring)
    disc(p.x, p.z, 5, G.portal)
  }
}

/** The flower beds (pitch.js FLOWER_BEDS): an edging, dark soil, blooms in every colour. */
function paintBeds(ctx, { rect }, G) {
  const rand = mulberry32(19)
  for (const bed of FLOWER_BEDS) {
    rect({ minX: bed.minX - 0.2, maxX: bed.maxX + 0.2, minZ: bed.minZ - 0.2, maxZ: bed.maxZ + 0.2 }, G.edge)
    rect(bed, G.soil)
    const area = (bed.maxX - bed.minX) * (bed.maxZ - bed.minZ)
    for (let i = 0; i < area * 2.2; i += 1) {
      ctx.fillStyle = G.flowers[Math.floor(rand() * G.flowers.length)]
      const x = bed.minX + 0.2 + rand() * (bed.maxX - bed.minX - 0.4)
      const z = bed.minZ + 0.2 + rand() * (bed.maxZ - bed.minZ - 0.4)
      ctx.beginPath()
      ctx.arc(x, z, 0.18 + rand() * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * Dragonfire Peaks' cracks: jagged glowing seams wandering across the ash, from a seed
 * (the same on every client), each a dark scorched edge round a bright core.
 */
function paintCracks(ctx, color) {
  const rand = mulberry32(77)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (let i = 0; i < 46; i += 1) {
    let x = MAP.minX + rand() * MAP_W
    let z = MAP.minZ + rand() * MAP_H
    let a = rand() * Math.PI * 2
    const points = [[x, z]]
    const steps = 3 + Math.floor(rand() * 5)
    for (let s = 0; s < steps; s += 1) {
      a += (rand() - 0.5) * 1.6
      const len = 1.5 + rand() * 3.5
      x += Math.cos(a) * len
      z += Math.sin(a) * len
      points.push([x, z])
    }
    const width = 0.18 + rand() * 0.3
    for (const [w, c] of [[width * 3.2, 'rgba(20, 8, 6, 0.55)'], [width * 1.6, '#c2300a'], [width, color], [width * 0.4, '#ffd27a']]) {
      ctx.strokeStyle = c
      ctx.lineWidth = w
      ctx.beginPath()
      points.forEach(([px, pz], j) => (j ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz)))
      ctx.stroke()
    }
  }
}

/** How far the ground runs out in Dragonfire Peaks before the lava sea (Ocean.jsx) takes over. */
export const SEA_EDGE = 118

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the lawn's colour. In
 * Dragonfire Peaks it stops at SEA_EDGE, and the lava sea runs on from there.
 */
export function createGroundGeometry(world = 0) {
  const reach = venueOf(world).lava ? SEA_EDGE : 280
  const minX = -reach
  const maxX = reach
  const minZ = GROUND_NORTH_EDGE
  const maxZ = reach
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
