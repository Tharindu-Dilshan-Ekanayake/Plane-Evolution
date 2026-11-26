/**
 * Each stage theme's colours (each stage names one in its `theme`): the sky the sword flies
 * under (Lane.jsx blends the sky and fog to it as the sword gets there), the HUD's name
 * gradient, and the floor/gate tints the landing spray, the stage-start line, the lanterns'
 * glow and the gate arches' gems borrow.
 *
 * Most skies are a sunny game-day blue tinted at the horizon (DAY_TINTS); a few stages keep
 * a sky of their own - a red-black volcano glow, a neon
 * night, black starry space with the Earth's glow on the Moon, the aurora... `sky` is { top, horizon, sun,
 * glow, clouds, stars } (see Sky.jsx).
 */
/**
 * The sunny day sky most stages fly under (a few late ones keep a sky of their own:
 * volcano glow, neon night, the Moon, the aurora, space); `horizon` tints it per stage.
 */
const DAY_SKY = { top: '#2f80ea', horizon: '#c6e6ff', sun: '#ffffff', glow: 0.35, clouds: 0.85 }
const DAY_TINTS = {
  grassy: '#c6e6ff',
  autumn: '#d8ecff',
  desert: '#ffe9c4',
  beach: '#d6f2ff',
  jungle: '#cff0e0',
  frozen: '#e8f2ff',
  cherry: '#ffe2f0',
  candy: '#ffe4f6',
  mushroom: '#eadcff',
  swamp: '#d8f0d0',
  crystal: '#e0e4ff',
  ocean: '#c8f0ff',
  sky: '#dff2ff',
  rainbow: '#f4e8ff',
}

