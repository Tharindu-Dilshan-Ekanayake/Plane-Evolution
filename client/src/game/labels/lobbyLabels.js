import { EGGS, PADS, PETS, SHOP, TIRES, WORLD_PORTALS, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { isPadUnlocked } from '@shared/logic'
import { BALL_SHOP, EGG_STANDS, FREE_REWARD, PORTALS, SPHINX_STAND, STAGE_TOWERS, THROW_STAGE, TIRE_STANDS } from '@shared/world'

import { eggHeight } from '../world/eggs'
import { PAD_THEMES, padLabelAt } from '../world/structures'
import { COUNTER_LABEL, PLATE_LABEL_X } from '../world/swordWall'
import { SCOREBOARD } from '../world/terrain'

/**
 * Text styles, as gradients top-to-bottom, matching the reference signage.
 */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#d9ff9a', '#7dff4a', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
  lava: ['#ffe0a0', '#ff8a1e', '#e2240c'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/**
 * "x4 POWER / Stone Dummy / LOCKED: 2 Rebirths", "x1 POWER / Straw Dummy / FREE",
 * "x40 POWER / VERY OP! / 150K Wins"... (over each training dummy's board). The names come
 * from shared/balance.js PADS.
 */
export function padLabelSpec(index, unlocked, world = 0) {
  const pad = PADS[index]
  const theme = PAD_THEMES[index]
  const lines = [
    { text: `x${formatNumber(pad.mult)} POWER`, size: 54, icon: 'heart', gradient: tint(theme.text) },
    { text: pad.name, size: 34, fill: '#ffffff' },
  ]
  if (unlocked) {
    lines.push({ text: pad.rebirths === 0 && !pad.product ? 'FREE' : 'UNLOCKED', size: 44, gradient: TEXT.green })
  } else if (pad.world !== undefined && world !== pad.world) {
    lines.push({ text: `${WORLDS[pad.world].name.toUpperCase()} ONLY`, size: 44, icon: 'portal', gradient: TEXT.lava })
  } else if (pad.product) {
    lines.push({ text: pad.tag, size: 46, rainbow: true })
    lines.push({ text: `${formatNumber(SHOP[pad.product].price)} Wins`, size: 42, icon: 'trophy', gradient: TEXT.gold })
  } else {
    const word = pad.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    lines.push({ text: `LOCKED: ${pad.rebirths} ${word}`, size: 44, icon: 'rebirth', gradient: TEXT.red })
  }
  return { lines, pxPerUnit: 64 }
}

/** Largest a pad label can get, so its atlas slot fits every state. */
const padReserve = (index) => {
  const pad = PADS[index]
  const lines = [
    { text: `x${formatNumber(pad.mult)} POWER`, size: 54, icon: 'heart' },
    { text: pad.name, size: 34 },
  ]
  if (pad.product) {
    lines.push({ text: pad.tag, size: 46 })
    lines.push({ text: `${formatNumber(SHOP[pad.product].price)} Wins`, size: 42, icon: 'trophy' })
  } else {
    lines.push({ text: 'LOCKED: 88 Rebirths', size: 44, icon: 'rebirth' })
  }
  return { lines }
}

export function padLabels(profile) {
  return PADS.map((pad, i) => ({
    id: `pad-${i}`,
    // Well in front of the pad's board (structures.js padLabelAt), over the dummy: the
    // label turns to face the camera and is wider than the board, so any nearer and its far
    // half swings behind the board seen from an angle.
    position: padLabelAt(i),
    spec: padLabelSpec(i, isPadUnlocked(profile, i), profile.world || 0),
    reserve: padReserve(i),
    fade: 150,
  }))
}

/** Ownership state of each sword stand: 'equipped' | 'owned' | 'buy' | 'locked'. */
export function standState(profile, index) {
  const tire = TIRES[index]
  if (profile.equippedTire === tire.id) return 'equipped'
  if (profile.ownedTires.includes(tire.id)) return 'owned'
  const previous = TIRES[index - 1]
  return !previous || profile.ownedTires.includes(previous.id) ? 'buy' : 'locked'
}

/**
 * The Sword Wall's name plates (world/swordWall.js): canvas pixels per metre, and the
 * widest a line may be before it's drawn smaller (so every plate's text fits its 3.7 m
 * block - a long name like "Abyssal Trident Blade" shrinks, the plate doesn't widen).
 */
const PLATE_PX = 108
const PLATE_LINE_MAX = 375

/** "+5.7B Power", and a Legend sword's Wins bonus beside it: "+5.7B Power  +10% Wins". */
const statsText = (tire) => {
  const power = `+${formatNumber(tire.power)} Power`
  return tire.wins > 1 ? `${power}  +${Math.round((tire.wins - 1) * 100)}% Wins` : power
}

/** The plate's last line: EQUIPPED / OWNED, or the price - green for the next to buy, red past it. */
const stateLine = (tire, state) => {
  if (state === 'equipped') return { text: 'EQUIPPED', size: 38, gradient: TEXT.gold }
  if (state === 'owned') return { text: 'OWNED', size: 38, gradient: TEXT.blue }
  const price = tire.cost > 0 ? `${formatNumber(tire.cost)} Wins` : 'FREE'
  return state === 'buy'
    ? { text: `NEXT: ${price}`, size: 38, icon: 'trophy', gradient: TEXT.price }
    : { text: price, size: 38, icon: 'trophy', gradient: TEXT.red }
}

/**
 * A sword's name plate on the Sword Wall, under its niche: its name (biggest), its Power
 * (and a Legend sword's Wins bonus), then EQUIPPED / OWNED or its price. Flat on the wall,
 * so it reads from right across the courtyard. (Its rarity shows in its niche's glow.)
 */
export function standLabelSpec(index, state) {
  const tire = TIRES[index]
  return {
    lines: [
      { text: tire.name, size: 48, fill: '#ffffff' },
      { text: statsText(tire), size: 26, icon: 'heart', gradient: TEXT.gold },
      stateLine(tire, state),
    ],
    pxPerUnit: PLATE_PX,
    maxWidth: PLATE_LINE_MAX,
  }
}

/** Largest a plate can get (its widest state line), so its atlas slot fits every state. */
const standReserve = (index) => {
  const tire = TIRES[index]
  return {
    lines: [
      { text: tire.name, size: 48 },
      { text: statsText(tire), size: 26, icon: 'heart' },
      { text: `NEXT: ${formatNumber(tire.cost)} Wins`, size: 38, icon: 'trophy' },
    ],
    maxWidth: PLATE_LINE_MAX,
  }
}

export function standLabels(profile) {
  return TIRE_STANDS.map((stand) => ({
    id: `stand-${stand.index}`,
    // On the plate under the niche's sword (TireShop.jsx), flat on the wall facing the courtyard.
    position: [PLATE_LABEL_X, stand.plateY, stand.z],
    facing: stand.yaw,
    spec: standLabelSpec(stand.index, standState(profile, stand.index)),
    reserve: standReserve(stand.index),
    fade: 125,
  }))
}

/** On the Sword Counter's sign board, flat, facing the courtyard: where to buy. */
const counterLabel = () => ({
  id: 'sword-counter',
  position: COUNTER_LABEL,
  facing: -Math.PI / 2,
  spec: {
    lines: [
      { text: 'SWORD COUNTER', size: 56, gradient: TEXT.gold },
      { text: 'Stand here to buy your next sword!', size: 26, gradient: TEXT.white },
    ],
    pxPerUnit: 125,
    maxWidth: 420,
  },
  fade: 110,
})

/** The big eggs' title colours. */
const BIG_EGG_TEXT = { volcano: TEXT.red, beach: TEXT.lava }

export function eggLabels(profile) {
  return EGG_STANDS.map((stand) => {
    const egg = EGGS[stand.eggId]
    // A world's own egg, seen from another world: where to go for it.
    const elsewhere = egg.world !== undefined && (profile?.world || 0) !== egg.world
    const lines = stand.big
      ? [
          { text: `${egg.name} Egg`, size: 54, gradient: BIG_EGG_TEXT[stand.eggId] || TEXT.red },
          elsewhere
            ? { text: `${WORLDS[egg.world].name.toUpperCase()} ONLY`, size: 44, icon: 'portal', gradient: TEXT.lava }
            : { text: `${formatNumber(egg.cost.wins)} Wins`, size: 46, icon: 'trophy', gradient: TEXT.gold },
        ]
      : [
          { text: `${egg.name} Egg`, size: 50, fill: '#ffffff' },
          { text: `${formatNumber(egg.cost.wins)} Wins`, size: 44, icon: 'trophy', gradient: TEXT.gold },
        ]
    return {
      id: `egg-${stand.eggId}`,
      position: [stand.x, eggHeight(stand) + (stand.big ? 4 : 2.5), stand.z],
      spec: { lines, pxPerUnit: 62 },
      fade: 100,
    }
  })
}

/** The limited Sphinx showcase: price, hype, and live stock. */
export function sphinxLabelSpec(stock) {
  const mult = PETS.sphinx.mult
  return {
    lines: [
      { text: `${formatNumber(SHOP.sphinx.price)} Wins`, size: 46, icon: 'trophy', gradient: TEXT.gold },
      { text: 'BEST IN GAME', size: 56, gradient: TEXT.red },
      { text: 'Sphinx', size: 76, fill: '#ffffff' },
      { text: `${formatNumber(mult * 100 - 100)}% BETTER`, size: 54, rainbow: true },
      { text: `${formatNumber(stock)} Left`, size: 50, gradient: TEXT.green },
    ],
    pxPerUnit: 48,
  }
}

export function sphinxLabel(stock) {
  return {
    id: 'sphinx',
    position: [SPHINX_STAND.x, 11.5, SPHINX_STAND.z],
    spec: sphinxLabelSpec(stock),
    reserve: sphinxLabelSpec(88888),
    fade: 140,
  }
}

/** The great banner board on the south hills: the game's name. */
const scoreboardLabel = () => ({
  id: 'scoreboard',
  position: [SCOREBOARD.x, SCOREBOARD.y + 0.8 + SCOREBOARD.height / 2, SCOREBOARD.z - 1.5],
  spec: {
    lines: [
      { text: 'SWORD TOSS LEGENDS', size: 100, gradient: TEXT.gold },
      { text: 'TRAIN - THROW - REBIRTH', size: 44, gradient: TEXT.white },
    ],
    pxPerUnit: 34,
  },
  fade: 220,
})

const freeRewardLabel = () => ({
  id: 'free-reward',
  position: [FREE_REWARD.x, 4.6, FREE_REWARD.z],
  spec: { lines: [{ text: 'FREE REWARD', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 60 },
  fade: 90,
})

/**
 * Where the portal goes: Dragonfire Peaks (and what opens it - rebirths and Wins - until
 * it's open), or home. (Names from shared/balance.js WORLDS.)
 */
const portalLabel = (profile) => (portal) => {
  const home = profile.world === 1
  const open = profile.world2Unlocked
  const need = WORLD_PORTALS[portal.id]
  const lines = home
    ? [
        { text: WORLDS[0].name.toUpperCase(), size: 56, gradient: TEXT.green },
        { text: 'Back home', size: 42, gradient: TEXT.white },
      ]
    : [
        { text: WORLDS[1].name.toUpperCase(), size: 60, gradient: TEXT.lava },
        open
          ? { text: `x${WORLDS[1].wins} Wins!`, size: 46, icon: 'trophy', gradient: TEXT.gold }
          : { text: `${need.rebirths} Rebirths + ${formatNumber(need.wins)} Wins`, size: 40, icon: 'rebirth', gradient: TEXT.white },
      ]
  return {
    id: `portal-${portal.id}`,
    position: [portal.x, portal.radius * 2 + 2.8, portal.z],
    spec: { lines, pxPerUnit: 56 },
    // Big enough for either side of the portal.
    reserve: {
      lines: [
        { text: WORLDS[0].name.toUpperCase(), size: 60 },
        { text: `${need.rebirths} Rebirths + ${formatNumber(need.wins)} Wins`, size: 46, icon: 'rebirth' },
      ],
    },
    fade: 140,
  }
}

/**
 * On the throw stage's two flag towers, facing spawn: what the stage is for. Each hangs
 * just in front of its tower's south face and a little out past its far side, so it never
 * reaches over the stage - nor between a player on it and the road (the throw camera
 * looks north from behind and above you).
 */
const stageLabels = () =>
  STAGE_TOWERS.map((t, i) => {
    const out = t.x > (THROW_STAGE.minX + THROW_STAGE.maxX) / 2 ? 1 : -1
    return {
      id: `stage-${i}`,
      position: [t.x + out * 1.2, 10.6, t.z + 1.6],
      spec: {
        lines: [
          { text: 'THROW STAGE', size: 56, gradient: TEXT.gold },
          { text: 'Stand anywhere on the stage -', size: 32, gradient: TEXT.white },
          { text: 'hold THROW, let go!', size: 32, gradient: TEXT.white },
        ],
        pxPerUnit: 66,
      },
      fade: 130,
    }
  })

/** Over the Enchant Altar: what it does. */
const enchantLabel = () => ({
  id: 'enchants',
  position: [BALL_SHOP.x + 3.6, 10.3, BALL_SHOP.z],
  spec: {
    lines: [
      { text: 'ENCHANTS', size: 62, gradient: ['#ffffff', '#e2c8ff', '#b07aff'] },
      { text: 'Power up your sword!', size: 42, gradient: TEXT.white },
    ],
    pxPerUnit: 52,
  },
  fade: 120,
})

/** Every label in the lobby. */
export function lobbyLabels(profile, { sphinxStock = 0 } = {}) {
  return [
    ...padLabels(profile),
    ...standLabels(profile),
    counterLabel(),
    ...eggLabels(profile),
    sphinxLabel(sphinxStock),
    scoreboardLabel(),
    freeRewardLabel(),
    ...stageLabels(),
    enchantLabel(),
    ...PORTALS.map(portalLabel(profile)),
  ]
}
