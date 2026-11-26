import { CHARGE_TIME, chargeAt } from '@shared/balance'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'

/**
 * Your turn on a throw spot, before the authority hears about it (the template's launch
 * state: the file and the object keep their names).
 *
 * Step onto the THROW STAGE and you're up to throw (`gripping`), your sword ready on your
 * shoulder - anywhere on it: walk along it to pick your line down the road. HOLD THROW (the
 * button, Space / E, or press and hold on the game) and you wind up, planted, facing down
 * the valley: the sword draws back over your head and the throw meter charges
 * (shared/balance.js chargeAt), then wobbles at the top. Let go and the throw is sent
 * (net/actions.roll) with the meter as it stood; your arm whips over and the sword leaves
 * your hand, and the authority's answer plays the flight (roll/rollControl.beginRoll).
 * Auto Throw winds up and lets go by itself, a plain throw every time.
 *
 * Plain module state, written by the THROW button, the keys and the player and read every
 * frame by the avatar, the camera and the meter - never React state, never per-frame
 * network traffic.
 */
export const launch = {
  /** Up on the throw stage (and not mid-throw). */
  gripping: false,
  /** Template leftover (the old throw spots); nothing reads it now. */
  station: 4,
  /** Throwing by itself (Auto Throw): a plain throw every wind-up. */
  auto: false,
  /** Template leftover: stepping on no longer moves you anywhere. */
  snap: false,
  /** Where you stood when you let go (the flight starts from there: roll/rollControl). */
  fromX: 0,
  fromY: 0,
  fromZ: 0,
  /** 'ready' (sword on your shoulder) | 'charge' (THROW held: winding up). */
  stage: 'ready',
  /** performance.now() THROW was pressed (the wind-up's start). */
  chargeStart: 0,
  /** The throw meter now (0-1). */
  charge: 0,
  /** Each wind-up's number, 0 before the first. */
  toss: 0,
  /** performance.now() you became ready to throw (Auto Throw waits a beat). */
  readySince: 0,
  /** Let go and waiting for the authority: when, and how full the meter was. */
  released: false,
  releasedAt: 0,
  accuracy: 0,
  /** performance.now() of your last release, for the throw pose (0: none yet). */
  swungAt: 0,
  /** Template leftovers (stepping onto a throw spot): unused. */
  stepInAt: 0,
  chargeAfter: false,
}

/** No answer this long after letting go (off the spot, busy): give up on that throw. */
const RELEASE_TIMEOUT_MS = 1500
/** Auto Throw winds up this long after it's ready, and lets go at full charge. */
const AUTO_DELAY_MS = 700
/** A wind-up let go this soon is no throw at all: a tap just readies you. */
const MIN_CHARGE_MS = 90

function ready(now) {
  launch.stage = 'ready'
  launch.readySince = now
  launch.charge = 0
}

/** Up on the throw stage (`auto`: Auto Throw throws for you). */
export function grab(auto = false, now = performance.now()) {
  launch.gripping = true
  launch.auto = auto
  launch.released = false
  ready(now)
}

/** Template leftover: there's no stepping in now (the stage is yours to stand anywhere on). */
export const wantsStepIn = () => false

function startCharge(now) {
  launch.stage = 'charge'
  launch.chargeStart = now
  launch.charge = 0
  launch.toss += 1
  sfx.chargeStart()
}

/** Seconds THROW has been held this wind-up (0 when not winding up). */
export const heldFor = (now = performance.now()) => (launch.stage === 'charge' ? Math.max(0, (now - launch.chargeStart) / 1000) : 0)

/**
 * How far into the wind-up you are at `now` (0-1): the camera leans in and the body coils
 * with it. Full once the meter is full (it wobbles from there).
 */
export function slowAt(now = performance.now()) {
  if (launch.stage !== 'charge' || launch.released || !launch.gripping) return 0
  return Math.min(1, heldFor(now) / CHARGE_TIME)
}

/**
 * Moves the turn on to `now`: the meter while you hold THROW, a throw the authority never
 * answered, Auto Throw's wind-up and release. Called every frame by the player while on the
 * stage. Returns 'auto' when Auto Throw just let go (send a plain throw), else undefined.
 */
export function updatePull(now) {
  if (launch.released && now - launch.releasedAt > RELEASE_TIMEOUT_MS) {
    // The authority never answered (busy, off the spot): ready again.
    launch.released = false
    ready(now)
  }
  if (!launch.gripping || launch.released) return undefined
  if (launch.stage === 'ready') {
    launch.charge = 0
    if (launch.auto && now - launch.readySince > AUTO_DELAY_MS) startCharge(now)
    return undefined
  }
  launch.charge = chargeAt(heldFor(now))
  // Auto Throw lets go as the meter fills: a plain throw (no meter sent).
  if (launch.auto && heldFor(now) >= CHARGE_TIME) {
    letGoAt(now, launch.charge)
    return 'auto'
  }
  return undefined
}

/** Where you're standing, for the flight to start from (set by the player every frame on the stage). */
export function standAt(x, y, z) {
  launch.fromX = x
  launch.fromY = y
  launch.fromZ = z
}

function letGoAt(now, meter) {
  launch.released = true
  launch.releasedAt = now
  launch.swungAt = now
  launch.accuracy = meter
  launch.charge = meter
  launch.stage = 'ready'
}

/**
 * Presses THROW (the HUD button, Space / E, a press on the game): on the stage, starts the
 * wind-up. Returns 'charge', or undefined when it did nothing (off the stage, mid-throw).
 */
export function pressThrow(now = performance.now()) {
  if (!launch.gripping || launch.released || launch.stage === 'charge' || launch.auto) return undefined
  startCharge(now)
  return 'charge'
}

/**
 * Lets go of THROW: the throw goes to the authority with the meter as it stood. Returns
 * the meter sent, or undefined when there was no wind-up to let go of.
 */
export function releaseThrow(now = performance.now()) {
  if (!launch.gripping || launch.released || launch.stage !== 'charge' || launch.auto) return undefined
  if (now - launch.chargeStart < MIN_CHARGE_MS) {
    // A tap: no throw, just back to ready (the button says HOLD).
    ready(now)
    sfx.chargeCancel()
    return undefined
  }
  const meter = chargeAt(heldFor(now))
  letGoAt(now, meter)
  sfx.throwRelease(meter)
  actions.roll(Math.round(meter * 1000) / 1000)
  return meter
}

/** The template's names for pressing the action button: kept for their callers. */
export const pressSwing = pressThrow
export const pressHit = pressThrow
export const letGo = releaseThrow

/** The authority's throw has started from your release: it takes it from here. */
export function consumePull() {
  launch.gripping = false
  launch.auto = false
  launch.released = false
  launch.charge = 0
  launch.stage = 'ready'
}

/** Off the throw stage (walked off it, jumped, a panel opened). */
export function cancelPull() {
  if (launch.stage === 'charge') sfx.chargeCancel()
  launch.gripping = false
  launch.auto = false
  launch.released = false
  launch.charge = 0
  launch.stage = 'ready'
}

/** Whether you're up on the stage at all: ready, winding up, or let go and waiting for the answer. */
export const isPulling = () => launch.gripping || launch.released
