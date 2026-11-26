import { CylinderGeometry, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three'

import {
  BALL_SHOP,
  DUMMY_BASE,
  dummySpot,
  PAD_COUNT,
  PAD_HEIGHT,
  PAD_RADIUS,
  padBoard,
  padCenterX,
  padCenterZ,
  padDir,
  SHOP_SIGN,
  SHOP_SIGN_FACING,
  SWORD_WALL_TOP,
} from '@shared/world'

import { STYLE } from '../materials'
import { venueOf } from '../sceneStyle'
import { crossedSwords, localBox } from './heraldry'

/**
 * Static lobby structures, added to the world's shared BlockSet and prop builder so they
 * render in the same few draw calls as everything else: the training circle's pads, the
 * Sword Wall's crown sign, and the Enchant Altar. (The dummies themselves, which wobble as
 * they're struck, are drawn by TrainingDummies; the Sword Wall itself, its swords and the
 * counter by TireShop.)
 */

/**
 * Per-pad look, in pad order (matches PADS in shared/balance.js): the mat's stone base and
 * top (its `style`), the glowing rune ring, the board's frame and the colour of its
 * labels. `lava` ones (Dragonfire Peaks' two) have a glowing cracked mat and flames on
 * their board.
 */
export const PAD_THEMES = [
  { base: '#8a7a62', top: '#d8caa6', ring: '#ffe08a', frame: '#b88a4a', text: '#ffe08a' },
  { base: '#5f7a52', top: '#bcd9ab', ring: '#7dff8a', frame: '#3f9a4a', text: '#8dff8a' },
  { base: '#4f6a92', top: '#adc6e8', ring: '#7fd2ff', frame: '#2f6fe0', text: '#7fd2ff' },
  { base: '#8a4a46', top: '#e8b4ac', ring: '#ff6a5a', frame: '#c8323c', text: '#ff8a7a' },
  { base: '#5a3a9a', top: '#d0b8ff', ring: '#c69bff', frame: '#7a4cff', text: '#c69bff' },
  { base: '#1a8ab8', top: '#7fe8ff', ring: '#ffffff', frame: '#14a3c9', text: '#9fe8ff', style: STYLE.GLOW },
  { base: '#1b2266', top: '#2a1450', ring: '#c35cff', frame: '#2a1450', text: '#d39bff', style: STYLE.GALAXY },
  // Dragonfire Peaks' pads: a magma mat, then an inferno one.
  { base: '#3a1a14', top: '#ff6a1e', ring: '#ffd27a', frame: '#5a2418', text: '#ff9a4a', style: STYLE.LAVA, lava: true },
  { base: '#2a0c0c', top: '#ff3b0a', ring: '#ffb21a', frame: '#3a0c0c', text: '#ff6a3a', style: STYLE.LAVA, lava: true },
]

/** The multiplier board, high behind the dummy. Labels centre on it (lobbyLabels). */
export const BOARD_BOTTOM = 4.6
export const BOARD_HEIGHT = 3.6
/** The board's width, and its two posts' spread (inside the board's collider, shared/world padBoard). */
const BOARD_WIDTH = 3.6
const POST_SPREAD = 0.68

const WOOD = '#9a6436'
const WOOD_DARK = '#6e4424'

const DISC = new CylinderGeometry(1, 1, 1, 28)
const SMALL_DISC = new CylinderGeometry(1, 1, 1, 16)
const RING = new TorusGeometry(1, 0.06, 4, 32)
const SMALL_RING = new TorusGeometry(1, 0.06, 3, 18)
const CRYSTAL = new OctahedronGeometry(1, 0)
const ORB = new SphereGeometry(1, 10, 7)

/** The rune mat you stand on: a two-tier stone disc, a glowing rune ring and runes round it. */
function buildMat(blocks, props, x, z, theme) {
  const r = PAD_RADIUS
  // (Pads stand 6.3 m apart round the arc: the base stays clear of its neighbours'.)
  props.add(DISC, { position: [x, PAD_HEIGHT * 0.4, z], scale: [r + 0.32, PAD_HEIGHT * 0.8, r + 0.32], color: theme.base, style: STYLE.STUDS })
  props.add(DISC, { position: [x, PAD_HEIGHT - 0.06, z], scale: [r, 0.14, r], color: theme.top, style: theme.style ?? STYLE.STUDS })
  props.add(RING, { position: [x, PAD_HEIGHT + 0.02, z], rotation: [Math.PI / 2, 0, 0], scale: [r - 0.25, r - 0.25, 1], color: theme.ring, style: STYLE.GLOW })
  // Eight rune marks inside the ring, each a little glowing bar turned to the middle.
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2 + 0.2
    const rr = r - 0.75
    blocks.add(x + Math.cos(a) * rr, PAD_HEIGHT + 0.03, z + Math.sin(a) * rr, 0.42, 0.04, k % 2 ? 0.12 : 0.2, theme.ring, STYLE.GLOW, -a + (k % 3) * 0.4)
  }
}