export const ZONE_THEMES = {
  grassy: {
    floor: '#3ad456',
    gate: '#ffc21a',
    sky: { top: '#1d4fb6', horizon: '#ffb98c', sun: '#fff0c4', glow: 0.9, clouds: 0.55 },
    name: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  },
  autumn: {
    floor: '#5cc544',
    gate: '#ff7a1e',
    sky: { top: '#2a7fe8', horizon: '#d4ecff', sun: '#ffffff', glow: 0.35, clouds: 0.75 },
    name: ['#ffe2b0', '#ffa646', '#e8620c'],
  },
  desert: {
    floor: '#e8c46e',
    gate: '#ffb12a',
    sky: { top: '#3a63c4', horizon: '#ffae58', sun: '#ffe2a0', glow: 1.0, clouds: 0.1 },
    name: ['#fffaa8', '#ffd52a', '#ff9c00'],
  },
  beach: {
    floor: '#f6e3a6',
    gate: '#2fc6ff',
    sky: { top: '#5547c4', horizon: '#ff98b6', sun: '#ffd4a8', glow: 0.95, clouds: 0.6 },
    name: ['#e0fbff', '#5fe0ff', '#1a9cf0'],
  },
  frozen: {
    floor: '#e6f4ff',
    gate: '#5cc8ff',
    sky: { top: '#43609e', horizon: '#e4ebff', sun: '#ffe6ef', glow: 0.55, clouds: 0.45 },
    name: ['#ffffff', '#c9f1ff', '#5cc8ff'],
  },
  jungle: {
    floor: '#3fae4a',
    gate: '#3fd16a',
    sky: { top: '#1c6f80', horizon: '#c6eeb8', sun: '#fff6c0', glow: 0.5, clouds: 0.7 },
    name: ['#e6ffd0', '#7dff7a', '#1fa83a'],
  },
  cherry: {
    floor: '#5fe068',
    gate: '#ff7ab8',
    sky: { top: '#33247e', horizon: '#ff9db0', sun: '#ffc6d4', glow: 0.75, clouds: 0.5 },
    name: ['#fff0f8', '#ffa8d4', '#ff4f9a'],
  },
  candy: {
    floor: '#ffc2e2',
    gate: '#ff5fb8',
    sky: { top: '#5f50dc', horizon: '#ffd2ee', sun: '#ffffff', glow: 0.6, clouds: 0.7 },
    name: ['#ffe6f6', '#ff9cd6', '#ff3fa8'],
  },
  mushroom: {
    floor: '#4cca6e',
    gate: '#c46bff',
    sky: { top: '#2a2470', horizon: '#d6a2ff', sun: '#ffe0ff', glow: 0.6, clouds: 0.4 },
    name: ['#f4e6ff', '#d29bff', '#9a3be8'],
  },
  volcano: {
    floor: '#4a2a24',
    gate: '#ff4a1c',
    sky: { top: '#16080c', horizon: '#ff5a2a', sun: '#ff7a3a', glow: 1.0, clouds: 0.35 },
    name: ['#ffd0b0', '#ff7a3c', '#e2240c'],
  },
  swamp: {
    floor: '#58ae46',
    gate: '#8ae04a',
    sky: { top: '#1c3838', horizon: '#b6d690', sun: '#f0ffb0', glow: 0.5, clouds: 0.6 },
    name: ['#f0ffd8', '#b8f05a', '#5ab82a'],
  },
  crystal: {
    floor: '#5cd89a',
    gate: '#c08bff',
    sky: { top: '#120a36', horizon: '#9a7aff', sun: '#e2d2ff', glow: 0.6, clouds: 0.2, stars: 0.4 },
    name: ['#f2e6ff', '#c69bff', '#8a3ee8'],
  },
  ocean: {
    floor: '#4cd8b0',
    gate: '#ff7a8a',
    sky: { top: '#0e3c8c', horizon: '#80deff', sun: '#fff4d0', glow: 0.6, clouds: 0.5 },
    name: ['#e0fbff', '#7fe8ff', '#1a9cd8'],
  },
  neon: {
    floor: '#27b068',
    gate: '#ff3bd8',
    sky: { top: '#05051a', horizon: '#6a2480', sun: '#ff5fd2', glow: 0.6, clouds: 0, stars: 0.5 },
    name: ['#e6fff0', '#39ff88', '#1ab85a'],
  },
  sky: {
    floor: '#62e27c',
    gate: '#ffd84a',
    sky: { top: '#1f6ae0', horizon: '#ffe4b6', sun: '#ffffff', glow: 0.5, clouds: 0.85 },
    name: ['#ffffff', '#ffe98a', '#ffb21e'],
  },
  rainbow: {
    floor: '#52e49c',
    gate: '#ffd84a',
    sky: { top: '#5878ff', horizon: '#ffe0a0', sun: '#ffffff', glow: 0.7, clouds: 0.6 },
    name: ['#ffffff', '#ffb8f0', '#ff5fd2'],
  },
  moon: {
    floor: '#9aa0b0',
    gate: '#5fc8ff',
    sky: { top: '#000006', horizon: '#18284a', sun: '#7fb8ff', glow: 0.8, clouds: 0, stars: 1 },
    name: ['#ffffff', '#cfd8ea', '#7f8aa8'],
  },
  aurora: {
    floor: '#72e6b2',
    gate: '#5fffc8',
    sky: { top: '#061a2a', horizon: '#2fc6a0', sun: '#a2ffe0', glow: 0.5, clouds: 0.3, stars: 0.6 },
    name: ['#e0fff4', '#7fffd0', '#2fc89a'],
  },
  space: {
    floor: '#349c8a',
    gate: '#8a63ff',
    sky: { top: '#03040f', horizon: '#24305a', sun: '#ffffff', glow: 0.25, clouds: 0, stars: 0.9 },
    name: ['#e6e0ff', '#a98bff', '#6a4cff'],
  },
  cosmic: {
    floor: '#8a46ae',
    gate: '#ff5bd8',
    sky: { top: '#0a0018', horizon: '#5a1a6a', sun: '#ff9cf0', glow: 0.6, clouds: 0, stars: 0.9 },
    name: ['#ffe6fb', '#ff9cf0', '#d43bc8'],
  },
}

/**
 * How each stage theme dresses the valley road (Lane.jsx):
 *   road / roadStyle   the cobbles of the royal road, two shades (alternate 5 m rows), in
 *                      a materials STYLE name (STUDS cobbles, CHECKER slabs, ROAD asphalt,
 *                      RAINBOW, GALAXY...)
 *   kerb / kerbStyle   the kerb stones along both edges (GLOW for glowing kerbs; SMOOTH
 *                      when left out)
 *   stone              the stone the gate arches, obelisks and lantern bases are built of
 *                      [main, trim]
 *   flowers            the two colours of the flower beds beside the road
 *   turf               the ground either side of the road out to the hills, light and dark
 *                      (Impact.jsx borrows them for the clods a landing throws up)
 *   field / style      the ground beyond (materials STYLE name)
 *   colors             kept from the template (unused by the road)
 *   hill               the ridges down both sides (World 1): their look (`style`), their
 *                      rock in two shades (`dirt`) and what grows on them (`decor`, in
 *                      `leaves` on a `trunk`) - the same decor, smaller, grows by the road.
 * In Dragonfire Peaks (the lava venue) Lane.jsx darkens all of it towards basalt, turns
 * the kerbs into glowing lava channels in the stage's gate colour and swaps the lanterns
 * for braziers.
 */
