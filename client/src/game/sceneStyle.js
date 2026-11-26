/**
 * The scene's whole look in one place: Sunblade Academy - a sword school's courtyard on a
 * bright fantasy day: a clear blue sky with puffy white clouds and a high sun, pale stone
 * flagstones and cobbled paths through lush lawns and flower beds, toy-castle walls with
 * blue roofs and gold-trimmed heraldic banners (an original crossed-swords crest) all
 * round, and green hills with trees beyond (hills.js), the long valley road running off
 * between them (Lane.jsx). World 2, Dragonfire Peaks, has a venue of its own (VENUES[1]).
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The cool sky fill plus the warm
 * sun add up to just over that on the ground, which keeps the lawn vivid; shadowed ground
 * only gets the cool fill, so shadows read blue and the lit side warm.
 */

/** Style ids from materials.js STYLE (numbers here so this file stays import-free). */
const STYLE_HILL = 14

/**
 * The academy's heraldic colours: royal blue and gold, with white and a red accent.
 * (Keys kept from the template: everything that reads TEAM still finds them.)
 */
export const TEAM = {
  blue: '#2350c8',
  navy: '#14234a',
  red: '#c8233a',
  white: '#f4f7fb',
  gold: '#ffc21a',
}

export const SKY = {
  /** Straight up: a deep summer blue. */
  top: '#2a74e0',
  /** At eye level: pale haze. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#d2ecff',
  /** Lower = the deep colour reaches further down towards the horizon. */
  exponent: 0.6,
  /** The sun's glow round its direction, and how strong it is. */
  sun: '#fffaf0',
  glow: 0.5,
  /** High clouds (0 none, 1 plenty), and stars (night stages only). */
  clouds: 0.85,
  stars: 0,
}

export const FOG = {
  color: SKY.horizon,
}

/** Every surface colour in the lobby. */
export const PALETTE = {
  /** The sword shop's yard: pale marble flagstones. */
  shopFloor: '#e4dfd3',
  /** Rings painted round the portal. */
  apron: TEAM.navy,
  apronEdge: TEAM.gold,
  /** Pale castle stone, a shade darker every third course (Lane.jsx reads these too). */
  concrete: ['#c9ccd4', '#c9ccd4', '#b4b9c4'],
  seats: [TEAM.blue, TEAM.red, TEAM.white],
  standBase: '#8c93a1',
  rail: '#ffffff',
  /** Lawn, light and dark: the lobby lawn and the valley's verges. */
  turf: ['#46bd3c', '#52c947'],
  /** Banners and pennants: the academy's blue and gold, a red one now and then. */
  crowd: [TEAM.blue, '#ffffff', TEAM.gold, '#3a6ee8', TEAM.red, '#ffe27a', '#e8eef8', TEAM.navy],
  /** Flags along the walls. */
  flags: [TEAM.blue, TEAM.gold, TEAM.red],
  /** Far-off castle towers and villages: hazy blue-grey. */
  city: ['#7a86a6', '#8a8fae', '#6f7a9a', '#978cac', '#7d92b0'],
  /** Old cobbles. */
  asphalt: '#6b6f78',
  /** Castle stone courses, light to dark. */
  stone: ['#c9ccd4', '#bcc0ca', '#b0b5c0'],
  /** Wood: beams, fences, platforms. */
  wood: '#9a6436',
}

/**
 * Each world's venue: the colours everything built for it uses, and whether it's the lava
 * world. World 1 is Sunblade Academy (pale stone, royal blue and gold, green hills and
 * trees round it); World 2 is Dragonfire Peaks (basalt, ash and glowing orange: the
 * academy's fortress on a volcano by a sea of lava, Ocean.jsx). The lobby (World.jsx) and
 * the valley (Lane.jsx) are built from the one for the world you're in, and rebuilt when
 * you step through the portal.
 *
 *   ground   the lobby floor's paint (ground.js): lawn, flagstones, cobbles, sand, beds...
 *   castle   the walls, towers, banners and braziers round the courtyard (terrain.js)
 *   hills    the ridges round the lobby: rock by terrace (low to high), their cap style,
 *            the cap colour (materials GRASS_COLOR), glowing lava columns, what grows on them
 *   field    the valley's own extras (Lane.jsx): its edging, lamps
 *
 * The template's stadium fields (concrete, vip, glass, crowd, wall...) are kept: other
 * modules still read them.
 */
