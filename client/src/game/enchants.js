import { Color } from 'three'

import { swordTrailLook } from './swordTrails'
import { swordTrail } from './swords'

/**
 * How every enchantment at the Enchant Altar looks (shared/balance.js BALLS - the
 * template's balls: names and stats). Colours are sRGB hex.
 *
 *   a, b     the panel swatch's two colours
 *   aura     the glow wrapped round the flying sword (null: none)
 *   head     the trail's colour at the sword; `tail` at its tip (null: the sword's own glow)
 *   rainbow  the trail runs through every colour
 *   fx       what streams off it in the air: 'fire' (flames and embers), 'frost',
 *            'spark' (electric), 'gold' (glitter), 'smoke' (meteor), 'stars', 'void',
 *            'wind' (swirling streaks) - or nothing
 *
 * A bare blade (No Enchant) trails in the sword's own glow colour (swords.js), so every
 * sword already leaves its own streak; each enchantment then puts its aura over it.
 */
export const ENCHANT_STYLES = {
  plain: { a: '#d6dce6', b: '#9aa4b4', aura: null, head: null, tail: null },
  keen: { a: '#ffffff', b: '#bfe6ff', aura: '#e8f6ff', head: '#ffffff', tail: '#8fd0ff', fx: 'gold' },
  swift: { a: '#b6ffcf', b: '#3fd18a', aura: '#a6ffd0', head: '#e6fff0', tail: '#3fd18a', fx: 'wind' },
  flame: { a: '#ffb21a', b: '#ff3b0a', aura: '#ff6a1a', head: '#fff27a', tail: '#ff2a00', fx: 'fire' },
  frost: { a: '#e8fbff', b: '#4fb8ff', aura: '#8fdcff', head: '#e8fbff', tail: '#3f9cff', fx: 'frost' },
  storm: { a: '#fff7a0', b: '#4fd2ff', aura: '#9ff4ff', head: '#fff7a0', tail: '#4fd2ff', fx: 'spark' },
  golden: { a: '#ffe98a', b: '#ffb000', aura: '#ffd23a', head: '#fff3a8', tail: '#ffb000', fx: 'gold' },
  meteor: { a: '#ffd27a', b: '#c2410c', aura: '#ff7a1a', head: '#ffd27a', tail: '#ff3b00', fx: 'smoke' },
  plasma: { a: '#22e6ff', b: '#ff3df2', aura: '#ff6af6', head: '#9ff8ff', tail: '#ff3df2', fx: 'spark' },
  rainbow: { a: '#ff7ad9', b: '#7fd2ff', aura: '#ffffff', head: '#ffffff', tail: '#ff7ad9', rainbow: true, fx: 'stars' },
  galaxy: { a: '#7a3cff', b: '#140a33', aura: '#a46bff', head: '#c69bff', tail: '#3f6bff', fx: 'stars' },
  void: { a: '#b14dff', b: '#030208', aura: '#d18bff', head: '#d18bff', tail: '#1a0633', fx: 'void' },
}

const FALLBACK = ENCHANT_STYLES.plain
const WHITE = new Color('#ffffff')

// Parsed once: frame code looks colours up without allocating.
const PARSED = Object.fromEntries(
  Object.entries(ENCHANT_STYLES).map(([id, s]) => [
    id,
    {
      fx: s.fx || null,
      rainbow: Boolean(s.rainbow),
      aura: s.aura ? new Color(s.aura) : null,
      head: s.head ? new Color(s.head) : null,
      tail: s.tail ? new Color(s.tail) : null,
    },
  ]),
)

/** Enchantment `id`'s style as hex (for the UI). */
export const enchantStyle = (id) => ENCHANT_STYLES[id] || FALLBACK

/** Enchantment `id`'s aura colour round the flying sword, or null for a bare blade. */
export const enchantAura = (id) => (PARSED[id] || PARSED.plain).aura

/** What the trail of sword `tireId` with enchantment `ballId` looks like. Reused: copy what you keep. */
const _look = { head: new Color(), tail: new Color(), fx: null, rainbow: false }
export function trailLook(ballId, tireId) {
  const e = PARSED[ballId] || PARSED.plain
  const own = swordTrail(tireId)
  _look.head.copy(e.head ?? own)
  // A bare blade's streak fades from its glow towards white-hot at the tip.
  _look.tail.copy(e.tail ?? _look.tail.copy(own).lerp(WHITE, 0.55))
  _look.fx = e.fx
  _look.rainbow = e.rainbow
  return _look
}

/**
 * The colour the speed lines take for a throw of sword `tireId`: its own trail's (its
 * enchantment shows in its aura). `ballId` is kept for the callers.
 */
export const throwTint = (ballId, tireId) => swordTrailLook(tireId).head
