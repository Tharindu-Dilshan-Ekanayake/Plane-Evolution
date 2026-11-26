/**
 * Lobby layout (Sword Toss Legends): every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a pad or the throw stage is.
 *
 * Units are metres (the avatar is 1.8 tall), in the lobby and down the road. +X is east,
 * -Z is north, which is "forward" from spawn and the way down the valley road.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

/**
 * The lobby is a sword-academy courtyard with an open middle: from the spawn at its south
 * end a clear avenue runs straight up to the THROW STAGE at the valley's mouth (one wide
 * raised stage - stand anywhere on it and throw your sword down the road), nothing in the
 * way. The eggs stand in two short rows either side of the avenue by the spawn. West, the
 * TRAINING CIRCLE: the dummies round an arc, each facing out. East, the SWORD WALL: every
 * sword hung in a grid on one great wall facing the courtyard, its name plate under it,
 * and the SWORD COUNTER at its foot. The leaderboards flank the spawn gate behind you.
 */
export const SPAWN = { x: 0, z: 54 }

/** The flat, walkable courtyard. Castle walls surround it on every side but the road. */
export const PLAZA = { minX: -44, maxX: 44, minZ: -40, maxZ: 66 }
/** The path from spawn round the monument to the stage (half its width). */
export const PATH_HALF = 5

// --- The road ----------------------------------------------------------------------

/**
 * The start of the road: the courtyard's north edge, the throw stage's front. Track metre
 * m is m metres along the road from here.
 */
export const TRACK_START_Z = PLAZA.minZ
/** How steeply the road drops away from the start: 0, dead level all the way. */
export const SLOPE_ANGLE = 0
/** Half the width of the valley floor the road runs down (the lobby's walls stop here). */
export const CANYON_HALF_WIDTH = 16

// --- The throw stage --------------------------------------------------------------------

/**
 * The THROW STAGE (the template's roll zone): a wide raised stage across the courtyard's
 * north edge, `height` up (low enough to step straight onto). Stand anywhere on it and
 * hold THROW: your sword flies from where you stand, down its own lane of the road
 * (throwLane), so a full lobby can throw side by side. Nothing stands over it or over the
 * road - just a flag tower either side of it (STAGE_TOWERS) - so the throw is never hidden.
 */
export const THROW_STAGE = { minX: -18, maxX: 18, minZ: -40, maxZ: -27, height: 0.9 }
/** How deep each of the stage's two front steps is (they run along its south edge, inside it). */
export const STAGE_STEP = 0.6
/** Throws go from here (the server checks you're on it). */
export const ROLL_ZONE = { minX: THROW_STAGE.minX, maxX: THROW_STAGE.maxX, minZ: THROW_STAGE.minZ, maxZ: THROW_STAGE.maxZ }
/** The stage's two flag towers, just off either end of it (signs on them, facing spawn). */
export const STAGE_TOWERS = [
  { x: THROW_STAGE.minX - 3.5, z: -33 },
  { x: THROW_STAGE.maxX + 3.5, z: -33 },
]
/** The stage's middle (the template's home plate: the throw camera's reference). */
export const HOME_PLATE = { x: 0, z: (THROW_STAGE.minZ + THROW_STAGE.maxZ) / 2 }
/** Facing north, down the valley (yaw 0 faces +Z, south; PI/2 faces +X; PI faces -Z). */
export const BATTER_YAW = Math.PI
/** A sword thrown from `x` on the stage flies down this line of the road (|x| <= 6.5). */
export const throwLane = (x) => Math.max(-6.5, Math.min(6.5, x * 0.4))
/** Where you're put back after a throw: you're never moved, so the stage's middle. */
export const ROLL_RETURN = { x: 0, z: -30 }

/** Walkable ground; the controller clamps the player into it. Nothing past the start. */
export const WALKABLE = [PLAZA]

// --- Training pads (the training circle) --------------------------------------------------

/**
 * The training circle on the west of the courtyard: nine round rune mats (the pads:
 * standing on one is training) round an arc about TRAINING_CENTER, south to north, each
 * better than the last. Out beyond each mat (away from the circle's middle) its training
 * dummy stands on a little platform (dummySpot), and behind the dummy the pad's
 * multiplier board (padBoard). Training, you stand at the pad's training spot
 * (cageBatterSpot) facing out (padYaw) and slash the dummy. (The names keep the
 * template's.)
 */
