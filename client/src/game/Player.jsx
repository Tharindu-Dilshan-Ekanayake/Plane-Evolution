import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { CHARGE_TIME } from '@shared/balance'
import { isPadUnlocked } from '@shared/logic'
import { BATTER_YAW, cageBatterSpot, clampToWalkable, groundHeightAt, inRollZone, PAD_COUNT, padAt, PAD_YAWS, STATIC_COLLIDERS, THROW_STAGE } from '@shared/world'

import { sfx } from '../audio/sfx'
import { getGame } from '../store/game'
import ErrorBoundary from '../ui/ErrorBoundary'
import { CLICK_PLANT_S, CLICK_POSE_S, sinceClick, tapSwing } from './clickSwing'
import FallbackAvatar from './FallbackAvatar'
import PlayerAvatar from './PlayerAvatar'
import { RUN_CADENCE } from './kick'
import { actions } from '../net/actions'
import { cancelPull, grab, heldFor, isPulling, launch, pressThrow, releaseThrow, slowAt, standAt, updatePull } from './launch'
import { BODY } from './playerPose'
import { swordLength } from './swords'
import { roll } from './roll/rollControl'
import { runtime } from './runtime'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
const RADIUS = 0.45

const WALK_SPEED = 10.875
const ACCELERATION = 16
const GRAVITY = 32
const JUMP_SPEED = 10.5
/** Ledges up to this high are walked straight onto (the showroom's back stage). */
const STEP_UP = 1.05
/** How long the throw's pose plays (seconds) while waiting for the authority's answer. */
const THROW_POSE_S = 0.95
/** Each pad's training spot and the way you face there (shared/world), made once: nothing per frame. */
const TRAIN_SPOTS = Array.from({ length: PAD_COUNT }, (_, i) => cageBatterSpot(i))
/** On the stage's top (not just beside it at its foot). */
const ON_STAGE_Y = THROW_STAGE.height - 0.05
/** A press on the 3D view this short (ms) and this still (px) is a click, not a camera drag. */
const TAP_MS = 350
const TAP_PX = 10

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }
const _pivot = new Vector3()

/** Pushes a circle out of an axis-aligned rect. Returns true on contact. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return false

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const push = (RADIUS - d) / d
    pos.x += dx * push
    pos.z += dz * push
    return true
  }

  // Centre inside the rect (spawned in, or a wall appeared on top of us): leave by the
  // nearest side.
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
  return true
}

/**
 * The local player: a kinematic character controller.
 *
 * No physics engine: the world is flat ground, a few raised floors and a list of
 * rectangular walls, which a circle-vs-rect push-out handles exactly. That saves the
 * ~2 MB Rapier WASM download and keeps the active rigid body count at zero.
 *
 * Walk onto a throw spot in the THROW ZONE and you step up to throw (launch.js): facing
 * down the valley, your sword on your shoulder. HOLD THROW - the button, Space / E, or
 * press and hold on the game - to wind up, and let go to throw (RollButton shows the
 * meter); the throw plays here. The flight itself is the sword's, not yours (roll/): you
 * stay on your spot, watching it go, then celebrate. Push the stick to step off. At a
 * training dummy you step onto its training spot and slash it again and again. Walking
 * about, your sword rides across your back.
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 *
 * @param {{ onAvatarReady?: () => void }} props
 */