/**
 * The dummy's platform at dummySpot (inside its collider): a round stone base with a
 * wooden top, its top exactly DUMMY_BASE up (the dummy stands on it), a glowing ring
 * round its foot.
 */
function buildPlatform(props, index, theme) {
  const d = dummySpot(index)
  props.add(SMALL_DISC, { position: [d.x, (DUMMY_BASE - 0.08) / 2, d.z], scale: [0.78, DUMMY_BASE - 0.08, 0.78], color: theme.lava ? '#241a1c' : '#8a8f9c', style: STYLE.STUDS })
  props.add(SMALL_DISC, { position: [d.x, DUMMY_BASE - 0.04, d.z], scale: [0.7, 0.08, 0.7], color: theme.lava ? '#3a2626' : WOOD, style: STYLE.SMOOTH })
  props.add(SMALL_RING, { position: [d.x, DUMMY_BASE - 0.12, d.z], rotation: [Math.PI / 2, 0, 0], scale: [0.8, 0.8, 1], color: theme.ring, style: STYLE.GLOW })
}

/**
 * The board behind the dummy (padBoard: turned to face back in at the pad), high enough
 * that the camera behind you sees it over the dummy: two stone posts, the board in the
 * pad's colour with a dark face and a glowing edge, and on top a small crest of crossed
 * swords (flames on a lava pad). A rack of practice swords stands between the posts. All
 * of it on the ground is inside the board's collider.
 */