// Most stages: the sunny day sky, tinted at the horizon.
for (const [id, horizon] of Object.entries(DAY_TINTS)) {
  if (ZONE_THEMES[id]) ZONE_THEMES[id].sky = { ...DAY_SKY, horizon }
}

export const STAGE_LOOKS = {
  grassy: {
    road: ['#b9ada0', '#ada194'], roadStyle: 'STUDS', kerb: ['#ece2d0', '#dacebb'], stone: ['#cac3b7', '#8f877c'], flowers: ['#ff6fa8', '#ffe24a'],
    field: '#3aa834', style: 'STUDS', turf: ['#3cbf3c', '#46cc44'], colors: ['#5a6787', '#776c8c', '#ffd27a'],
    hill: { style: 'HILL', dirt: ['#8d6036', '#7d5530'], decor: 'tree', leaves: '#3fb84a', trunk: '#7a4f2a' },
  },
  autumn: {
    road: ['#b49c84', '#a89078'], roadStyle: 'STUDS', kerb: ['#ecdac0', '#dac6a8'], stone: ['#c8b496', '#8a7458'], flowers: ['#ffb12a', '#e8452c'],
    field: '#7a8a3a', style: 'STUDS', turf: ['#9cb83e', '#a6c246'], colors: ['#6f7f9f', '#8a8fa8', '#ffe8b0'],
    hill: { style: 'HILL', dirt: ['#a0602a', '#8a5426'], decor: 'tree', leaves: '#ff8a1e', trunk: '#6a4020' },
  },
  desert: {
    road: ['#e8c88e', '#dcbb80'], roadStyle: 'CHECKER', kerb: ['#f6e2b4', '#e8d29e'], stone: ['#e8b878', '#b07e48'], flowers: ['#ff5a8a', '#ffd21f'],
    field: '#d8b06a', style: 'STUDS', turf: ['#dcb46a', '#e4be74'], colors: ['#c08a5a', '#a8784e', '#ffe0a0'],
    hill: { style: 'MESA', dirt: ['#e8a868', '#d89458'], decor: 'cactus', leaves: '#3f9a3a', trunk: '#3f9a3a' },
  },
  beach: {
    road: ['#f2e2bc', '#e8d6aa'], roadStyle: 'CHECKER', kerb: ['#ffffff', '#e8f4ff'], stone: ['#fff4dc', '#d8c49a'], flowers: ['#ff7ab8', '#ffb12a'],
    field: '#2fa8d8', style: 'WATER', turf: ['#f0d9a0', '#f6e2ae'], colors: ['#8a6aa8', '#c47a9a', '#ffd0e0'],
    hill: { style: 'MESA', dirt: ['#f0d9a0', '#e6c88a'], decor: 'palm', leaves: '#2fae4a', trunk: '#9a6a3a' },
  },
  jungle: {
    road: ['#8e8e72', '#828266'], roadStyle: 'STUDS', kerb: ['#a2b088', '#92a078'], stone: ['#9aa48a', '#5f6a4f'], flowers: ['#ff4fa0', '#ffd21f'],
    field: '#2f6a2a', style: 'STUDS', turf: ['#1f9a3a', '#25a642'], colors: ['#3f6a6f', '#557a6a', '#e6ffb0'],
    hill: { style: 'HILL', dirt: ['#5a4a2a', '#4a3c22'], decor: 'palm', leaves: '#1f8a2a', trunk: '#6a4a2a' },
  },
  frozen: {
    road: ['#cfe2f4', '#c2d8ee'], roadStyle: 'STUDS', kerb: ['#ffffff', '#e6f2ff'], stone: ['#dcecff', '#8fb0d8'], flowers: ['#7fd2ff', '#ffffff'],
    field: '#eef6ff', style: 'STUDS', turf: ['#eaf4ff', '#dcecfa'], colors: ['#8a9ac0', '#a8b4d0', '#fff0f6'],
    hill: { style: 'MESA', dirt: ['#a8c4e6', '#94b4dc'], decor: 'pine', leaves: '#2f7a5a', trunk: '#5a4030' },
  },
  cherry: {
    road: ['#dcc8c4', '#d0bab6'], roadStyle: 'STUDS', kerb: ['#fff0f4', '#f4dce4'], stone: ['#ecdcd8', '#a48a88'], flowers: ['#ff9cc8', '#ffffff'],
    field: '#5aa060', style: 'STUDS', turf: ['#6fd068', '#78da70'], colors: ['#5a4a8a', '#7a5a9a', '#ffc0d8'],
    hill: { style: 'HILL', dirt: ['#9a6a5a', '#8a5a4a'], decor: 'tree', leaves: '#ff9cc8', trunk: '#5a3a3a' },
  },
  candy: {
    road: ['#ffe0f0', '#ffd0e8'], roadStyle: 'CHECKER', kerb: ['#ffffff', '#ff9cd6'], stone: ['#ffb8dc', '#c86aa8'], flowers: ['#5fd6ff', '#ffe45c'],
    field: '#f0c0e0', style: 'STUDS', turf: ['#ffb8dc', '#ffc4e2'], colors: ['#a07ac8', '#d08ab8', '#ffffff'],
    hill: { style: 'MESA', dirt: ['#ff9cc8', '#c8a0ff'], decor: 'lollipop', leaves: '#ff5fa8', trunk: '#ffffff' },
  },
  mushroom: {
    road: ['#a898c0', '#9c8cb4'], roadStyle: 'STUDS', kerb: ['#e8dcff', '#d6c8f2'], stone: ['#b8a8d8', '#6a5a8a'], flowers: ['#ff5fd2', '#7fffd0'],
    field: '#3c5a46', style: 'STUDS', turf: ['#3fb8a0', '#46c2a8'], colors: ['#4a3a8a', '#6a4a9a', '#ffd0ff'],
    hill: { style: 'HILL', dirt: ['#6a4a8a', '#5a3a7a'], decor: 'mushroom', leaves: '#ff3b5a', trunk: '#fff4e0' },
  },
  volcano: {
    road: ['#3e3232', '#362b2b'], roadStyle: 'STUDS', kerb: ['#ff5a14', '#ff6a1e'], kerbStyle: 'LAVA', stone: ['#4a3a3a', '#2a1e20'], flowers: ['#ff6a1e', '#ffb21a'],
    field: '#ff5a14', style: 'LAVA', turf: ['#4a3a36', '#51403b'], colors: ['#2a1a1e', '#3a2026', '#ff7a3a'],
    hill: { style: 'LAVA', dirt: ['#ff5a14', '#ff6a1e'], decor: 'spike', leaves: '#ff6a1e', trunk: '#1a1220' },
  },
  swamp: {
    road: ['#7e7e5e', '#727254'], roadStyle: 'STUDS', kerb: ['#8e8e6a', '#7e7e5c'], stone: ['#7f8a6a', '#4a5240'], flowers: ['#c8ff5a', '#ffe45c'],
    field: '#3a5a46', style: 'WATER', turf: ['#5a8a3a', '#619240'], colors: ['#3a5048', '#4a5f4f', '#f0ffb0'],
    hill: { style: 'HILL', dirt: ['#4a5a3a', '#3a4a2e'], decor: 'tree', leaves: '#6a8a2a', trunk: '#3a3020' },
  },
  crystal: {
    road: ['#8a7ad8', '#7f6ecc'], roadStyle: 'STUDS', kerb: ['#c8b8ff', '#a8e8ff'], kerbStyle: 'GLOW', stone: ['#b8a8ff', '#5a3ae0'], flowers: ['#7fe8ff', '#ff9cf0'],
    field: '#2a2450', style: 'STUDS', turf: ['#9a8ae8', '#a292ee'], colors: ['#2a2460', '#3a2c78', '#c8b0ff'],
    hill: { style: 'PLATE', dirt: ['#5a3ae0', '#4a2cc8'], decor: 'crystal', leaves: '#c08bff', trunk: '#7fe8ff' },
  },
  ocean: {
    road: ['#ece0c4', '#e0d4b6'], roadStyle: 'STUDS', kerb: ['#ffffff', '#bff4ff'], stone: ['#e0f4ff', '#5fa8d0'], flowers: ['#ff7a8a', '#ffd21f'],
    field: '#2fa0c8', style: 'WATER', turf: ['#3fc6c0', '#46d0c8'], colors: ['#2a5a8a', '#3a6f9a', '#e0fbff'],
    hill: { style: 'WATER', dirt: ['#2f8fd0', '#1f7ac0'], decor: 'coral', leaves: '#ff7a8a', trunk: '#ffb36a' },
  },
  neon: {
    road: ['#262a52', '#202448'], roadStyle: 'ROAD', kerb: ['#39ff88', '#ff3bd8'], kerbStyle: 'GLOW', stone: ['#2e3260', '#16183e'], flowers: ['#ff3bd8', '#39ff88'],
    field: '#1d2246', style: 'ROAD', turf: ['#123a26', '#16442d'], colors: ['#14163a', '#1f1a4a', '#ff3bd8'],
    hill: { style: 'WINDOWS', dirt: ['#1a1c3a', '#22244a'], decor: 'neon', leaves: '#ff3bd8', trunk: '#3a3f5a' },
  },
  sky: {
    road: ['#ffffff', '#eef6ff'], roadStyle: 'STUDS', kerb: ['#ffe98a', '#ffd84a'], stone: ['#ffffff', '#c8dcf4'], flowers: ['#ffd84a', '#ff9cd6'],
    field: '#cfe8ff', style: 'STUDS', turf: ['#7fdc8c', '#88e494'], colors: ['#7a8ab0', '#9aa4c0', '#ffffff'],
    hill: { style: 'MESA', dirt: ['#e8f4ff', '#d8ecff'], decor: 'cloud', leaves: '#ffffff', trunk: '#ffffff' },
  },
  rainbow: {
    road: ['#ffffff', '#f6f2ff'], roadStyle: 'RAINBOW', kerb: ['#ffffff', '#ffe0f6'], stone: ['#ffffff', '#d8c8ff'], flowers: ['#ff5fd2', '#5fd6ff'],
    field: '#a8d8a0', style: 'STUDS', turf: ['#7fe0b0', '#88e8b8'], colors: ['#7a7ac8', '#a08ac8', '#fff2a0'],
    hill: { style: 'RAINBOW', dirt: ['#ffffff', '#ffffff'], decor: 'lollipop', leaves: '#ffd21f', trunk: '#ffffff' },
  },
  moon: {
    road: ['#a8acb8', '#9ca0ac'], roadStyle: 'STUDS', kerb: ['#d0d4de', '#c0c4ce'], stone: ['#b8bcc8', '#6a6f7c'], flowers: ['#7fb8ff', '#ffffff'],
    field: '#8a8f9c', style: 'STUDS', turf: ['#8a90a0', '#9298a8'], colors: ['#3a3f50', '#4a4f60', '#7fb8ff'],
    hill: { style: 'STUDS', dirt: ['#8a8f9c', '#7a7f8c'], decor: 'rock', leaves: '#6a6f7c', trunk: '#5a5f6c' },
  },
  aurora: {
    road: ['#5a7a8a', '#50707f'], roadStyle: 'STUDS', kerb: ['#7fffd0', '#5fe8b8'], kerbStyle: 'GLOW', stone: ['#6a8a9a', '#2a4a5a'], flowers: ['#7fffd0', '#c69bff'],
    field: '#20384a', style: 'STUDS', turf: ['#3fd4a0', '#48dcaa'], colors: ['#163040', '#1f4050', '#7fffd0'],
    hill: { style: 'MESA', dirt: ['#2a4a5a', '#203a4a'], decor: 'pine', leaves: '#1f6a5a', trunk: '#3a3030' },
  },
  space: {
    road: ['#2a3260', '#242c58'], roadStyle: 'GALAXY', kerb: ['#8a63ff', '#5fd6ff'], kerbStyle: 'GLOW', stone: ['#3a3f70', '#141a40'], flowers: ['#5fd6ff', '#ffffff'],
    field: '#141a40', style: 'GALAXY', turf: ['#1a2450', '#1f2a5a'], colors: ['#10142e', '#181c3e', '#ffffff'],
    hill: { style: 'GALAXY', dirt: ['#141a40', '#1a2050'], decor: 'crystal', leaves: '#5fd6ff', trunk: '#8a63ff' },
  },
  cosmic: {
    road: ['#4a2a7a', '#40246e'], roadStyle: 'GALAXY', kerb: ['#ff5bd8', '#ffd24a'], kerbStyle: 'GLOW', stone: ['#5a3a8a', '#26103e'], flowers: ['#ff9cf0', '#ffd24a'],
    field: '#2a1450', style: 'GALAXY', turf: ['#5a2a8a', '#623092'], colors: ['#1a0a30', '#26103e', '#ff9cf0'],
    hill: { style: 'GALAXY', dirt: ['#2a1450', '#3a1a64'], decor: 'crystal', leaves: '#ff5bd8', trunk: '#ffd24a' },
  },
}

/**
 * The road's rows, LANE_STRIPE metres each, alternating a shade lighter and darker
 * (Lane.jsx), and the turf beside them in the same rows.
 */
export const LANE_STRIPE = 5
export const LANE_RAINBOW = ['#2fbf47', '#3ad456']
