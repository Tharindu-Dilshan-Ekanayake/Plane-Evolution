import { Euler, Quaternion, Vector3 } from 'three'

import { HOME_PLATE, SLOPE_ANGLE, THROW_STAGE, throwLane, TRACK_START_Z } from '@shared/world'

import { swordCenterY, swordLength } from '../swords'

/**
 * Geometry of a throw: one long, straight road running north from the plaza's edge,
 * dead level (SLOPE_ANGLE is 0; the maths still allows a slope).
 *
 * Track metre `m` is measured along the field from the start line (the plaza's north
 * edge). Before the start (m < 0) the ground is the plaza. Everything here is pure maths
 * and allocation-free, so the frame loop can call it freely.
 */

export const SIN = Math.sin(SLOPE_ANGLE)
export const COS = Math.cos(SLOPE_ANGLE)
export const TAN = Math.tan(SLOPE_ANGLE)

/** World z of track metre m. */
export const zAt = (m) => TRACK_START_Z - (m > 0 ? m * COS : m)
/** Height of the floor at track metre m. */
export const floorY = (m) => (m > 0 ? -m * SIN : 0)
/** Height of the track's floor plane under world z. */
export const slopeY = (z) => (z < TRACK_START_Z ? -(TRACK_START_Z - z) * TAN : 0)
/** Height of a surface parallel to the floor, `h` metres off it, under world z. */
export const surfaceY = (z, h) => slopeY(z) + h / COS

/** How a box lies on the track: tipped back by the slope angle. */
export const SLOPE_EULER_X = -SLOPE_ANGLE

/** World point at track metre m, `x` to the side and `h` off the floor. */
export function trackPoint(m, x, h, out) {
  if (m <= 0) return out.set(x, h, TRACK_START_Z - m)
  return out.set(x, -m * SIN + h * COS, TRACK_START_Z - m * COS - h * SIN)
}

const _e = new Euler()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()

/**
 * Matrix of a box lying on the track, given in track terms: centred `x` across, `h`
 * off the floor (to its centre) and at metre `m` (also its centre), sized `sx` across,
 * `sy` thick and `sz` along the track, leaning `lean` radians about its own long axis.
 */
export function slopeBoxMatrix(m, x, h, sx, sy, sz, lean, out) {
  trackPoint(m, x, h, _p)
  _q.setFromEuler(_e.set(m > 0 ? SLOPE_EULER_X : 0, 0, lean))
  return out.compose(_p, _q, _s.set(sx, sy, sz))
}

/** Same as slopeBoxMatrix, but as BlockSet.add arguments: [x, y, z, rotX]. */
export function slopeBoxPlacement(m, x, h) {
  trackPoint(m, x, h, _p)
  return [_p.x, _p.y, _p.z, m > 0 ? SLOPE_EULER_X : 0]
}

/** Metres a world z is along the track (negative in the plaza). */
export const meterAtZ = (z) => (z < TRACK_START_Z ? (TRACK_START_Z - z) / COS : TRACK_START_Z - z)


// --- A throw -----------------------------------------------------------------------

const clamp01 = (x) => Math.min(1, Math.max(0, x))

/** The flying sword is drawn this much bigger than in your hand: it has to read from afar. */
export const SWORD_SCALE = 2.1
/** How big the flying sword reads to the trail and the effects (its trail's half-width). */
export const TIRE_SIZE = 0.95
/** The template's ball radius: the size of the little things that need one (sparkles, shadow). */
export const BALL_RADIUS = 0.26
/** How deep the tip buries itself in the road, and how far the blade leans back from upright as it sticks. */
const EMBED = 0.7
const STICK_LEAN = 0.42
/** Seconds the stuck sword quivers after it lands, and how hard. */
const WOBBLE_S = 1.4
const WOBBLE = 0.16

/**
 * Where the sword leaves your hand, from where you stand facing down the valley: over
 * your right shoulder as your arm whips over (playerPose THROW_KEYS at THROW_RELEASE).
 * CONTACT is a thrower's in the stage's middle; throwStart works it out for anywhere.
 */
const HAND = { x: 0.2, y: 1.95, z: -0.45 }
export const CONTACT = { x: HOME_PLATE.x + HAND.x, y: THROW_STAGE.height + HAND.y, z: HOME_PLATE.z + HAND.z }
/** Seconds into a throw that the sword leaves your hand (playerPose THROW_RELEASE). */
export const KICK_HIT = 0.26
/** The metre (negative: still in the plaza) the flight starts from. */
export const CONTACT_METER = (TRACK_START_Z - CONTACT.z) / COS