function buildBoard(blocks, index, theme, c) {
  const { x, z, yaw } = padBoard(index)
  const by = BOARD_BOTTOM
  const bh = BOARD_HEIGHT
  const box = (lx, ly, lz, sx, sy, sz, color, style, tilt = 0) => localBox(blocks, x, 0, z, yaw, lx, ly, lz, sx, sy, sz, color, style, tilt)
  for (const s of [-1, 1]) {
    box(s * POST_SPREAD, 0.25, 0, 0.4, 0.5, 0.4, c.dark, STYLE.STUDS)
    box(s * POST_SPREAD, 0.5 + (by - 0.5) / 2, 0, 0.28, by - 0.5, 0.28, c.stone[1], STYLE.STUDS)
  }
  box(0, by + bh / 2, 0, BOARD_WIDTH, bh, 0.4, theme.frame, STYLE.SMOOTH)
  box(0, by + bh / 2, 0.23, BOARD_WIDTH - 0.4, bh - 0.4, 0.08, '#141a3a', STYLE.SMOOTH)
  box(0, by + 0.17, 0.28, BOARD_WIDTH - 0.3, 0.1, 0.06, theme.ring, STYLE.GLOW)
  box(0, by + bh - 0.17, 0.28, BOARD_WIDTH - 0.3, 0.1, 0.06, theme.ring, STYLE.GLOW)
  for (const s of [-1, 1]) box(s * (BOARD_WIDTH / 2 - 0.15), by + bh / 2, 0.28, 0.1, bh - 0.4, 0.06, theme.ring, STYLE.GLOW)
  if (theme.lava) {
    // Flames licking up off the top: stacked glowing blocks, hotter at the core.
    for (let i = -2; i <= 2; i += 1) {
      const h = 0.9 + (2 - Math.abs(i)) * 0.45
      box(i * 0.62, by + bh + h / 2, 0, 0.5, h, 0.3, '#ff4a0a', STYLE.GLOW)
      box(i * 0.62, by + bh + h * 0.275, 0, 0.3, h * 0.55, 0.36, '#ffd27a', STYLE.GLOW)
    }
  } else {
    crossedSwords(blocks, x, by + bh + 1.15, z, yaw, 0, 0, 0, 2.3, { blade: c.blade, trim: theme.ring, grip: WOOD_DARK })
  }
  // The rack of practice swords between the posts, on the pad's side of them.
  for (const s of [-1, 1]) box(s * 0.42, 0.65, 0.42, 0.1, 1.3, 0.1, WOOD_DARK, STYLE.SMOOTH)
  box(0, 1.2, 0.42, 0.94, 0.1, 0.1, WOOD_DARK, STYLE.SMOOTH)
  for (let k = -1; k <= 1; k += 1) {
    box(k * 0.26, 0.72, 0.5, 0.12, 1.3, 0.05, WOOD, STYLE.SMOOTH)
    box(k * 0.26, 0.3, 0.5, 0.3, 0.06, 0.1, WOOD_DARK, STYLE.SMOOTH)
  }
}

/**
 * The training circle: round rune mats in the pads' colours round their arc (two-tier
 * stone, a glowing ring and runes round its top), each dummy's platform just out beyond
 * its mat (dummySpot), and the multiplier board out behind it (padBoard) with a rack of
 * practice swords. The rounded parts go into the world's props, the rest into its blocks:
 * no draw calls of their own.
 */
export function buildPads(blocks, props, { world = 0 } = {}) {
  const c = venueOf(world).castle
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const theme = PAD_THEMES[i]
    buildMat(blocks, props, padCenterX(i), padCenterZ(i), theme)
    buildPlatform(props, i, theme)
    buildBoard(blocks, i, theme, c)
  }
}

/** Where pad `index`'s label hangs: in front of its board (towards the pad), centred on it. */
export function padLabelAt(index) {
  const b = padBoard(index)
  const d = padDir(index)
  return [b.x - d.x * 2.4, BOARD_BOTTOM + BOARD_HEIGHT / 2, b.z - d.z * 2.4]
}

/**
 * The SWORD SHOP sign's board, crowning the Sword Wall (over SWORD_WALL_TOP, under
 * SHOP_SIGN.top): its lettering is painted on it (signs.js) centred at `midY`.
 */
export const SHOP_BOARD = { bottom: SWORD_WALL_TOP + 0.25, top: SHOP_SIGN.top, midY: (SWORD_WALL_TOP + 0.25 + SHOP_SIGN.top) / 2 }

/**
 * The SWORD SHOP sign crowning the Sword Wall (on its top, behind the cornice), its face to
 * the courtyard (`f`): a board between two stone pillars standing on the wall, a gold cap,
 * the crest on top. `detail` (off on LOW) adds the bulbs and the crest.
 */
