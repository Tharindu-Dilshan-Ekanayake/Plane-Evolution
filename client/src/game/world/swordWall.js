import { counterRect, PLATE_UP, SWORD_COLUMN_PITCH, SWORD_COUNTER, SWORD_TIER_HEIGHT, SWORD_TIERS, SWORD_WALL_TOP, SWORD_WALL } from '@shared/world'

/**
 * The Sword Wall's look, front (west, the courtyard) to back - shared by the wall itself
 * (TireShop.jsx) and its name plates' text (lobbyLabels.js). The wall's footprint, its
 * niches and the counter's dais are gameplay layout (shared/world.js); this is just how
 * they're dressed.
 *
 *   x 40.00  WALL_FACE    the pillars' fronts (the face the collider stops you at)
 *   x 40.15  PLATE_LABEL  a name plate's lettering
 *   x 40.25  PLATE_FRONT  a name plate's front
 *   x 40.55  PANEL_FRONT  a niche's glowing back panel
 *   x 40.65  NICHE_BACK   the wall's body: every niche is recessed to here
 *
 * The swords hang SWORD_OUT (1.2) in front of the face, over their plates.
 */
export const WALL_FACE = SWORD_WALL.x
export const NICHE_BACK = WALL_FACE + 0.65
export const PANEL_FRONT = NICHE_BACK - 0.1
export const PLATE_FRONT = WALL_FACE + 0.25
export const PLATE_LABEL_X = PLATE_FRONT - 0.1

/** A pillar between two columns (the end pillars are END_PILLAR wide), and a niche's width between them. */
export const PILLAR = 0.7
export const END_PILLAR = 1.0
export const NICHE_WIDTH = SWORD_COLUMN_PITCH - PILLAR
/** The ledge under each tier above the bottom one, and the cornice crowning the last. */
export const LEDGE = 0.3
export const CORNICE = 0.6

/** A name plate's block: its middle at the niche's plateY (shared/world PLATE_UP). */
export const PLATE = { width: 3.7, height: 1.36 }

/** Top of niche `stand`'s inside: under the next tier's ledge, or under the cornice. */
export const nicheCeiling = (stand) => (stand.tier < SWORD_TIERS - 1 ? stand.floor + SWORD_TIER_HEIGHT - LEDGE : SWORD_WALL_TOP - CORNICE)
/** The glowing frame round a niche's sword: from just over its plate to just under its ceiling. */
export const frameBottom = (stand) => stand.floor + PLATE_UP + PLATE.height / 2 + 0.12
export const frameTop = (stand) => nicheCeiling(stand) - 0.08

/**
 * The SWORD COUNTER's sign board: low (no higher than 1.2 m, so from the courtyard it never
 * hides a name plate) along the dais's east edge, facing west - its lettering a flat label
 * just in front (`label`).
 */
export const COUNTER_SIGN = {
  x: counterRect.maxX - 0.25,
  depth: 0.3,
  bottom: SWORD_COUNTER.height,
  top: 1.2,
  width: 3.6,
}
export const COUNTER_LABEL = [COUNTER_SIGN.x - COUNTER_SIGN.depth / 2 - 0.08, (COUNTER_SIGN.bottom + COUNTER_SIGN.top) / 2 + 0.02, SWORD_COUNTER.z]