/** Seven dummies, then Dragonfire Peaks' two at the north end of the arc. */
export const PAD_COUNT = 9
/** Radius of a pad's top: standing within it is training. */
export const PAD_RADIUS = 2.7
/** The pads' tops, a step up from the courtyard. */
export const PAD_HEIGHT = 0.5
export const TRAINING_CENTER = { x: -10, z: 14 }
export const TRAINING_RADIUS = 24
/** Pad 0 (the free one) is the southernmost, nearest spawn; the rest run north round the arc. */
const PAD_ANGLE0 = (120 * Math.PI) / 180
const PAD_ANGLE_STEP = (15 * Math.PI) / 180
const padAngle = (index) => PAD_ANGLE0 + index * PAD_ANGLE_STEP

/** Out from the circle's middle through pad `index` (unit, on the ground): the way you face training there. */
export const padDir = (index) => ({ x: Math.cos(padAngle(index)), z: Math.sin(padAngle(index)) })
export const padCenterX = (index) => TRAINING_CENTER.x + TRAINING_RADIUS * Math.cos(padAngle(index))
export const padCenterZ = (index) => TRAINING_CENTER.z + TRAINING_RADIUS * Math.sin(padAngle(index))
/** Facing pad `index`'s dummy. (Yaw 0 faces +Z.) */
export const padYaw = (index) => {
  const d = padDir(index)
  return Math.atan2(d.x, d.z)
}

/** Every pad's padYaw, worked out once (frame code reads this: nothing made per frame). */
export const PAD_YAWS = Array.from({ length: PAD_COUNT }, (_, i) => padYaw(i))

/** How far out from a pad's middle its dummy stands, on a platform DUMMY_BASE tall. */
export const DUMMY_OUT = PAD_RADIUS + 0.6
export const DUMMY_BASE = 0.3
export const dummySpot = (index) => {
  const d = padDir(index)
  return { x: padCenterX(index) + d.x * DUMMY_OUT, y: DUMMY_BASE, z: padCenterZ(index) + d.z * DUMMY_OUT }
}
/** Where you stand to train on pad `index`: a little out from its middle, the dummy in reach in front. */
export const cageBatterSpot = (index) => {
  const d = padDir(index)
  return { x: padCenterX(index) + d.x * 0.9, z: padCenterZ(index) + d.z * 0.9 }
}
/** Pad `index`'s multiplier board: behind its dummy, facing back in at the pad (`yaw`). */
export const BOARD_OUT = PAD_RADIUS + 2.6
export const padBoard = (index) => {
  const d = padDir(index)
  return { x: padCenterX(index) + d.x * BOARD_OUT, z: padCenterZ(index) + d.z * BOARD_OUT, yaw: padYaw(index) + Math.PI }
}

/** The square round pad `index`: its raised deck (walkable, and a wall while locked). */
export function padRect(index) {
  const cx = padCenterX(index)
  const cz = padCenterZ(index)
  const r = PAD_RADIUS + 0.3
  return { minX: cx - r, maxX: cx + r, minZ: cz - r, maxZ: cz + r }
}

// --- Sword Wall and Sword Counter (the template's shop) -----------------------------------

/**
 * The SWORD WALL on the east of the courtyard: one great wall, its face to the courtyard
 * (west), with every sword hung on it in its own lit niche - SWORD_COLUMNS columns by
 * SWORD_TIERS tiers, the first twelve swords along the bottom tier, the next twelve in the
 * middle, the twelve Legend swords along the top - each tier read left to right as you face
 * it (north to south). Under each sword its name plate, flat on the wall: all on one face,
 * so no plate ever hides another, and they read from right across the courtyard. A SWORD
 * SHOP sign crowns it.
 *
 * Swords are bought strictly in order, so there's only ever one to buy: the SWORD COUNTER,
 * a low dais at the wall's foot, sells it - stand on it and the prompt offers your next
 * sword. (TIRE_STANDS keeps the template's name: it's the niches.)
 */
