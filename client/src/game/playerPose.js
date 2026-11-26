import { Matrix4, Quaternion, Vector3 } from 'three'

/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way - and where their sword is.
 *
 * `computePose` turns the motion state into joint angles, and the sword's place and turn;
 * each avatar applies them to its own limbs and sword. Angles are radians in character
 * space (the character faces +Z, its left side is +X), about each joint's pivot:
 *   swing - about X: negative swings a hanging limb forward (arm up in front, knee up);
 *           on the spine and neck, which point up, negative bends them back
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward (the chest towards +X)
 * `lift` raises (or, to keep bent legs on the ground, lowers) the body, in metres.
 * `stretchL` / `stretchR` are how long each arm is against its rest length (1 = normal;
 * a hair either way so the hands land on the sword's grip).
 *
 * The sword (`pose.bat`, the template's name): `mode` 'back' (slung across your back
 * while you walk about - big, so everyone's sword shows), 'hand' (in your hands: training,
 * a click slash, winding up and throwing) or 'none' (it's flying down the valley); `pos`
 * its grip, `quat` its turn and `scale` its size, in character space, metres - the sword's
 * own frame is swords.js's: grip at the origin, the blade along +Y, its flat faces +-Z and
 * its edges +-X.
 *
 * Right-handed: the sword's grip is in the right hand (character -X side); training and
 * click slashes take it in both hands, the throw in the right hand alone. Your target -
 * the dummy, the valley - is straight ahead (+Z).
 */

export const POSED_BONES = ['Spine1', 'Neck1', 'ArmL1', 'ArmL2', 'ArmR1', 'ArmR2', 'LegL1', 'LegL2', 'LegR1', 'LegR2']

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  stretchL: 1,
  stretchR: 1,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
  bat: { mode: 'back', pos: new Vector3(), quat: new Quaternion(), scale: 1 },
}

/**
 * The 1.8 m character's measurements: shoulder height and how far out from the middle,
 * arm length (shoulder to palm), and the pivot the upper body turns about (its middle).
 * Measured on Bloxity's player.glb fitted to 1.8 m (the shoulder joint sits at 1.35 m,
 * 0.56 m out, and the arm reaches 0.675 m to the bottom of the hand). Avatars whose arms
 * are a different length rescale the stretch (avatarRig.animateRig).
 */
export const BODY = { shoulderY: 1.35, shoulderX: 0.56, arm: 0.63, pivot: 0.9 }

/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

// --- Walking about ------------------------------------------------------------------

/** Relaxed stance: knees soft, breathing. */
function stance(w, time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.04, 0.05 * OUT_L, 0, w)
  add('LegL2', 0.07, 0, 0, w)
  add('LegR1', 0.04, 0.05 * OUT_R, 0, w)
  add('LegR2', 0.07, 0, 0, w)
  add('Spine1', 0.03 + breath * 0.015, 0, 0, w)
  add('ArmL1', 0.04 + breath * 0.02, 0.1 * OUT_L, 0, w)
  add('ArmR1', 0.04 - breath * 0.02, 0.1 * OUT_R, 0, w)
  add('ArmL2', -0.12, 0, 0, w)
  add('ArmR2', -0.12, 0, 0, w)
  pose.lift += (-0.01 + breath * 0.006) * w
}

/**
 * Walk to sprint: the legs swing, the arms swing against them and the body bobs once
 * per step. `phase` advances faster with speed, so the steps quicken.
 */
