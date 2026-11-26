import { Vector3 } from 'three'

import { comboBonus, HIT_GRADES } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { BATTER_YAW } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { fadeThrough } from '../../ui/fade'
import { burst, fireBurst } from '../fx/fxQueue'
import { spawnScattered } from '../fx/popups'
import { consumePull, launch } from '../launch'
import { runtime } from '../runtime'
import { swordCenterY, swordLength } from '../swords'
import { zones } from '../worldLook'
import { showHit } from './hudLink'
import { CONTACT, CONTACT_METER, createRideState, flightPeak, KICK_HIT, kickTimeAt, leanFor, rideState, throwStart } from './path'

/** How long the "+N Wins" result shows over the stuck sword before you're back. */
const RESULT_HOLD_MS = 2600
/** The whoosh of the plunge starts this long before the sword sticks. */
const PLUNGE_SOUND_LEAD = 0.5
/** Let go this recently (ms), the flight is timed from your release, not the server's answer. */
const RELEASE_SYNC_MS = 700

/** The template's bounce counts: a sword never bounces. */
export const bouncesFor = () => 0

/**
 * The throw currently playing (the template's "roll"), read every frame by the camera,
 * the road, the sword, your avatar and the effects. Everything about it is known when it
 * starts (the authority already resolved the distance and the Wins), so the client just
 * plays it back: no per-frame network traffic.
 *
 * It's a ride state (see path.rideState: phase, meter, air, spin, the sword's middle...)
 * plus the throw's numbers. You stay where you stood on the stage (that's what the server checks);
 * only the sword and the camera go down the valley.
 */
export const roll = {
  ...createRideState(),
  active: false,
  /** True once the sword has stuck and the result is showing. */
  stopped: false,
  startedAt: 0,
  distance: 0,
  duration: 1,
  wins: 0,
  prize: 0,
  discovered: [],
  /** Template leftovers: nothing on the road stops the sword. */
  blocked: -1,
  /** How many stages it flies into past the first. */
  broken: 0,
  best: false,
  /** The sword thrown (TIRES id), its enchantment (BALLS id), and its shape (swords.js). */
  tireId: 'bicycle',
  ballId: 'plain',
  len: 1.25,
  centerY: 0.46,
  lean: 0,
  /** How well you timed the throw (HIT_GRADES id), or null for Auto Throw. */
  hit: null,
  /** Where the flight starts: the release point's metre along the road, its x, height and z. */
  fromMeter: CONTACT_METER,
  startX: CONTACT.x,
  startY: CONTACT.y,
  startZ: CONTACT.z,
  /** Its lane down the road (from where on the stage it was thrown). */
  lane: 0,
  /** PERFECTs in a row with this throw (0: not a PERFECT), and its lucky gift or null. */
  combo: 0,
  gift: null,
  /** performance.now() the sword stuck, left your hand, and of the last big jolt. */
  landedAt: 0,
  tookOffAt: 0,
  hitAt: 0,
  /** performance.now() when the sword left your hand. */
  kickedAt: 0,
  /**
   * A graded throw's punch: when it started (performance.now(), 0 if none this throw),
   * how long it lasts, how strong the camera's zoom, punch and shake are (0-1), and the
   * throw clock's lag when it started (the freeze is measured from it).
   */
  freezeAt: 0,
  freezeMs: 0,
  freezePower: 0,
  freezeLag: 0,
  /**
   * The sword plunging into the road: when (performance.now()), where its tip went in, and
   * how high it fell from - what the crater, the cracks and the dust need.
   */
  impactAt: 0,
  impact: new Vector3(),
  impactMeter: 0,
  impactPeak: 0,
  frameKey: -1,
  /**
   * Hit-stop: ms the throw's clock is behind real time. The sword sticking freezes it (and
   * the camera on it) for a beat; the clock then catches up a little faster than real
   * time, and is always caught up before the result, so the throw ends exactly when the
   * authority said.
   */
  lag: 0,
  lastNow: 0,
}

/** How long the plunge's slow motion lasts, how slow, and how fast the clock catches up. */
const SLOW_MS = 260
const SLOW_RATE = 0.12
/** How fast the throw's clock runs during a hit-stop: all but frozen. */
const FREEZE_RATE = 0.06
const CATCH_UP = 0.4

let timers = []

function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers = []
}

/**
 * Moves the throw on to this frame. Idempotent per frame (keyed on the renderer's clock),
 * so the camera, the sword and the effects all see exactly the same state however many of
 * them ask.
 */