export const SWORD_COLUMNS = 12
export const SWORD_TIERS = 3
/** The wall's face (x, facing west) and its run north to south; it's `depth` thick, back against the castle wall. */
export const SWORD_WALL = { x: 40, minZ: -13, maxZ: 43, depth: 4 }
/** Metres between columns' middles along the wall. */
export const SWORD_COLUMN_PITCH = (SWORD_WALL.maxZ - SWORD_WALL.minZ) / SWORD_COLUMNS
/** The bottom tier's floor (its niches start this high), and each tier's height. */
export const SWORD_TIER_BASE = 0.8
export const SWORD_TIER_HEIGHT = 5.4
/** The wall's top: over the last tier, under its SWORD SHOP crown (SHOP_SIGN). */
export const SWORD_WALL_TOP = SWORD_TIER_BASE + SWORD_TIERS * SWORD_TIER_HEIGHT + 0.6
/** A name plate's middle, up from its tier's floor; a sword's middle, likewise (it hangs over its plate). */
export const PLATE_UP = 0.85
export const SWORD_UP = 3.35
/** How far out from the face the swords hang: clear of it as they turn. */
export const SWORD_OUT = 1.2
/** The wall's bounds on the ground (its solid footprint). */
export const SHOP = { minX: SWORD_WALL.x, maxX: SWORD_WALL.x + SWORD_WALL.depth, minZ: SWORD_WALL.minZ, maxZ: SWORD_WALL.maxZ }
/** The SWORD SHOP sign crowning the wall, facing the courtyard. */
export const SHOP_SIGN = { x: SWORD_WALL.x + 0.6, minZ: 3, maxZ: 27, top: SWORD_WALL_TOP + 5 }
/** Which way the sign (and the wall) faces: -1 west (towards the courtyard). */
export const SHOP_SIGN_FACING = -1

/**
 * The thirty-six niches, in sword order: `col` (0 the northmost) and `tier` (0 the bottom);
 * `x, z` where the sword hangs (SWORD_OUT in front of the face) and `y` its middle;
 * `plateY` its name plate's middle (on the face, at SWORD_WALL.x); `floor` its niche's floor;
 * `yaw` the way it faces (west, into the courtyard).
 */
export const TIRE_STANDS = Array.from({ length: SWORD_COLUMNS * SWORD_TIERS }, (_, i) => {
  const tier = Math.floor(i / SWORD_COLUMNS)
  const col = i % SWORD_COLUMNS
  const floor = SWORD_TIER_BASE + tier * SWORD_TIER_HEIGHT
  return {
    index: i,
    col,
    tier,
    x: SWORD_WALL.x - SWORD_OUT,
    z: SWORD_WALL.minZ + (col + 0.5) * SWORD_COLUMN_PITCH,
    y: floor + SWORD_UP,
    plateY: floor + PLATE_UP,
    floor,
    yaw: -Math.PI / 2,
  }
})

/** The SWORD COUNTER: a square dais `half` either side of (x, z), `height` tall, in front of the wall's middle. */
export const SWORD_COUNTER = { x: 33.5, z: (SWORD_WALL.minZ + SWORD_WALL.maxZ) / 2, half: 3.2, height: 0.3 }
export const counterRect = {
  minX: SWORD_COUNTER.x - SWORD_COUNTER.half,
  maxX: SWORD_COUNTER.x + SWORD_COUNTER.half,
  minZ: SWORD_COUNTER.z - SWORD_COUNTER.half,
  maxZ: SWORD_COUNTER.z + SWORD_COUNTER.half,
}

// --- Enchant Altar (the template's ball shop) -----------------------------------------

/**
 * The ENCHANT ALTAR: a magic altar east of spawn, facing west onto the courtyard. Walk up
 * to it (within `radius` of x, z) and its enchantments open (the HUD's Enchants panel).
 * The altar's body is the solid `body`. (Named BALL_SHOP for the template: enchantments
 * are the code's `balls`.)
 */
export const BALL_SHOP = { x: 16, z: 54, radius: 3.5, body: { minX: 17.6, maxX: 21.4, minZ: 50.2, maxZ: 57.8 } }
export const nearBallShop = (x, z) => Math.hypot(x - BALL_SHOP.x, z - BALL_SHOP.z) <= BALL_SHOP.radius

// --- Eggs, showcases, leaderboards --------------------------------------------------

/**
 * The eggs, in two short rows either side of the avenue just north of the spawn, clear of
 * the courtyard's middle: the three World 1 eggs on the west, the Unicorn, Volcano and
 * Dragonfire Peaks' Lava egg on the east (the Lava egg hatches there only; in World 1 it
 * stands locked, a taste of what's through the portal). Far enough apart that no two
 * eggs' reach (EGG_TRIGGER_RADIUS, +1 for a big one) overlaps.
 */