function stride(phase, ratio) {
  const cycle = Math.sin(phase)
  const leg = 0.85 * ratio
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  // Knees fold on the back swing only.
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  // Arms against the legs, elbows bending more the faster you go.
  const arm = 0.75 * ratio
  add('ArmL1', -cycle * arm, 0.08 * OUT_L * ratio, 0, 1)
  add('ArmR1', cycle * arm, 0.08 * OUT_R * ratio, 0, 1)
  add('ArmL2', -0.35 * ratio, 0, 0, 1)
  add('ArmR2', -0.35 * ratio, 0, 0, 1)
  add('Spine1', (0.06 + 0.1 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
  pose.lift += (Math.abs(Math.cos(phase)) * 0.05 - 0.015) * ratio
}

/**
 * In the air: one knee up on the way up, arms flung up and out; falling, the legs
 * straighten and reach down for the ground.
 */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('Spine1', lerp(0.15, -0.06, f), 0, 0, 1)
  add('ArmL1', lerp(-2.6, -0.5, f), lerp(0.5, 0.35, f) * OUT_L, 0, 1)
  add('ArmR1', lerp(-2.6, -0.5, f), lerp(0.5, 0.35, f) * OUT_R, 0, 1)
}

/** Arms up and waving, bouncing on the spot: a celebration. */
function cheering(time, w) {
  const wave = Math.sin(time * 10) * 0.28
  add('ArmL1', -2.7 + wave, 0.38 * OUT_L, 0, w)
  add('ArmR1', -2.7 - wave, 0.38 * OUT_R, 0, w)
  add('ArmL2', -0.25, 0, 0, w)
  add('ArmR2', -0.25, 0, 0, w)
  add('LegL1', -0.12, 0.06 * OUT_L, 0, w)
  add('LegR1', -0.12, 0.06 * OUT_R, 0, w)
  add('LegL2', 0.22, 0, 0, w)
  add('LegR2', 0.22, 0, 0, w)
  add('Spine1', -0.1, 0, 0, w)
  add('Neck1', -0.15, 0, 0, w)
  pose.lift += Math.abs(Math.sin(time * 7)) * 0.16 * w
}

// --- The sword --------------------------------------------------------------------------

const _x = new Vector3()
const _y = new Vector3()
const _z = new Vector3()
const _v = new Vector3()
const _q = new Quaternion()
const _ax = new Vector3(1, 0, 0)
const _ay = new Vector3(0, 1, 0)
const _m4 = new Matrix4()

/** Turns the sword so its blade (+Y) runs along `dir` and its flat (+Z) faces `face`. */
function faceTurn(dir, face, out) {
  _y.copy(dir).normalize()
  _z.copy(face).addScaledVector(_y, -face.dot(_y))
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z)
  _z.normalize()
  _x.crossVectors(_y, _z)
  // makeBasis wants columns: x, y, z.
  return out.setFromRotationMatrix(_m4.makeBasis(_x, _y, _z))
}

/** Turns the sword so its blade (+Y) runs along `dir` and its edge (+X) leads along `edge`. */
function edgeTurn(dir, edge, out) {
  _y.copy(dir).normalize()
  _x.copy(edge).addScaledVector(_y, -edge.dot(_y))
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(_y, -_y.x)
  _x.normalize()
  _z.crossVectors(_x, _y)
  return out.setFromRotationMatrix(_m4.makeBasis(_x, _y, _z))
}

/**
 * The upper body's turn: bent forward `swing` about the hips, then twisted `twist`; for
 * carrying things that ride on it (the sword on your back) and aiming the arms from it.
 */
function upperBody(swing, twist, out) {
  out.setFromAxisAngle(_ax, swing)
  return out.multiply(_q.setFromAxisAngle(_ay, twist))
}

const _spine = new Quaternion()
const _spineInv = new Quaternion()
const _shoulder = new Vector3()
const _d = new Vector3()

/**
 * Points one arm (`side` +1 left, -1 right) from its shoulder at `target` (character
 * space, metres), the upper body bent `spineSwing` and twisted `spineTwist`, and
 * stretches it - within reason - to reach: the hands land on the sword's grip.
 */
function aimArmAt(side, target, spineSwing, spineTwist, w) {
  upperBody(spineSwing, spineTwist, _spine)
  _spineInv.copy(_spine).invert()
  // The shoulder, turned with the upper body about its pivot.
  _shoulder.set(side * BODY.shoulderX, BODY.shoulderY - BODY.pivot, 0).applyQuaternion(_spine)
  _shoulder.y += BODY.pivot + pose.lift
  // Shoulder to target, in the upper body's own frame (the arm's parent).
  _d.subVectors(target, _shoulder).applyQuaternion(_spineInv)
  const len = Math.max(0.05, _d.length())
  const out = side * _d.x
  const sway = Math.asin(Math.min(1, Math.max(-1, out / len)))
  const swing = Math.atan2(-_d.z, -_d.y)
  const name = side > 0 ? 'ArmL1' : 'ArmR1'
  add(name, swing, sway * (side > 0 ? OUT_L : OUT_R), 0, w)
  const stretch = Math.min(1.22, Math.max(0.72, len / (BODY.arm + 0.045))) - 1
  if (side > 0) pose.stretchL += stretch * w
  else pose.stretchR += stretch * w
}

/**
 * How big a sword is drawn on you, by its length (metres, swords.js swordLength): the small
 * early ones blown up so even the Wooden Sword reads as a big cartoon blade, the huge late
 * ones kept near life size so they don't swamp you.
 */