export function Player({ onAvatarReady }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(new Vector3())
  const vy = useRef(0)
  /** The jump input last frame: on a throw spot, holding it winds up a throw. */
  const jumpHeld = useRef(false)
  /** Space pressed on a throw spot (so letting go of it throws). */
  const jumpWound = useRef(false)

  // A press on the 3D view (not on the HUD, which sits above it): on a throw spot, press
  // and hold to wind up a throw, let go to throw; anywhere else a quick click or tap (not
  // a drag to turn the camera) is a click slash (clickSwing.js) for Power.
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const downs = new Map()
    const onDown = (e) => {
      downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button })
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (isPulling() && !roll.active && !getGame().panel) pressThrow()
    }
    const onUp = (e) => {
      const d = downs.get(e.pointerId)
      downs.delete(e.pointerId)
      if (!d || (e.pointerType === 'mouse' && d.button !== 0)) return
      if (launch.stage === 'charge') {
        releaseThrow()
        return
      }
      if (performance.now() - d.t < TAP_MS && Math.hypot(e.clientX - d.x, e.clientY - d.y) < TAP_PX) tapSwing()
    }
    const onCancel = (e) => {
      downs.delete(e.pointerId)
      if (launch.stage === 'charge' && downs.size === 0) releaseThrow()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [gl])

  /** Handed to the avatar so it can pose itself. A ref: written every frame. */
  const motionRef = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: WALK_SPEED,
    vy: 0,
    stride: 0,
    bat: undefined,
    swingT: 0,
    coil: 0,
    strain: 0,
    great: false,
    swordLen: 1.3,
  })

  // The blob shadow follows the character.
  const shownAt = useMemo(() => new Vector3().copy(runtime.player.position), [])
  useEffect(() => {
    const caster = { position: shownAt, size: 1.1 }
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [shownAt])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const now = performance.now()
    const player = runtime.player
    const pos = player.position
    const k = keys.current
    const joy = runtime.input
    const motion = motionRef.current
    const game = getGame()
    const profile = game.profile
    motion.time += delta

    const group = groupRef.current
    const visual = visualRef.current

    // --- The throw stage: up on it, winding up, off it ----------------------------
    // Anywhere on the stage's top you're up to throw; walk along it to pick your line.
    const onStage = inRollZone(pos.x, pos.z) && player.grounded && pos.y >= ON_STAGE_Y
    if (!roll.active && !isPulling() && onStage && !player.frozen && !game.panel) {
      grab(false, now)
      sfx.stepIn()
    }
    // Walked off it (or moved off it some other way: a correction, a portal).
    if (!roll.active && isPulling() && !launch.released && !onStage) cancelPull()
    const atBat = !roll.active && isPulling()
    // Winding up or throwing: planted, facing down the valley.
    const winding = atBat && (launch.stage === 'charge' || launch.released)
    if (atBat) standAt(pos.x, pos.y, pos.z)

    // --- Input, relative to the camera ----------------------------------------
    _input.set(0, 0, 0)
    const still = player.frozen
    if (!still) {
      _input.set(
        (k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX,
        0,
        (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY,
      )
    }
    let inputLength = Math.min(1, _input.length())

    if (atBat) {
      // Auto Throw follows its toggle, even mid-turn.
      launch.auto = false
      // The meter, a throw the authority never answered, Auto Throw's release.
      if (updatePull(now) === 'auto') {
        sfx.throwRelease(1)
        actions.roll()
      }
      // Winding up you stand your ground; otherwise walk the stage freely.
      if (winding || launch.stage === 'charge') inputLength = 0
    }

    if (inputLength > 0.02) {
      _input.normalize()
      // Flatten the camera's forward onto the ground plane so "up" always means
      // "away from the camera".
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()
        .multiplyScalar(WALK_SPEED * inputLength)
    } else {
      _move.set(0, 0, 0)
    }
    // A click slash plants you for a moment while you cut.
    const clicking = sinceClick(now) < CLICK_PLANT_S
    const planted = winding || launch.stage === 'charge' || roll.active || clicking

    // Ease towards the target velocity: crisp, but no instant 0->max snaps.
    const blend = 1 - Math.exp(-ACCELERATION * delta)
    velocity.current.lerp(_move, blend)
    if (planted) velocity.current.set(0, 0, 0)

    // --- Horizontal move + collision --------------------------------------------
    const prevX = pos.x
    const prevZ = pos.z
    pos.x += velocity.current.x * delta
    pos.z += velocity.current.z * delta

    // At a dummy, standing still: ease onto its training spot to slash it.
    const pad = padAt(pos.x, pos.z)
    const speedNow = Math.hypot(velocity.current.x, velocity.current.z)
    const training = pad >= 0 && player.grounded && speedNow < 0.5 && !still && !planted && isPadUnlocked(profile, pad)
    if (training) {
      const ease = 1 - Math.exp(-10 * delta)
      pos.x += (TRAIN_SPOTS[pad].x - pos.x) * ease
      pos.z += (TRAIN_SPOTS[pad].z - pos.z) * ease
    }

    for (const rect of STATIC_COLLIDERS) pushOut(pos, rect)
    for (const rect of runtime.dynamicColliders) pushOut(pos, rect)
    clampToWalkable(pos.x, pos.z, _clamped)
    pos.x = _clamped.x
    pos.z = _clamped.z

    // A ledge too tall to step onto acts as a wall.
    let floor = groundHeightAt(pos.x, pos.z)
    if (floor - pos.y > STEP_UP) {
      pos.x = prevX
      pos.z = prevZ
      floor = groundHeightAt(pos.x, pos.z)
    }

    // --- Vertical ---------------------------------------------------------------
    const jumpInput = k.jump || joy.jump
    const pressed = jumpInput && !jumpHeld.current
    jumpHeld.current = jumpInput
    // On the throw stage, the jump button (Space) winds up a throw instead: hold, let go.
    if (pressed && atBat && isPulling()) pressThrow(now)
    if (!jumpInput && launch.stage === 'charge' && jumpWound.current) releaseThrow(now)
    jumpWound.current = jumpInput && atBat ? jumpWound.current || pressed : false
    const wantJump = !still && !roll.active && !atBat && jumpInput
    if (wantJump && player.grounded) {
      vy.current = JUMP_SPEED
      player.grounded = false
      sfx.jump()
    }
    vy.current -= GRAVITY * delta
    pos.y += vy.current * delta

    if (pos.y <= floor) {
      // Coming down from a jump (not just stepping off a kerb) lands with a thump.
      if (!player.grounded && vy.current < -5) sfx.jumpLand()
      pos.y = floor
      vy.current = 0
      player.grounded = true
    } else if (pos.y - floor > 0.05) {
      // Walked off a ledge, or still rising from a jump.
      player.grounded = false
    }

    // --- Facing -----------------------------------------------------------------
    const speed = Math.hypot(velocity.current.x, velocity.current.z)
    const batting = winding || launch.stage === 'charge' || roll.active
    if (training) player.yaw = PAD_YAWS[pad]
    else if (batting) player.yaw = BATTER_YAW
    else if (speed > 0.3) player.yaw = Math.atan2(velocity.current.x, velocity.current.z)

    // --- The sword: ready on your shoulder, winding up, throwing, watching it fly ---
    motion.bat = undefined
    motion.cheer = 0
    motion.coil = 0
    motion.strain = 0
    motion.swordLen = swordLength(profile.equippedTire)
    const sinceSwing = (now - launch.swungAt) / 1000
    if (roll.active) {
      motion.bat = 'after'
      motion.swingT = Math.max(0, sinceSwing)
      motion.great = roll.hit === 'perfect' || roll.hit === 'great'
    } else if (atBat && launch.released && sinceSwing < THROW_POSE_S) {
      motion.bat = 'throw'
      motion.swingT = sinceSwing
    } else if (atBat && (launch.stage === 'charge' || speed < 0.3)) {
      // Ready on the stage, sword on your shoulder - winding up as THROW is held, straining
      // once the meter is full. (Walking along the stage, it rides on your back.)
      motion.bat = 'ready'
      motion.coil = slowAt(now)
      motion.strain = Math.min(1, Math.max(0, (heldFor(now) - CHARGE_TIME) / 0.6))
    } else if (!training && sinceClick(now) < CLICK_POSE_S) {
      // A click slash: one cut through the air in front of you.
      motion.bat = 'slash'
      motion.swingT = sinceClick(now)
    }

    // A pose pinned from the ?debug console (window.__pp.runtime.debugPose), for checking
    // the animation frame by frame. Never set in normal play.
    if (runtime.debugPose) Object.assign(motion, runtime.debugPose)

    // --- Where the body is ------------------------------------------------------
    // Step-ups ease in over a few frames on the visual only; the logical position snaps
    // so collision and triggers stay exact.
    const shownY = group ? group.position.y : pos.y
    const steppingUp = player.grounded && pos.y > shownY
    const y = steppingUp ? shownY + (pos.y - shownY) * Math.min(1, delta * 18) : pos.y
    _pivot.set(pos.x, y + BODY.pivot, pos.z)
    if (visual) {
      _targetQuat.setFromAxisAngle(_up, player.yaw)
      visual.quaternion.slerp(_targetQuat, batting ? 1 - Math.pow(0.00001, delta) : 1 - Math.pow(0.0005, delta))
    }
    if (group) group.position.set(_pivot.x, _pivot.y - BODY.pivot, _pivot.z)
    shownAt.set(_pivot.x, pos.y, _pivot.z)

    // --- Publish motion ---------------------------------------------------------
    player.speed = speed
    // What other players see: 'pull' is winding up a throw on the stage (the template's
    // name), 'run' slashing a dummy, 'swing' a click slash.
    player.anim = !player.grounded ? 'jump' : batting ? 'pull' : training ? 'run' : motion.bat === 'slash' ? 'swing' : speed > 0.5 ? 'walk' : 'idle'

    motion.speed = speed
    motion.grounded = player.grounded
    motion.vy = vy.current
    // At a dummy: a slash every TRAIN_INTERVAL (playerPose, `run`).
    motion.run = training ? 1 : 0
    motion.stride += delta * (training ? RUN_CADENCE : 5 + 6 * Math.min(1, speed / WALK_SPEED))
    runtime.player.cagePhase = training ? motion.stride : -1
    runtime.player.cage = training ? pad : -1
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} onReady={onAvatarReady} />}>
          <Suspense fallback={<FallbackAvatar motionRef={motionRef} />}>
            <PlayerAvatar onReady={onAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
          </Suspense>
        </ErrorBoundary>
      </group>
    </group>
  )
}

export default Player