export function buildShop(blocks, { detail = true, world = 0 } = {}) {
  const v = venueOf(world)
  const c = v.castle
  const { band, post, panel } = v.shop
  const { x, minZ, maxZ, top } = SHOP_SIGN
  const f = SHOP_SIGN_FACING
  const yaw = (f * Math.PI) / 2
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const { bottom } = SHOP_BOARD
  for (const z of [minZ + 1.5, maxZ - 1.5]) {
    blocks.addOn(x, SWORD_WALL_TOP, z, 1.0, 0.5, 1.0, c.dark, STYLE.STUDS)
    blocks.addOn(x, SWORD_WALL_TOP + 0.5, z, 0.8, top + 0.2 - SWORD_WALL_TOP - 0.5, 0.8, post, STYLE.STUDS)
    blocks.addOn(x, top + 1.0, z, 1.1, 0.4, 1.1, c.cap, STYLE.SMOOTH)
    blocks.addOn(x, top + 1.4, z, 0.5, 0.5, 0.5, c.glow, STYLE.GLOW, Math.PI / 4)
  }
  blocks.addOn(x, bottom, midZ, 0.6, top - bottom, length - 2.6, band)
  blocks.addOn(x + 0.1 * f, bottom + 0.5, midZ, 0.6, top - bottom - 1, length - 3.6, panel, STYLE.SMOOTH)
  blocks.addOn(x, top, midZ, 0.9, 0.4, length - 2.2, c.trim, STYLE.GLOW)
  if (detail) {
    for (let z = minZ + 3; z <= maxZ - 2.99; z += 1.5) {
      blocks.add(x + 0.42 * f, bottom + 0.25, z, 0.16, 0.3, 0.3, Math.round(z) % 2 ? '#ffffff' : c.trim, STYLE.GLOW)
      blocks.add(x + 0.42 * f, top - 0.25, z + 0.75, 0.16, 0.3, 0.3, Math.round(z) % 2 ? c.trim : '#ffffff', STYLE.GLOW)
    }
    // The crest over the board.
    crossedSwords(blocks, x, top + 3.3, midZ, yaw, 0, 0, 0, 6, { blade: c.blade, trim: c.trim, grip: c.wood })
    localBox(blocks, x, top + 2.0, midZ, yaw, 0, 0, 0.3, 1.7, 1.9, 0.3, c.trim, STYLE.SMOOTH)
    localBox(blocks, x, top + 2.05, midZ, yaw, 0, 0, 0.5, 1.35, 1.55, 0.2, c.banner, STYLE.SMOOTH)
  }
}

/**
 * Where the Enchant Altar's sign board stands (its lettering: signs.js), facing west onto
 * the plaza from high on the altar's back arch.
 */
export const ALTAR_SIGN = { x: BALL_SHOP.body.maxX - 0.75, y: 6.9, z: BALL_SHOP.z, width: 6.0, height: 1.3 }
/** The template's name for it. */
export const BALL_SHOP_SIGN = ALTAR_SIGN

/** The enchantments' glows, round the dais: fire, frost, storm, gold, galaxy, void. */
const ENCHANT_GLOWS = ['#ff6a1e', '#9ff4ff', '#fff27a', '#ffcc1f', '#a46bff', '#e36bff']

/**
 * The ENCHANT ALTAR (BALL_SHOP; its solid body BALL_SHOP.body): a two-step stone dais, the
 * altar table on it with a gold-lit edge, a big crystal floating over it inside a glowing
 * rune ring, four rune stones at the dais's corners, six little pedestals round it each
 * with an orb glowing in one enchantment's colour, and behind it all a stone arch with the
 * ENCHANTS board high on it facing the plaza. Blocks and props: no draw calls of its own.
 */