export const swordScale = (len) => Math.min(1.3, Math.max(1, 1.55 - 0.22 * len))

/** The sword being posed this frame: its size (set from motion.swordLen by computePose). */
let held = 1

/** A blade direction from its heading `phi` (about the vertical: 0 = +Z ahead, +PI/2 = +X left) and elevation. */
function bladeDir(phi, elev, out) {
  return out.set(Math.cos(elev) * Math.sin(phi), Math.sin(elev), Math.cos(elev) * Math.cos(phi))
}

// --- Keyframes ------------------------------------------------------------------------

/**
 * A move as keyframes over its progress `s` (0-1): the blade's heading `phi` and
 * elevation `elev` (see bladeDir), where the grip is (hx, hy, hz, character space), how
 * far the upper body has turned (`twist`) and bent forward (`bend`).
 */
const FOREHAND = [
  { s: 0, phi: -2.5, elev: 0.75, hx: -0.3, hy: 1.7, hz: 0.02, twist: -0.55, bend: 0.05 },
  { s: 0.18, phi: -2.25, elev: 0.95, hx: -0.3, hy: 1.82, hz: 0, twist: -0.65, bend: 0 },
  { s: 0.38, phi: -1.0, elev: 0.45, hx: -0.2, hy: 1.55, hz: 0.3, twist: -0.25, bend: 0.08 },
  { s: 0.5, phi: 0.1, elev: -0.05, hx: 0, hy: 1.28, hz: 0.5, twist: 0.15, bend: 0.18 },
  { s: 0.7, phi: 1.05, elev: -0.55, hx: 0.2, hy: 1.05, hz: 0.4, twist: 0.55, bend: 0.26 },
  { s: 1, phi: 1.75, elev: -0.8, hx: 0.3, hy: 0.95, hz: 0.22, twist: 0.75, bend: 0.24 },
]
/** The rising return cut, low left to high right, ending cocked for the next forehand. */
const BACKHAND = [
  { s: 0, phi: 1.75, elev: -0.8, hx: 0.3, hy: 0.95, hz: 0.22, twist: 0.75, bend: 0.24 },
  { s: 0.18, phi: 1.95, elev: -0.62, hx: 0.34, hy: 1.0, hz: 0.12, twist: 0.85, bend: 0.22 },
  { s: 0.38, phi: 1.1, elev: -0.2, hx: 0.22, hy: 1.15, hz: 0.38, twist: 0.45, bend: 0.2 },
  { s: 0.5, phi: -0.1, elev: 0.15, hx: 0, hy: 1.3, hz: 0.5, twist: -0.05, bend: 0.14 },
  { s: 0.7, phi: -1.1, elev: 0.6, hx: -0.22, hy: 1.55, hz: 0.35, twist: -0.4, bend: 0.06 },
  { s: 1, phi: -2.5, elev: 0.75, hx: -0.3, hy: 1.7, hz: 0.02, twist: -0.55, bend: 0.05 },
]
/**
 * The throw, by seconds since letting go: cocked behind your head, the arm whipping up and
 * over - the sword leaving your hand at THROW_RELEASE - and the follow-through down across
 * your body.
 */
const THROW_KEYS = [
  { s: 0, phi: Math.PI, elev: 0.3, hx: -0.4, hy: 1.76, hz: -0.42, twist: -0.95, bend: -0.12 },
  { s: 0.1, phi: Math.PI, elev: 0.95, hx: -0.38, hy: 1.86, hz: -0.22, twist: -0.6, bend: -0.06 },
  { s: 0.2, phi: 0.0, elev: 1.2, hx: -0.26, hy: 1.96, hz: 0.25, twist: 0.1, bend: 0.08 },
  { s: 0.26, phi: 0.0, elev: 0.35, hx: -0.18, hy: 1.86, hz: 0.48, twist: 0.3, bend: 0.18 },
  { s: 0.45, phi: 0.3, elev: -0.6, hx: 0.04, hy: 1.25, hz: 0.55, twist: 0.6, bend: 0.36 },
  { s: 0.8, phi: 0.6, elev: -0.9, hx: 0.22, hy: 1.0, hz: 0.36, twist: 0.7, bend: 0.3 },
]
/** Seconds after letting go that the sword leaves your hand (the flight starts there: roll/path.js). */
export const THROW_RELEASE = 0.26
/** How long the throw's follow-through plays before you stand up to watch. */
const THROW_FOLLOW = 0.95