export function advanceRoll(clockTime) {
  if (!roll.active || roll.frameKey === clockTime) return roll
  roll.frameKey = clockTime
  const now = performance.now()
  const wasStuck = roll.stuck
  const wasWaiting = roll.phase === 'launch'
  const dt = roll.lastNow ? Math.min(now - roll.lastNow, 100) : 0
  roll.lastNow = now
  if (now - roll.freezeAt < roll.freezeMs) {
    // From the clock, not summed frame by frame: frame steps are capped, so on a slow
    // device a summed freeze would mostly slip away.
    roll.lag = roll.freezeLag + (now - roll.freezeAt) * (1 - FREEZE_RATE)
  } else if (now - roll.hitAt < SLOW_MS) roll.lag += dt * (1 - SLOW_RATE)
  else roll.lag = Math.max(0, roll.lag - dt * CATCH_UP)
  // All caught up by half a second before the result.
  const left = roll.duration - (now - roll.startedAt) / 1000
  roll.lag = Math.min(roll.lag, Math.max(0, left - 0.5) * 400)
  rideState((now - roll.startedAt - roll.lag) / 1000, roll, roll.lane, roll)
  if (wasWaiting && roll.phase !== 'launch') {
    roll.kickedAt = now
    roll.tookOffAt = now
    blastOff(now)
  }
  if (!wasStuck && roll.stuck) stick(now)
  return roll
}

/**
 * How each grade of throw looks as the sword leaves your hand: its burst (FireBurst kind),
 * confetti, and how hard the camera reacts (0-1).
 */
const HIT_FX = {
  perfect: { fire: 'perfect', palette: 'gold', count: 60, speed: 12, freezeMs: 0, power: 1 },
  great: { fire: 'great', palette: 'power', count: 34, speed: 9, freezeMs: 0, power: 0.65 },
  good: { fire: 'good', palette: 'confetti', count: 16, speed: 6, freezeMs: 0, power: 0.35 },
  weak: { fire: null, palette: null, count: 0, speed: 0, freezeMs: 0, power: 0 },
}

/**
 * The sword leaving your hand: the grade the throw meter gave it, straight away, so you see
 * why it flies as far as it does. GOOD, GREAT and PERFECT each get their own moment,
 * bigger every step - a burst off your hand (sparkles, an electric-blue blast, a column of
 * fire), the grade's title slamming onto the screen (HitFlash.jsx), the lens punching
 * wide and the camera shaking (Roll.jsx). A WEAK one just wobbles off.
 */
function blastOff(now) {
  sfx.rollStart()
  const grade = HIT_GRADES.find((g) => g.id === roll.hit)
  if (!grade) return
  const fx = HIT_FX[grade.id]
  const p = roll.position
  if (fx.count) burst({ x: p.x, y: p.y, z: p.z, count: fx.count, palette: fx.palette, speed: fx.speed })
  // PERFECTs in a row: the combo and the Wins it adds.
  if (grade.id === 'perfect' && roll.combo >= 2) {
    timers.push(setTimeout(() => spawnScattered(`PERFECT COMBO x${roll.combo}! +${Math.round((comboBonus(roll.combo) - 1) * 100)}% WINS`, { scale: 1.25 }), 450))
  }
  if (grade.id === 'weak') {
    spawnScattered(grade.label, { scale: 1.3 })
    sfx.weakHit()
    return
  }
  roll.freezeAt = Math.min(now, roll.startedAt + roll.lag + KICK_HIT * 1000)
  roll.freezeMs = fx.freezeMs
  roll.freezePower = fx.power
  roll.freezeLag = roll.lag
  fireBurst(p.x, p.y, p.z, fx.fire)
  showHit(grade.id)
  sfx.gradeHit(grade.id)
  timers.push(setTimeout(() => sfx.perfectRelease(fx.power), 60))
}

/**
 * The sword plunging point-first into the road: a THUNK, the camera jolting, a beat of
 * slow motion, and the crater, cracks and dust round it (Impact.jsx).
 */
function stick(now) {
  roll.landedAt = now
  roll.hitAt = now
  roll.impactAt = now
  roll.impact.copy(roll.tip)
  roll.impactMeter = roll.distance
  roll.impactPeak = flightPeak(roll.distance - roll.fromMeter, roll.hit)
  // A hard freeze for a big throw: you see the blade bite.
  roll.freezeAt = now
  roll.freezeMs = 70 + Math.min(110, roll.impactPeak * 2.5)
  roll.freezePower = Math.max(roll.freezePower, 0.35)
  roll.freezeLag = roll.lag
  sfx.swordStick(Math.min(1, roll.impactPeak / 40))
}

/**
 * Starts a throw the authority already resolved, from your release: your arm whips over,
 * the sword leaves your hand and spins away down the valley.
 */