export function buildEnchantAltar(blocks, props, { world = 0 } = {}) {
  const v = venueOf(world)
  const a = v.altar
  const { minX, maxX, minZ, maxZ } = BALL_SHOP.body
  const cz = BALL_SHOP.z
  const cx = (minX + maxX) / 2
  const w = maxX - minX
  const d = maxZ - minZ
  // The dais: two steps.
  blocks.addOn(cx, 0, cz, w, 0.4, d, a.dark, STYLE.STUDS)
  blocks.addOn(cx + 0.15, 0.4, cz, w - 0.7, 0.3, d - 0.8, a.stone, STYLE.STUDS)
  const deck = 0.7
  // The altar table, towards the front, and its top with a glowing edge.
  const ax = minX + 1.35
  blocks.addOn(ax, deck, cz, 1.0, 0.95, 2.0, a.stone, STYLE.STUDS)
  blocks.addOn(ax, deck + 0.95, cz, 1.3, 0.16, 2.4, a.dark, STYLE.SMOOTH)
  blocks.addOn(ax, deck + 0.98, cz, 1.36, 0.08, 2.46, a.trim, STYLE.GLOW)
  // The crystal over it, a white core inside, and the rune ring round it.
  const cy = deck + 2.6
  props.add(CRYSTAL, { position: [ax, cy, cz], scale: [0.5, 0.95, 0.5], color: a.crystal, style: STYLE.GLOW })
  props.add(CRYSTAL, { position: [ax, cy, cz], scale: [0.22, 0.45, 0.22], color: a.core, style: STYLE.GLOW })
  props.add(RING, { position: [ax, cy, cz], rotation: [Math.PI / 2, 0, 0], scale: [1.05, 1.05, 1.3], color: a.rune, style: STYLE.GLOW })
  props.add(RING, { position: [ax, cy, cz], rotation: [0.5, 0, 0.3], scale: [0.85, 0.85, 1.1], color: a.rune, style: STYLE.GLOW })
  // Rune stones at the dais's corners: a tapering stone with glowing runes up its face.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * (w / 2 - 0.5)
    const z = cz + sz * (d / 2 - 0.55)
    blocks.addOn(x, deck, z, 0.6, 1.6, 0.6, a.dark, STYLE.STUDS)
    blocks.addOn(x, deck + 1.6, z, 0.44, 0.9, 0.44, a.dark, STYLE.STUDS)
    for (const y of [0.5, 1.1, 1.9]) blocks.add(x - 0.31, deck + y, z, 0.04, 0.22, 0.14, a.rune, STYLE.GLOW)
    blocks.addOn(x, deck + 2.5, z, 0.26, 0.26, 0.26, a.rune, STYLE.GLOW, Math.PI / 4)
  }
  // Six pedestals along the dais's sides, each with an enchantment's orb.
  ENCHANT_GLOWS.forEach((glow, i) => {
    const side = i % 2 ? 1 : -1
    const x = minX + 0.9 + Math.floor(i / 2) * 0.9
    const z = cz + side * (d / 2 - 1.35)
    blocks.addOn(x, deck, z, 0.36, 0.85, 0.36, a.stone, STYLE.STUDS)
    blocks.addOn(x, deck + 0.85, z, 0.5, 0.1, 0.5, a.trim, STYLE.SMOOTH)
    props.add(ORB, { position: [x, deck + 1.22, z], scale: 0.24, color: glow, style: STYLE.GLOW })
  })
  // The back arch: two pillars, a lintel, and the board standing on it.
  const bx = maxX - 0.45
  for (const s of [-1, 1]) {
    blocks.addOn(bx, deck, cz + s * 2.4, 0.7, 4.6, 0.7, a.stone, STYLE.STUDS)
    blocks.addOn(bx, deck + 4.6, cz + s * 2.4, 0.9, 0.3, 0.9, a.dark, STYLE.SMOOTH)
  }
  blocks.addOn(bx, deck + 4.85, cz, 0.8, 0.5, 5.7, a.dark, STYLE.STUDS)
  const sign = ALTAR_SIGN
  blocks.addOn(sign.x + 0.12, sign.y - sign.height / 2 - 0.12, cz, 0.22, sign.height + 0.24, sign.width + 0.3, a.trim, STYLE.SMOOTH)
  blocks.addOn(sign.x + 0.08, sign.y - sign.height / 2, cz, 0.22, sign.height, sign.width, a.board, STYLE.SMOOTH)
  // A rune orb over the lintel.
  props.add(ORB, { position: [bx, sign.y + 1.25, cz], scale: 0.42, color: a.rune, style: STYLE.GLOW })
}