export const VENUES = [
  {
    lava: false,
    primary: TEAM.blue,
    dark: '#14234a',
    light: TEAM.white,
    accent: TEAM.gold,
    concrete: PALETTE.concrete,
    wall: '#c4c9d2',
    vip: '#d5dae1',
    glass: '#1c2b46',
    crowd: PALETTE.crowd,
    flags: PALETTE.flags,
    surround: '#3fb23f',
    strip: PALETTE.turf,
    shopFloor: PALETTE.shopFloor,
    ground: {
      grass: ['#46bd3c', '#4fc645'],
      /** Flagstones: three shades, and the grout between them. */
      flag: ['#d9d3c5', '#cdc6b6', '#e3ddd0'],
      grout: '#9a9282',
      /** Cobbles on the paths. */
      path: ['#c7bfae', '#b7ae9c'],
      /** Path and bed edging. */
      edge: '#7f786b',
      /** The training yard's sand. */
      sand: ['#e8cd96', '#dcc086'],
      /** The THROW ZONE's runway slabs, and the gold lane lines on them. */
      runway: ['#a9b0c0', '#9aa2b4'],
      chalk: '#ffd84a',
      /** Flower beds: soil and blooms. */
      soil: '#6b4a2c',
      flowers: ['#ff5f8a', '#ffd21f', '#b77bff', '#ffffff', '#ff8a3a', '#5fd6ff'],
      ring: TEAM.gold,
      portal: '#7a4cff',
      rune: '#8a5cff',
      yard: PALETTE.shopFloor,
      // Template names, still read by older code.
      dirt: '#c9a46a',
      dirtDark: '#b88f58',
      infield: ['#a9b0c0', '#9aa2b4'],
      cages: '#e8cd96',
      cracks: null,
    },
    logo: { rim: TEAM.gold, ring: TEAM.blue, inner: '#14234a', top: 'SWORD TOSS', bottom: 'LEGENDS' },
    castle: {
      stone: ['#cfd2d9', '#c2c6cf', '#b5bac4'],
      dark: '#8a909e',
      cap: '#dde0e6',
      roof: '#2f58cc',
      roofAlt: '#c8233a',
      banner: TEAM.blue,
      bannerAlt: TEAM.red,
      trim: TEAM.gold,
      emblem: '#ffe066',
      blade: '#eef2f8',
      flame: '#ffb347',
      core: '#fff1b0',
      glow: '#fff1b0',
      wood: '#9a6436',
      window: '#2a3a5a',
    },
    hills: { rock: ['#9a6a3a', '#8d6036', '#805632', '#734d2d', '#664428'], cap: STYLE_HILL, grass: '#4fc93a', lava: null, trees: 'tree' },
    field: { wall: '#8a909e', cap: TEAM.gold, track: '#b7ae9c', lights: '#fff1b0' },
    /** The great banner board's face (on the south hills). */
    board: '#14234a',
    endNorth: 'THROW FAR!',
    /** The THROW ZONE's arch: stone towers, the beam, its glow and the crest. */
    arch: { pillar: '#c2c6cf', base: '#8a909e', glow: '#fff1b0', crest: TEAM.gold, beam: TEAM.blue },
    /** The sword shop's stages and sign. */
    shop: { band: TEAM.blue, strip: '#ffe27a', post: '#b5bac4', panel: '#14234a', top: '#e4dfd3' },
    /** The Enchant Altar: its stone, the runes' glow, the crystal and the sign board. */
    stall: { awning: [TEAM.blue, '#ffffff'], wood: '#9a6436', counter: '#14234a', trim: TEAM.gold },
    altar: { stone: '#9aa0b0', dark: '#6a7086', rune: '#a77bff', crystal: '#c9a0ff', core: '#ffffff', board: '#1f1640', trim: '#ffc21a' },
  },
  {
    lava: true,
    primary: '#ff5a14',
    dark: '#2a1214',
    light: '#ffd9a8',
    accent: '#ffb21a',
    concrete: ['#4a3a3a', '#4a3a3a', '#3d3030'],
    wall: '#3a2c2c',
    vip: '#4a3838',
    glass: '#1a0c0c',
    crowd: ['#ff5a14', '#ffd21f', '#2a1214', '#ff8a3a', '#ffffff', '#c8102e', '#ffb21a', '#5a3a3a'],
    flags: ['#ff5a14', '#2a1214', '#ffb21a'],
    surround: '#2c2426',
    strip: ['#3a3034', '#332a2e'],
    shopFloor: '#3a3034',
    ground: {
      grass: ['#4a3d40', '#433639'],
      flag: ['#3d3236', '#362c30', '#43383c'],
      grout: '#1c1517',
      path: ['#2c2326', '#262022'],
      edge: '#ff6a1e',
      sand: ['#5a3024', '#4e291f'],
      runway: ['#3a3034', '#332a2e'],
      chalk: '#ffb21a',
      soil: '#1e1517',
      flowers: ['#ff5a14', '#ffb21a', '#ff3b0a', '#ffd27a'],
      ring: '#ff8a1e',
      portal: '#ff3b0a',
      rune: '#ff6a1e',
      yard: '#2e2629',
      dirt: '#7a3620',
      dirtDark: '#64291a',
      infield: ['#3a3033', '#342b2e'],
      cages: '#4e291f',
      cracks: '#ff5a14',
    },
    logo: { rim: '#ffb21a', ring: '#2a1214', inner: '#ff5a14', top: 'DRAGONFIRE', bottom: 'PEAKS' },
    castle: {
      stone: ['#45373b', '#3e3034', '#372a2e'],
      dark: '#241c1f',
      cap: '#4e4044',
      roof: '#2a1214',
      roofAlt: '#ff5a14',
      banner: '#2a1214',
      bannerAlt: '#8a1a0c',
      trim: '#ff8a1e',
      emblem: '#ffb21a',
      blade: '#ffd9a8',
      flame: '#ff6a1e',
      core: '#ffd27a',
      glow: '#ffd27a',
      wood: '#3a2626',
      window: '#ff6a1e',
    },
    hills: {
      rock: ['#3e3034', '#372a2e', '#302528', '#2a2023', '#241c1f'],
      cap: STYLE_HILL,
      grass: '#4a3c3c',
      lava: { color: '#ff5a14', chance: 0.14 },
      trees: 'lava',
    },
    field: { wall: '#2a1c1c', cap: '#ff6a1e', track: '#4a2a22', lights: '#ffb06a' },
    board: '#1a0a0a',
    endNorth: 'DRAGONFIRE',
    arch: { pillar: '#4a3a3e', base: '#2a1214', glow: '#ffd27a', crest: '#ff8a1e', beam: '#2a1214' },
    shop: { band: '#ff5a14', strip: '#ffd27a', post: '#3e3034', panel: '#2a1214', top: '#3a3034' },
    stall: { awning: ['#ff5a14', '#2a1214'], wood: '#4a3030', counter: '#2a1214', trim: '#ffb21a' },
    altar: { stone: '#3e3034', dark: '#241c1f', rune: '#ff6a1e', crystal: '#ff8a3a', core: '#ffe2a0', board: '#1a0a0a', trim: '#ffb21a' },
  },
]
export const venueOf = (world) => VENUES[world] ?? VENUES[0]

export const LIGHTS = {
  /** A cool blue fill from the sky, a green bounce off the lawn. */
  hemiSky: '#d6e8ff',
  hemiGround: '#b0d898',
  hemiIntensity: 2.0,

  /** A bright, high midday sun. */
  sunColor: '#fff6e6',
  sunIntensity: 1.9,
  /**
   * Direction *towards* the sun: high in the north-west, beyond the far end of the valley
   * (the sky's glow sits there too), so shadows fall short and back towards you.
   */
  sunDirection: [-0.4, 0.78, -0.48],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.6,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}

/**
 * Each world's light (Lighting.jsx): Sunblade Academy's bright day, and Dragonfire Peaks' -
 * a red-orange glow from below off the lava and a hot, low dusk sun.
 */
export const WORLD_LIGHTS = [
  LIGHTS,
  { ...LIGHTS, hemiSky: '#ffb08a', hemiGround: '#7a2a14', hemiIntensity: 1.95, sunColor: '#ffbc80', sunIntensity: 1.7 },
]
export const lightsOf = (world) => WORLD_LIGHTS[world] ?? LIGHTS