/**
 * Where a throw from a thrower standing at (x, y, z) starts and flies: the release point's
 * metre along the road (negative: still over the stage), its x and height, and its lane
 * down the road (throwLane: where on the stage you stood picks your line).
 */
export function throwStart(x, y, z) {
  const hz = z + HAND.z
  return { fromMeter: (TRACK_START_Z - hz) / COS, startX: x + HAND.x, startY: y + HAND.y, startZ: hz, lane: throwLane(x) }
}

/**
 * How far along its arc (0-1) the sword is `u` of the way through its flight: off your
 * hand fast, slowing as it goes, still moving as it plunges in.
 */
const progress = (u) => {
  const x = clamp01(u)
  return 1.5 * x - 0.5 * x * x
}

/**
 * Seconds into a throw of `duration` at which the sword has flown `f` (0-1) of its arc:
 * 0.5 is the top of the arc, 1 the moment it sticks.
 */
export const kickTimeAt = (f, duration) => KICK_HIT + (1.5 - Math.sqrt(2.25 - 2 * clamp01(f))) * Math.max(0.1, duration - KICK_HIT)

/**
 * The arc's peak grows with the distance (a short throw stays low, a long one soars) and
 * with how well you timed it (KICK_ARC: a WEAK one is a low skimmer, a PERFECT one a
 * towering lob), capped so the road stays in view below it.
 */
const KICK_ARC = { weak: 0.45, good: 0.85, great: 1.15, perfect: 1.5 }
export const flightPeak = (distance, hit = null) => Math.min(48, (5 + 0.62 * Math.sqrt(Math.max(0, distance))) * (KICK_ARC[hit] ?? 1))

/** The blade's direction (grip to tip) at spin angle `theta` about the sideways axis: 0 upright, -PI/2 dead ahead. */
const dirY = (theta, out) => out.set(0, Math.cos(theta), Math.sin(theta))
/** The blade's angle as it leaves your hand (tip up and ahead) and as it sticks (tip down, leaning back). */
const THETA_RELEASE = -1.22
const THETA_STICK = -(Math.PI - STICK_LEAN)
/** Spins a second on the way (more for a better throw), slowing to a plunge at the end. */
const SPIN_RATE = 1.7

const _a = new Vector3()

/** A fresh state for rideState to write into. */
export const createRideState = () => ({
  /** 'launch' (still in your hand) | 'ride' (spinning down the valley) | 'stopped' (stuck in the road). */
  phase: 'launch',
  launch: 0,
  /** Metres along the road: the tip's, ending at the authority's distance. */
  meter: 0,
  speed: 0,
  /** Height of the sword's middle off the ground. */
  air: 0,
  size: TIRE_SIZE,
  /** True while it flies. */
  airborne: false,
  /** Template leftovers: a sword doesn't bounce. */
  bounces: 0,
  rolling: false,
  /** The blade's spin about the sideways axis (radians, see dirY), and its lean about the way it flies. */
  spin: 0,
  roll: 0,
  /** Stuck in the road: and seconds since it stuck. */
  stuck: false,
  stuckFor: 0,
  /** Never true: nothing on the road stops it. */
  crashed: false,
  x: 0,
  /** The sword's middle (its bounding box's middle, at SWORD_SCALE). */
  position: new Vector3(),
  /** Where its tip went in: the impact point. */
  tip: new Vector3(),
})

/**
 * Everything about a throw `elapsed` seconds in - yours, or another player's replayed from
 * the same numbers, so both fly identically. `ride` is `{ fromMeter, startX, distance,
 * duration, hit, len, centerY, lean }` (duration includes the throw; `len` the sword's
 * tip height and `centerY` its middle, swords.js swordLength / swordCenterY, unscaled;
 * `lean` its tilt about the way it flies); `lane` is a sideways offset so swords don't
 * overlap. Writes into `out` (see createRideState):
 *   phase    'launch' (in your hand) | 'ride' | 'stopped'
 *   meter    the tip's metres along the road; speed in m/s along it
 *   position the sword's middle; spin its turn (see dirY); air its middle's height
 */