export function beginRoll(result) {
  clearTimers()
  const game = getGame()
  const now = performance.now()
  // The flight is timed from your release, so the sword leaves your hand just as your arm
  // comes over - however long the answer took. (Auto Throw, or a release the server
  // answered very late: timed from now.)
  const sinceRelease = now - launch.swungAt
  const synced = launch.swungAt > 0 && sinceRelease < RELEASE_SYNC_MS
  if (!synced) launch.swungAt = now
  consumePull()
  const tireId = result.tireId || game.profile.equippedTire
  const ballId = result.ballId || game.profile.equippedBall
  Object.assign(roll, {
    active: true,
    stopped: false,
    startedAt: synced ? launch.swungAt : now,
    distance: result.distance,
    duration: result.duration,
    wins: result.wins,
    prize: result.prize || 0,
    discovered: result.discovered || [],
    blocked: result.blocked ?? -1,
    broken: result.broken || 0,
    best: result.best,
    tireId,
    ballId,
    len: swordLength(tireId),
    centerY: swordCenterY(tireId),
    lean: leanFor(result.distance),
    hit: result.hit ?? null,
    // From where you stood on the stage when you let go.
    ...throwStart(launch.fromX, launch.fromY, launch.fromZ),
    combo: result.combo || 0,
    gift: result.gift || null,
    landedAt: 0,
    tookOffAt: 0,
    hitAt: 0,
    kickedAt: 0,
    freezeAt: 0,
    freezeMs: 0,
    freezePower: 0,
    impactAt: 0,
    frameKey: -1,
    lag: 0,
    lastNow: 0,
    stuck: false,
    stuckFor: 0,
  })
  rideState(0, roll, roll.lane, roll)
  runtime.player.frozen = true
  runtime.player.yaw = BATTER_YAW
  runtime.camera.mode = 'roll'
  // The HUD's switch to the flight (a React update and a restyle) in a task of its own,
  // not the frame the throw starts in: together they made that one frame stick on slow
  // phones. The flight itself is already under way from the runtime state above.
  const started = {
    distance: result.distance,
    wins: result.wins,
    prize: result.prize || 0,
    blocked: result.blocked ?? -1,
    duration: result.duration,
    best: result.best,
    giftWins: result.gift?.wins || 0,
  }
  timers.push(setTimeout(() => game.startRoll(started), 0))

  const elapsed = (now - roll.startedAt) / 1000
  const at = (t) => Math.max(0, t - elapsed) * 1000
  // The blade humming as it spins up, a whistle down from the top of its arc, and the
  // rising whoosh of the plunge just before it sticks.
  const apex = kickTimeAt(0.5, result.duration)
  const land = kickTimeAt(1, result.duration)
  timers.push(setTimeout(() => sfx.fallWhistle(land - apex), at(apex)))
  timers.push(setTimeout(() => sfx.rollStop(), at(Math.max(0, result.duration - PLUNGE_SOUND_LEAD))))
  timers.push(setTimeout(showResult, at(result.duration)))
}

/** Stuck: the Wins pour in, a first-time stage and any lucky gift are announced, and you're back. */
function showResult() {
  roll.stopped = true
  const game = getGame()
  sfx.wins()
  const f = roll.tip
  burst({ x: f.x, y: f.y + 2.2, z: f.z, count: 50, palette: 'gold', speed: 9 })
  game.endRoll()
  // A stage reached for the first time ever: its name and the prize, once.
  const stages = zones()
  for (const zi of roll.discovered) {
    game.showToast(`NEW STAGE: ${stages[zi].name}! +${formatNumber(stages[zi].discover)} Wins`)
  }
  // A lucky gift: a present bursting open over the sword, and what was in it.
  const gift = roll.gift
  if (gift) {
    timers.push(
      setTimeout(
        () => {
          sfx.reveal()
          burst({ x: f.x, y: f.y + 2.6, z: f.z, count: 70, palette: 'confetti', speed: 11 })
          const what = gift.wins ? `+${formatNumber(gift.wins)} Wins` : gift.label
          game.showToast(`LUCKY GIFT! ${gift.wins ? `${gift.label}: ${what}` : what}`)
        },
        roll.discovered.length ? 1600 : 500,
      ),
    )
  }
  timers.push(setTimeout(() => fadeThrough(finishRoll), RESULT_HOLD_MS))
}

/**
 * Back on the stage, camera behind you, your sword back in your hand: still where you
 * stood, so you can wind up the next throw straight away (walk off the stage to leave).
 */
export function finishRoll() {
  clearTimers()
  roll.active = false
  roll.stopped = false
  runtime.flightFocus = null
  const player = runtime.player
  player.yaw = BATTER_YAW
  player.frozen = false
  runtime.camera.mode = 'follow'
  runtime.camera.yaw = 0
  runtime.camera.snap = true
  getGame().clearRollResult()
}
