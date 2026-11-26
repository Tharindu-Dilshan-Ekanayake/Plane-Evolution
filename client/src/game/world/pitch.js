import { counterRect, PATH_HALF, PLAZA, SPAWN, SWORD_WALL, THROW_STAGE } from '@shared/world'

/**
 * The courtyard's plan: where the painted pieces of the floor go. (The file keeps the
 * template's name; nothing here is a sports pitch any more.)
 *
 * Who draws what:
 *  - the colour areas - lawn, flagstones, the avenue, the open plaza in the middle, the
 *    training circle's sand, the Sword Wall's marble apron, the flower beds - are painted
 *    into the ground map (ground.js);
 *  - the academy's crest at the spawn and the direction stencils are decals in the
 *    painted-signs atlas (signs.js), DECAL_Y above the ground.
 *
 * Everything here is flat paint: the courtyard's middle stays open, nothing to walk round.
 */

/** The academy's round crest at the spawn, on its flagstone courtyard (COURTYARD). */
export const LOGO = { x: SPAWN.x, z: SPAWN.z, radius: 7.5 }
/** The round flagstone courtyard round the spawn. */
export const COURTYARD = { x: SPAWN.x, z: SPAWN.z, radius: 10 }
/** The open plaza in the courtyard's middle: a flagstone disc the avenue runs straight through. */
export const PLAZA_DISC = { x: 0, z: 14, radius: 12 }
/** The avenue: one straight cobbled run from the spawn gate up to the throw stage's steps. */
export const PATHS = [{ minX: -PATH_HALF - 1, maxX: PATH_HALF + 1, minZ: THROW_STAGE.maxZ, maxZ: PLAZA.maxZ }]
/** The spokes off the plaza: west to the training circle's sand, east to the Sword Wall's apron (and its counter). */
export const SPOKES = [
  { minX: -29.5, maxX: -PLAZA_DISC.radius + 1, minZ: PLAZA_DISC.z - 2.5, maxZ: PLAZA_DISC.z + 2.5 },
  { minX: PLAZA_DISC.radius - 1, maxX: 26.5, minZ: counterRect.minZ + 0.7, maxZ: counterRect.maxZ - 0.7 },
]
/** The Sword Wall's marble apron: from the wall's face out into the courtyard, the counter's dais on it. */
export const APRON = { minX: 26, maxX: SWORD_WALL.x, minZ: SWORD_WALL.minZ - 2, maxZ: 41 }

/** How high the decals lie (at least 3 cm off the ground and each other). */
export const DECAL_Y = 0.03

/**
 * The direction stencils, white with an arrow: `arrow` is which way it points in the image
 * (its top is north at yaw 0), `yaw` turns it to read from where you'd see it. PETS and
 * ENCHANTS as you step off the spawn's crest (the egg rows either side, the altar east);
 * THROW STAGE, TRAINING and SWORDS a little up the avenue, past the eggs. (At most five:
 * the atlas has five cells for them - signs.js.)
 */
export const DIRECTIONS = [
  { text: 'THROW STAGE', arrow: 'up', x: 0, z: 36, width: 8.5, yaw: 0 },
  { text: 'TRAINING', arrow: 'left', x: -12.5, z: 33, width: 7, yaw: 0 },
  { text: 'SWORDS', arrow: 'right', x: 12.5, z: 33, width: 6.5, yaw: 0 },
  { text: 'PETS', arrow: 'left', x: -9.5, z: 49, width: 5.5, yaw: 0 },
  { text: 'ENCHANTS', arrow: 'right', x: 9.5, z: 49, width: 6, yaw: 0 },
]
/** A stencil's height for its width (its atlas cell's shape). */
export const DIRECTION_ASPECT = 0.22

/**
 * Flower beds, as rects: along both sides of the avenue (gaps where the plaza and the
 * stencils are), and along the foot of the castle walls. Painted only: you can walk
 * through them. (The arc of beds behind the training boards is ground.js's.)
 */
export const FLOWER_BEDS = (() => {
  const beds = []
  const side = (z0, z1, half) => {
    for (const s of [-1, 1]) {
      const x0 = s * (half + 0.9)
      beds.push({ minX: Math.min(x0, x0 + s * 1.6), maxX: Math.max(x0, x0 + s * 1.6), minZ: z0, maxZ: z1 })
    }
  }
  // Up the avenue: between the eggs and the plaza, and between the plaza and the stage.
  side(28, 39, PATH_HALF + 1)
  side(-6, 0.5, PATH_HALF + 1)
  side(-20, -10, PATH_HALF + 1)
  // Along the south wall, either side of the leaderboards; up the east and west walls by spawn.
  beds.push({ minX: PLAZA.minX + 0.4, maxX: -33, minZ: PLAZA.maxZ - 1.6, maxZ: PLAZA.maxZ - 0.2 })
  beds.push({ minX: 33, maxX: PLAZA.maxX - 0.4, minZ: PLAZA.maxZ - 1.6, maxZ: PLAZA.maxZ - 0.2 })
  beds.push({ minX: -8, maxX: -2, minZ: PLAZA.maxZ - 1.6, maxZ: PLAZA.maxZ - 0.2 })
  beds.push({ minX: 2, maxX: 8, minZ: PLAZA.maxZ - 1.6, maxZ: PLAZA.maxZ - 0.2 })
  return beds
})()