/** On your spot, ready: the grip in front of your chest, the blade resting back on your right shoulder. */
const READY = { phi: Math.PI, elev: 1.15, hx: -0.2, hy: 1.24, hz: 0.26, twist: -0.12, bend: 0.03 }

const _key = { phi: 0, elev: 0, hx: 0, hy: 0, hz: 0, twist: 0, bend: 0 }
const _key2 = { phi: 0, elev: 0, hx: 0, hy: 0, hz: 0, twist: 0, bend: 0 }
const KEY_FIELDS = Object.keys(_key)

/** Samples `keys` at progress `s` (smoothly between keys) into `out`. */
function sampleKeys(keys, s, out = _key) {
  let i = 1
  while (i < keys.length - 1 && keys[i].s < s) i += 1
  const a = keys[i - 1]
  const b = keys[i]
  const u = clamp01((s - a.s) / Math.max(1e-6, b.s - a.s))
  const k = u * u * (3 - 2 * u) * 0.35 + u * 0.65
  for (const f of KEY_FIELDS) out[f] = a[f] + (b[f] - a[f]) * k
  return out
}

/** Blends key `b` into `a` by `t` (in place, into `a`). */
function mixKeys(a, b, t) {
  for (const f of KEY_FIELDS) a[f] += (b[f] - a[f]) * t
  return a
}

const _grip = new Vector3()
const _dir = new Vector3()
const _dir2 = new Vector3()
const _edge = new Vector3()
const _hand = new Vector3()
const _face = new Vector3()

/**
 * Puts the sword in your hands from a sampled key: the blade along its heading, its edge
 * leading along `edge` (where it's cutting), the right hand on the grip and - with
 * `twoHanded` - the left just below it; the body bent and twisted as the key says.
 */
function holdSword(key, edge, w, twoHanded, jitter = 0) {
  bladeDir(key.phi, key.elev + jitter, _dir)
  _grip.set(key.hx + jitter * 0.4, key.hy + pose.lift, key.hz)
  add('Spine1', key.bend, 0, key.twist, w)
  aimArmAt(-1, _hand.copy(_grip).addScaledVector(_dir, 0.03), key.bend, key.twist, w)
  if (twoHanded) aimArmAt(1, _hand.copy(_grip).addScaledVector(_dir, -0.15), key.bend, key.twist, w)
  pose.bat.mode = 'hand'
  pose.bat.scale = held
  pose.bat.pos.copy(_grip)
  edgeTurn(_dir, edge, pose.bat.quat)
}

/** Holds the sword on `keys` at `s`, its edge leading the way the keys move it. */
function swordOnKeys(keys, s, w, twoHanded, jitter = 0) {
  const key = sampleKeys(keys, s, _key)
  // The cutting direction: where the blade heads next along the keys.
  const ds = s < 0.98 ? 0.02 : -0.02
  const next = sampleKeys(keys, s + ds, _key2)
  bladeDir(key.phi, key.elev, _dir)
  bladeDir(next.phi, next.elev, _dir2)
  _edge.subVectors(_dir2, _dir).multiplyScalar(Math.sign(ds))
  if (_edge.lengthSq() < 1e-8) _edge.set(1, 0, 0)
  holdSword(key, _edge, w, twoHanded, jitter)
}

/**
 * A fighting stance's legs: feet wide, knees bent, the left foot ahead; `drive` (0-1) the
 * step into the cut - the front foot striding, the hips firing, the back heel lifting.
 */
function fightLegs(drive, w) {
  add('LegL1', -0.3 - 0.25 * drive, 0.2 * OUT_L, 0.2 * drive, w)
  add('LegL2', 0.38 + 0.15 * drive, 0, 0, w)
  add('LegR1', 0.22 + 0.2 * drive, 0.18 * OUT_R, 0.35 * drive, w)
  add('LegR2', 0.3 + 0.35 * drive, 0, 0, w)
  pose.lift -= (0.08 + 0.03 * drive) * w
}

// --- Slashing ---------------------------------------------------------------------------

/** Contact comes at this share of each slash cycle (the gain lands then). */
export const CAGE_CONTACT = 0.55

/** A slash's progress along its keys (0-1) at `c` (0-1) through its cycle: wind up, cut, finish, hold. */
function slashProgress(c) {
  if (c < 0.35) return 0.18 * smooth(0, 1, c / 0.35)
  if (c < CAGE_CONTACT) {
    const u = (c - 0.35) / (CAGE_CONTACT - 0.35)
    return 0.18 + 0.32 * u * u
  }
  if (c < 0.85) {
    const u = (c - CAGE_CONTACT) / (0.85 - CAGE_CONTACT)
    return 0.5 + 0.5 * (1 - (1 - u) * (1 - u))
  }
  return 1
}

