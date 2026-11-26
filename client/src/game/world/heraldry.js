import { STYLE } from '../materials'

/**
 * The academy's heraldry and fixtures, as boxes for the world's block set (no draw calls
 * of their own): hanging banners with the academy's crest - two crossed swords, point up,
 * over a gold border - giant crossed swords for the crests on the arch and the great board,
 * braziers and wall torches. Everything is placed in a local frame turned by `yaw` about
 * the vertical (local +Z is the way it faces: yaw 0 faces south, +Z), so the same piece
 * hangs on any wall.
 *
 * The crest is original: a blue field, a gold border and two steel swords crossed in a
 * saltire with gold guards - no lettering, no borrowed symbol.
 */

/** World offset of local (lx, lz) turned by `yaw`: written into `out` [x, z]. */
const _o = [0, 0]
function turn(yaw, lx, lz) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  _o[0] = lx * c + lz * s
  _o[1] = -lx * s + lz * c
  return _o
}

/**
 * A box given in a turned frame: its centre at local (lx, ly, lz) from (x, y, z), sized in
 * local terms, tilted `tilt` about its own facing axis (local Z) before the turn.
 */
export function localBox(blocks, x, y, z, yaw, lx, ly, lz, sx, sy, sz, color, style = STYLE.SMOOTH, tilt = 0) {
  const [ox, oz] = turn(yaw, lx, lz)
  blocks.add(x + ox, y + ly, z + oz, sx, sy, sz, color, style, yaw, 0, tilt)
}

/**
 * One sword lying flat in a turned frame's XY plane: its grip at local (lx, ly), pointing
 * along `tilt` from straight up (positive tilts it towards local -X), `length` from guard
 * to tip, `width` across the blade, `depth` its thickness (out along local Z, at lz).
 */
export function flatSword(blocks, x, y, z, yaw, lx, ly, lz, tilt, length, width, depth, c) {
  const dx = -Math.sin(tilt)
  const dy = Math.cos(tilt)
  const at = (d) => [lx + dx * d, ly + dy * d]
  // Blade, its darker fuller down the middle, and a pointed tip (a diamond: a square turned 45 degrees).
  const [bx, by] = at(length / 2 + width * 0.25)
  localBox(blocks, x, y, z, yaw, bx, by, lz, width, length, depth, c.blade, STYLE.SMOOTH, tilt)
  localBox(blocks, x, y, z, yaw, bx, by, lz + depth * 0.55, width * 0.22, length * 0.86, depth * 0.2, c.fuller ?? '#b9c3d2', STYLE.SMOOTH, tilt)
  const tip = width / Math.SQRT2
  const [tx, ty] = at(length + width * 0.25)
  localBox(blocks, x, y, z, yaw, tx, ty, lz, tip, tip, depth * 0.96, c.blade, STYLE.SMOOTH, tilt + Math.PI / 4)
  // Guard, grip and pommel.
  localBox(blocks, x, y, z, yaw, lx, ly, lz, width * 3.4, width * 0.55, depth * 1.6, c.trim, STYLE.GLOW, tilt)
  const [gx, gy] = at(-width * 0.9)
  localBox(blocks, x, y, z, yaw, gx, gy, lz, width * 0.5, width * 1.5, depth * 1.4, c.grip ?? '#5a3a24', STYLE.SMOOTH, tilt)
  const [px, py] = at(-width * 1.85)
  localBox(blocks, x, y, z, yaw, px, py, lz, width * 0.8, width * 0.8, depth * 1.6, c.trim, STYLE.GLOW, tilt + Math.PI / 4)
}

/**
 * The crest's two swords crossed, centred on local (lx, ly), `size` tall overall, lying
 * `lz` out in front of whatever they're on.
 */
export function crossedSwords(blocks, x, y, z, yaw, lx, ly, lz, size, c) {
  const length = size * 0.72
  const width = size * 0.085
  for (const side of [-1, 1]) {
    const tilt = side * 0.62
    // Each grip low on its own side, so the blades cross a little above the middle.
    const gx = side * size * 0.24
    const gy = -size * 0.3
    flatSword(blocks, x, y, z, yaw, lx + gx, ly + gy, lz + side * 0.012, tilt, length, width, Math.max(0.03, size * 0.03), c)
  }
}

/**
 * A banner hanging from a bar with its top at (x, top, z), facing `yaw`: the field in
 * `field`, a gold border, a swallow-tailed foot, and the crest's crossed swords on it.
 * `w` wide, `h` long; `out` is how far in front of the wall it hangs.
 */
export function banner(blocks, x, top, z, yaw, w, h, c, { field = c.banner, out = 0.12, crest = true } = {}) {
  const y = top - h / 2
  // The bar and its two finials.
  localBox(blocks, x, top + 0.12, z, yaw, 0, 0, out, w + 0.5, 0.14, 0.14, c.trim, STYLE.GLOW)
  // Border, then the field a step in front of it.
  localBox(blocks, x, y, z, yaw, 0, 0, out, w, h, 0.05, c.trim, STYLE.SMOOTH)
  localBox(blocks, x, y + 0.04, z, yaw, 0, 0, out + 0.04, w - 0.22, h - 0.3, 0.05, field, STYLE.SMOOTH)
  // The swallow-tail foot: two pennant points below the field.
  for (const side of [-1, 1]) {
    const s = w * 0.35
    localBox(blocks, x, top - h - s * 0.2, z, yaw, side * w * 0.25, 0, out, s, s, 0.05, field, STYLE.SMOOTH, Math.PI / 4)
  }
  if (crest) crossedSwords(blocks, x, y + h * 0.06, z, yaw, 0, 0, out + 0.1, Math.min(w * 0.95, h * 0.55), c)
}

/** A brazier standing at (x, base, z): a stone foot, an iron bowl and its fire. */
export function brazier(blocks, x, base, z, c, scale = 1) {
  const s = scale
  blocks.addOn(x, base, z, 0.7 * s, 0.25 * s, 0.7 * s, c.dark, STYLE.SMOOTH)
  blocks.addOn(x, base + 0.25 * s, z, 0.3 * s, 0.75 * s, 0.3 * s, c.dark, STYLE.SMOOTH)
  blocks.addOn(x, base + 1.0 * s, z, 0.9 * s, 0.3 * s, 0.9 * s, '#3a3438', STYLE.SMOOTH, Math.PI / 4)
  blocks.addOn(x, base + 1.3 * s, z, 0.62 * s, 0.55 * s, 0.62 * s, c.flame, STYLE.GLOW, 0.3)
  blocks.addOn(x, base + 1.3 * s, z, 0.34 * s, 0.85 * s, 0.34 * s, c.core, STYLE.GLOW, 0.9)
}

/** A torch on a wall bracket at (x, y, z), sticking out towards `yaw`. */
export function wallTorch(blocks, x, y, z, yaw, c) {
  localBox(blocks, x, y - 0.35, z, yaw, 0, 0, 0.18, 0.16, 0.16, 0.36, c.dark, STYLE.SMOOTH)
  localBox(blocks, x, y, z, yaw, 0, 0, 0.36, 0.14, 0.6, 0.14, c.wood, STYLE.SMOOTH)
  localBox(blocks, x, y + 0.42, z, yaw, 0, 0, 0.36, 0.3, 0.32, 0.3, c.flame, STYLE.GLOW, 0.4)
  localBox(blocks, x, y + 0.5, z, yaw, 0, 0, 0.36, 0.15, 0.36, 0.15, c.core, STYLE.GLOW, 0.4)
}
