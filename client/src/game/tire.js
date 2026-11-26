import { SWORD_STYLES, swordBase, swordTrail } from './swords'

/**
 * Each sword's colours, by sword id (the ids are the template's tire ids, kept for saves;
 * names and stats live in shared/balance.js, and how each sword looks is swords.js). Named
 * for the template, so everything that tinted itself by your tire - the stands, the
 * impact's glow, the speed lines - now takes your sword's colours. `trail` is the glow
 * colour; `a` is the sword's base colour.
 */
export const TIRE_STYLES = SWORD_STYLES

export const tireRim = (id) => swordBase(id)
export const tireGlow = (id) => swordTrail(id)