/**
 * Training on a dummy, one slash per pitch of `phase` (2 PI each TRAIN_INTERVAL): a high
 * forehand cut down across it, then the rising backhand back, and again - each striking
 * the dummy CAGE_CONTACT of the way through its cycle.
 */
function dummySlashes(phase, w) {
  const turns = phase / (Math.PI * 2)
  const c = ((turns % 1) + 1) % 1
  const back = Math.floor(turns) % 2 === 1
  const s = slashProgress(c)
  swordOnKeys(back ? BACKHAND : FOREHAND, s, w, true)
  fightLegs(smooth(0.3, 0.55, c) * (1 - smooth(0.85, 1, c)), w)
  add('Neck1', -0.05, 0, -_key.twist * 0.6, w)
}

/** Seconds a click slash takes, and when it cuts (the gain lands then). */
export const CLICK_SLASH_S = 0.5
export const CLICK_SLASH_CONTACT = CAGE_CONTACT * CLICK_SLASH_S

/** A click slash `t` seconds in: one forehand cut through the air in front of you. */
function clickSlash(t, w) {
  const c = clamp01(t / CLICK_SLASH_S)
  swordOnKeys(FOREHAND, slashProgress(c), w, true)
  fightLegs(smooth(0.3, 0.55, c) * (1 - smooth(0.85, 1, c)), w)
}

// --- Throwing ---------------------------------------------------------------------------

/**
 * On your throw spot: ready, the sword on your shoulder - and as you hold THROW (`coil`
 * 0-1) winding up: turning side-on, your free hand pointing down the valley, the sword
 * drawn back behind your head, weight on your back foot. Held at full charge it trembles
 * with the strain (`strain` 0-1).
 */
function throwReady(time, coil, strain, w) {
  const key = mixKeys(Object.assign(_key, READY), THROW_KEYS[0], smooth(0, 1, coil))
  const jitter = strain > 0 ? Math.sin(time * 61) * 0.02 * strain : 0
  // The resting sword's flat faces out to your right; drawn back, its edge points up.
  bladeDir(key.phi, key.elev, _dir)
  _edge.set(-1, 0, 0).lerp(_ay, smooth(0, 1, coil))
  holdSword(key, _edge, w, false, jitter)
  // The free arm: relaxed at first, then pointing down the valley at where it's going.
  _hand.set(0.62, 1.42 + 0.12 * coil, 0.25 + 0.55 * coil)
  aimArmAt(1, _hand, key.bend, key.twist, w * smooth(0, 0.6, coil))
  add('ArmL1', 0.04, 0.12 * OUT_L, 0, w * (1 - smooth(0, 0.6, coil)))
  add('ArmL2', -0.2 * (1 - coil), 0, 0, w)
  add('Neck1', -0.08, 0, -key.twist * 0.85, w)
  fightLegs(0, w * coil)
  stance(w * (1 - coil), time)
  pose.lift += Math.sin(time * 3) * 0.008 * (1 - coil) * w
}

/** The throw `t` seconds after letting go: the arm whipping over, then the follow-through. */
function throwing(t, power, w) {
  const key = sampleKeys(THROW_KEYS, Math.min(t, THROW_KEYS[THROW_KEYS.length - 1].s), _key)
  key.twist *= 1 + 0.15 * power
  if (t < THROW_RELEASE) {
    // Still in your hand: its edge leading over the top.
    swordOnKeys(THROW_KEYS, t, w, false)
  } else {
    // Gone: the arm carries on through without it.
    add('Spine1', key.bend, 0, key.twist, w)
    _grip.set(key.hx, key.hy + pose.lift, key.hz)
    aimArmAt(-1, _grip, key.bend, key.twist, w)
    pose.bat.mode = 'none'
  }
  // The free arm sweeps back as the throwing arm comes through.
  _hand.set(0.6, 1.3 - 0.3 * smooth(0.1, 0.4, t), 0.7 - 0.9 * smooth(0.1, 0.45, t))
  aimArmAt(1, _hand, key.bend, key.twist, w)
  add('Neck1', -0.12, 0, -key.twist * 0.6, w)
  fightLegs(smooth(0, 0.3, t), w)
}

/**
 * After the throw: the follow-through held, then up to watch it fly - a cheer with both
 * fists up when it was a great one, a hand shading your eyes when it wasn't. `t` is
 * seconds since letting go. The sword is out there: none in your hands.
 */