export function rideState(elapsed, ride, lane, out) {
  const len = (Number.isFinite(ride.len) ? ride.len : 1.4) * SWORD_SCALE
  const cY = (Number.isFinite(ride.centerY) ? ride.centerY : 0.55) * SWORD_SCALE
  // From the middle to the tip, along the blade.
  const toTip = len - cY
  const start = Number.isFinite(ride.fromMeter) ? ride.fromMeter : CONTACT_METER
  const end = Math.max(start + 2, ride.distance)
  const flightTime = Math.max(0.1, ride.duration - KICK_HIT)
  const peak = flightPeak(end - start, ride.hit)
  // The middle's path: from where it is in your hand to where it stands once stuck.
  dirY(THETA_RELEASE, _a)
  const m0 = start - _a.z * cY
  const y0 = (Number.isFinite(ride.startY) ? ride.startY : CONTACT.y) + _a.y * cY
  dirY(THETA_STICK, _a)
  const m1 = end + _a.z * toTip
  const y1 = -EMBED - _a.y * toTip
  const turns = Math.max(2, Math.round(flightTime * SPIN_RATE * (ride.hit === 'perfect' ? 1.3 : ride.hit === 'weak' ? 0.7 : 1)))
  const thetaEnd = THETA_STICK - Math.PI * 2 * turns
  const startX = Number.isFinite(ride.startX) ? ride.startX : CONTACT.x
  out.roll = Number.isFinite(ride.lean) ? ride.lean : 0
  out.size = TIRE_SIZE
  out.crashed = false
  out.rolling = false
  out.bounces = 0
  let meter
  let centre
  let y
  let speed = 0
  if (elapsed < KICK_HIT) {
    // Still in your hand: the throwing arm carries it (the avatar draws it there).
    out.phase = 'launch'
    out.launch = clamp01(elapsed / KICK_HIT)
    out.airborne = false
    out.stuck = false
    out.stuckFor = 0
    out.spin = THETA_RELEASE
    centre = m0
    y = y0
    meter = start
  } else {
    const u = (elapsed - KICK_HIT) / flightTime
    out.launch = 1
    if (u < 1) {
      out.phase = 'ride'
      out.airborne = true
      out.stuck = false
      out.stuckFor = 0
      const f = progress(u)
      centre = m0 + (m1 - m0) * f
      y = y0 + (y1 - y0) * f + peak * 4 * f * (1 - f)
      speed = ((m1 - m0) * (1.5 - u)) / flightTime
      // Spinning end over end, slowing as it comes down so it plunges in point first.
      const e = 0.82 * (1 - (1 - u) * (1 - u)) + 0.18 * u
      out.spin = THETA_RELEASE + (thetaEnd - THETA_RELEASE) * e
      meter = start + (end - start) * f
    } else {
      // Stuck in the road, exactly where the authority said, quivering.
      out.phase = 'stopped'
      out.airborne = false
      out.stuck = true
      out.stuckFor = (elapsed - KICK_HIT - flightTime)
      const t = out.stuckFor
      const wobble = t < WOBBLE_S ? WOBBLE * Math.exp(-t / 0.32) * Math.sin(t * 34) : 0
      out.spin = THETA_STICK + wobble
      // Quivering about the buried tip: the middle swings round it.
      dirY(out.spin, _a)
      centre = end + _a.z * toTip
      y = -EMBED - _a.y * toTip
      meter = end
    }
  }
  // Ease from your spot onto its own line down the road.
  const settle = clamp01((centre - start) / 40)
  const x = startX * (1 - settle) + lane * settle
  out.meter = meter
  out.speed = speed
  out.air = y
  out.x = x
  trackPoint(centre, x, y, out.position)
  trackPoint(end, x, -EMBED, out.tip)
  return out
}

/** Each other player's sword flies down its own line of the road, so swords don't overlap. */
export function laneFor(sid) {
  let h = 2166136261
  for (let i = 0; i < sid.length; i += 1) h = Math.imul(h ^ sid.charCodeAt(i), 16777619)
  return (((h >>> 0) % 5) - 2) * 3
}

/** A throw's lean about the way it flies, the same on every client: a little tilt each time. */
export function leanFor(distance) {
  const k = Math.floor(Math.abs(distance) * 7.31) % 7
  return (k - 3) * 0.07
}

/** Where another player's throw starts (where they stood on the stage) and how their sword is shaped (connection.js ghostRoll). */
export function ghostStart(payload) {
  const id = payload.tireId || 'bicycle'
  const x = Number.isFinite(payload.x) ? payload.x : HOME_PLATE.x
  const z = Number.isFinite(payload.z) ? payload.z : HOME_PLATE.z
  return {
    ...throwStart(x, THROW_STAGE.height, z),
    len: swordLength(id),
    centerY: swordCenterY(id),
    lean: leanFor(payload.distance || 0),
  }
}