export const EGG_STANDS = [
  { eggId: 'basic', x: -8.5, z: 44 },
  { eggId: 'meadow', x: -17, z: 44 },
  { eggId: 'sunset', x: -25.5, z: 45.5 },
  { eggId: 'unicorn', x: 8.5, z: 44 },
  { eggId: 'volcano', x: 18, z: 44, big: true },
  { eggId: 'beach', x: 28.5, z: 45.5, big: true },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display, south-west by the spawn. */
export const SPHINX_STAND = { x: -30, z: 56 }

/** Four boards flanking the spawn gate, facing north into the courtyard. */
export const LEADERBOARDS = [
  { id: 'rebirths', x: -27, z: 63.5 },
  { id: 'wins', x: -15, z: 63.5 },
  { id: 'distance', x: 15, z: 63.5 },
  { id: 'playtime', x: 27, z: 63.5 },
]

/** The world portal west of the throw stage. Name and Wins in balance.js. */
export const PORTALS = [{ id: 'world2', x: -31, z: -33, radius: 3.4 }]

export const FREE_REWARD = { x: -14, z: 54, radius: 3 }

/**
 * Dragonfire Peaks' Secret Star (balance SECRET_STAR): tucked away in the courtyard's
 * north-east corner behind the east flag tower, where the camera never looks unless you
 * go round. Picked up within `radius`, in Dragonfire Peaks only.
 */
export const STAR = { x: 34, z: -37, y: 1.4, radius: 1.8 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ = halfX) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles. Locked pads add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // The Sword Wall (its end pillars stand half a metre past its run).
  { ...SHOP, minZ: SHOP.minZ - 0.6, maxZ: SHOP.maxZ + 0.6 },
  // The Sword Counter's sign board, along its dais's east edge.
  { minX: counterRect.maxX - 0.45, maxX: counterRect.maxX - 0.05, minZ: SWORD_COUNTER.z - 1.85, maxZ: SWORD_COUNTER.z + 1.85 },
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4),
  // Each dummy on its platform, and its multiplier board behind it.
  ...Array.from({ length: PAD_COUNT }, (_, i) => {
    const d = dummySpot(i)
    return box(d.x, d.z, 0.75)
  }),
  ...Array.from({ length: PAD_COUNT }, (_, i) => {
    const b = padBoard(i)
    return box(b.x, b.z, 0.9)
  }),
  // Each portal ring's base; the swirl itself is walk-through.
  ...PORTALS.flatMap((p) => [box(p.x - p.radius, p.z, 0.6, 0.8), box(p.x + p.radius, p.z, 0.6, 0.8)]),
  // The Enchant Altar.
  { ...BALL_SHOP.body },
  // The throw stage's flag towers.
  ...STAGE_TOWERS.map((t) => box(t.x, t.z, 1.6)),
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = [
  // The throw stage's deck, and the two steps up along its south edge (STAGE_STEP deep each).
  { ...THROW_STAGE, maxZ: THROW_STAGE.maxZ - 2 * STAGE_STEP },
  { ...THROW_STAGE, minZ: THROW_STAGE.maxZ - 2 * STAGE_STEP, maxZ: THROW_STAGE.maxZ - STAGE_STEP, height: (THROW_STAGE.height * 2) / 3 },
  { ...THROW_STAGE, minZ: THROW_STAGE.maxZ - STAGE_STEP, height: THROW_STAGE.height / 3 },
  // The Sword Counter's dais.
  { ...counterRect, height: SWORD_COUNTER.height },
  ...Array.from({ length: PAD_COUNT }, (_, i) => ({ ...padRect(i), height: PAD_HEIGHT })),
]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Whether (x, z) is on training pad `index`'s top, give or take `margin`. */
export const onPad = (index, x, z, margin = 0) => Math.hypot(x - padCenterX(index), z - padCenterZ(index)) <= PAD_RADIUS + margin

/** Index of the training pad under (x, z), or -1. */
export function padAt(x, z, margin = 0) {
  for (let i = 0; i < PAD_COUNT; i += 1) {
    if (onPad(i, x, z, margin)) return i
  }
  return -1
}

/** Whether (x, z) is on the throw stage, give or take `margin`. */
export const inRollZone = (x, z, margin = 0) => inRect(ROLL_ZONE, x, z, margin)

/** The portal whose swirl (x, z) is in, give or take `margin`, or null. */
export function portalAt(x, z, margin = 0) {
  for (const p of PORTALS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius + margin) return p
  }
  return null
}

/**
 * Whether a move from `from` to `to` is the hop back after a throw: on the stage onto
 * ROLL_RETURN. (Nothing moves you after a throw now; kept so the server's speed check
 * stays as it was.)
 */
export const isRollReturn = (from, to) =>
  inRollZone(from.x, from.z, 2) && Math.hypot(to.x - ROLL_RETURN.x, to.z - ROLL_RETURN.z) < 2.5

/** Whether (x, z) is on the Sword Counter's dais, give or take `margin`. */
export const atSwordCounter = (x, z, margin = 0) => inRect(counterRect, x, z, margin)

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