function afterThrow(t, great, time, w) {
  const relax = smooth(THROW_FOLLOW, THROW_FOLLOW + 0.45, t)
  if (relax < 1) throwing(t, great ? 1 : 0.5, w * (1 - relax))
  pose.bat.mode = t < THROW_RELEASE ? pose.bat.mode : 'none'
  if (relax <= 0) return
  if (great) {
    cheering(time, w * relax)
  } else {
    stance(w * relax, time)
    // A hand up to shade your eyes, watching it go.
    _hand.set(-0.12, 1.72, 0.2)
    aimArmAt(-1, _hand, 0.02, 0, w * relax)
    add('ArmR2', -1.2, 0, 0, w * relax)
    add('Neck1', -0.12, 0, 0, w * relax)
  }
}

/**
 * The sword slung across your back, riding with the upper body: the grip up over your
 * right shoulder, the blade running down behind you to the left - tipped further over the
 * longer it is (`len`, metres), so even the biggest clears the ground.
 */
function swordOnBack(spineSwing, twist, len) {
  upperBody(spineSwing, twist, _spine)
  // Measured as drawn (scaled), so the tilt keeps the tip clear of the ground.
  const big = clamp01((len * held - 1.5) / 1.1)
  const tilt = 0.62 + 0.45 * big
  pose.bat.mode = 'back'
  pose.bat.scale = held
  _v.set(-0.3, 1.8 + 0.08 * big - BODY.pivot, -0.34)
  pose.bat.pos.copy(_v.applyQuaternion(_spine))
  pose.bat.pos.y += BODY.pivot + pose.lift
  _dir.set(Math.sin(tilt), -Math.cos(tilt), -0.06).applyQuaternion(_spine)
  _face.set(0, 0, -1).applyQuaternion(_spine)
  faceTurn(_dir, _face, pose.bat.quat)
}

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, run?: number, bat?: string, swingT?: number,
 *   coil?: number, strain?: number, great?: boolean, cheer?: number, swordLen?: number,
 *   emote?: string|null }} motion
 *   `run` (0-1) is training on a dummy (`stride` is the slashes' phase); the name is the
 *   template's, and what other players are told ('run').
 *   `bat` is 'ready' (on a throw spot: `coil` 0-1 winding up, `strain` 0-1 held at full),
 *   'throw' (throwing, `swingT` seconds after letting go), 'after' (it's flying:
 *   `swingT` seconds since letting go, `great` whether to celebrate), 'slash' (a click
 *   slash, `swingT` seconds in) - or unset: walking about with the sword on your back
 *   (`swordLen` long). `cheer` (0-1) is celebrating.
 *   `emote` is a Boxity emote id to play over this pose, or null. It isn't posed here:
 *   the Bloxity avatar blends the emote clip on top of this pose (avatarRig.updateEmote),
 *   so the same motion object drives both.
 */
export function computePose(motion) {
  const { time = 0, speed = 0, maxSpeed = 6, grounded = true, vy = 0, stride: phase = time * 5, run = 0, bat, swingT = 0, coil = 0, cheer = 0, swordLen = 1.4 } = motion
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0
  pose.stretchL = 1
  pose.stretchR = 1
  pose.bat.mode = 'back'
  held = swordScale(swordLen)
  pose.bat.scale = held

  if (bat === 'ready') {
    throwReady(time, clamp01(coil), clamp01(motion.strain || 0), 1)
    return pose
  }
  if (bat === 'throw') {
    throwing(swingT, 0.7, 1)
    return pose
  }
  if (bat === 'after') {
    afterThrow(swingT, Boolean(motion.great), time, 1)
    return pose
  }
  if (bat === 'slash') {
    clickSlash(swingT, 1)
    return pose
  }
  if (run > 0 && grounded) {
    dummySlashes(phase, clamp01(run))
    return pose
  }
  if (cheer > 0) {
    cheering(time, cheer)
    stance(clamp01(1 - cheer), time)
    swordOnBack(0.03, 0, swordLen)
    return pose
  }
  const ratio = grounded ? clamp01(speed / Math.max(maxSpeed, 0.001)) : 0
  if (grounded) {
    const still = 1 - smooth(0.05, 0.4, ratio)
    stance(still, time)
    if (ratio > 0.02) stride(phase, ratio)
  } else {
    airborne(vy)
  }
  const spine = pose.bones.Spine1
  swordOnBack(spine.swing, spine.twist, swordLen)
  return pose
}
