import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { getBloxityState } from '../bloxity/store'

import { isPulling, launch, slowAt } from './launch'
import { placeLocalBubble } from './remote/nameplates'
import { runtime } from './runtime'

/** How high above the player's feet the camera aims. */
const LOOK_HEIGHT = 1.6

const MIN_DISTANCE = 4
const MAX_DISTANCE = 26

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the ground.
const MIN_PITCH = -0.05
const MAX_PITCH = 1.2

const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.007
const ZOOM_SENSITIVITY = 0.012

// Higher = snappier. Framerate-independent via the exp() smoothing below.
const POSITION_SMOOTHING = 10
const LOOK_SMOOTHING = 14

const _desired = new Vector3()
const _target = new Vector3()
const _batTarget = new Vector3()
/** How far the view has swung round to the throw view (0-1), and into the wind-up, eased. */
let batView = 0
let slowView = 0
/**
 * Up on the throw stage you can still look around like anywhere else: the first drag or zoom
 * there hands the camera back to your own orbit (`userLook`), and it stays yours until you
 * step off. (Winding up and the throw itself always use the throw view, then it gives the
 * view back.) Plain module state, read every frame.
 */
let userLook = false
let lookView = 0
/**
 * The throw view: low behind you and over your right shoulder, looking up the long valley
 * road your sword is about to fly down - you in the lower third, the road, its first gates
 * and the sky ahead filling the rest, clear of the HUD. On a narrow screen held upright it
 * sits a little further back so all of you fits. It breathes a little while you wait
 * (`drift`); as you wind up it pushes in and drops a touch (`slow`), into the throw.
 */
const BAT_VIEW = {
  /** What it looks at, from where you stand on the stage (x: on a wide screen; narrowX upright). */
  offset: new Vector3(0.45, 2.0, -2.6),
  narrowX: 0.2,
  yaw: 0.24,
  pitch: 0.22,
  distance: 9.2,
  narrowDistance: 10.8,
  drift: 0.015,
  slow: { distance: -1.1, height: -0.25, yaw: 0.06 },
}

/**
 * Third-person orbit camera around the player.
 *
 * Mouse: drag (either button) orbits, wheel zooms. Touch: one-finger drag orbits (the
 * joystick owns the left side of the screen as a separate element), pinch zooms.
 *
 * Orbit state lives in `runtime.camera`, so the roll can hand the camera
 * back exactly where it took it from. Drag speed is scaled by the player's Boxity
 * camera_sensitivity setting. Also places your own chat bubble each frame, once the
 * camera has moved (it needs the final camera to project).
 */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const lookAt = useRef(new Vector3())
  const initialised = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return undefined

    /** pointerId -> last { x, y } */
    const pointers = new Map()
    let pinchDistance = 0

    const orbit = runtime.camera

    const onPointerDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onPointerMove = (e) => {
      const last = pointers.get(e.pointerId)
      if (!last) return

      if (pointers.size >= 2) {
        last.x = e.clientX
        last.y = e.clientY
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (isPulling()) userLook = true
        orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance - (d - pinchDistance) * 0.04))
        pinchDistance = d
        return
      }

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      if (isPulling() && Math.abs(dx) + Math.abs(dy) > 1) userLook = true
      last.x = e.clientX
      last.y = e.clientY
      const sensitivity =
        (e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY) * getBloxityState().cameraSensitivity
      orbit.yaw -= dx * sensitivity
      orbit.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbit.pitch + dy * sensitivity))
    }

    const endDrag = (e) => {
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      if (isPulling()) userLook = true
      orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, rawDelta) => {
    if (runtime.camera.mode !== 'follow') {
      // Whoever owns the camera now is moving it; pick up smoothly when it's handed back.
      lookAt.current.copy(runtime.player.position).setY(runtime.player.position.y + LOOK_HEIGHT)
      placeLocalBubble(camera, state.size.width, state.size.height)
      return
    }
    const delta = Math.min(rawDelta, 0.05)
    const p = runtime.player.position
    // Up on the throw stage: swing round to the throw view (BAT_VIEW).
    const pulling = isPulling()
    if (!pulling) userLook = false
    // Free look on the stage, except while winding up / throwing (the throw view frames it).
    const winding = launch.stage === 'charge' || launch.released
    const wantLook = userLook && !winding ? 1 : 0
    lookView += (wantLook - lookView) * (1 - Math.exp(-6 * delta))
    const want = pulling ? 1 - lookView : 0
    batView += (want - batView) * (1 - Math.exp(-5 * delta))
    slowView += (slowAt() - slowView) * (1 - Math.exp(-4 * delta))
    const b = batView * batView * (3 - 2 * batView)
    const sv = slowView * b
    // Wide screens look a little to your right; narrow upright ones straight past you.
    const wide = Math.min(1, Math.max(0, (state.size.width / Math.max(1, state.size.height) - 0.6) / 1.1))
    // Wherever you stand on the stage: the view walks along it with you.
    _batTarget.set(p.x, p.y + BAT_VIEW.slow.height * sv, p.z).add(BAT_VIEW.offset)
    _batTarget.x += (BAT_VIEW.narrowX - BAT_VIEW.offset.x) * (1 - wide)
    _target.set(p.x, p.y + LOOK_HEIGHT, p.z).lerp(_batTarget, b)

    // Spherical -> cartesian. yaw 0 puts the camera south of the player, looking north.
    const drift = Math.sin(performance.now() * 0.0004) * BAT_VIEW.drift * b * (1 - sv)
    const yaw = runtime.camera.yaw + (BAT_VIEW.yaw - runtime.camera.yaw) * b + BAT_VIEW.slow.yaw * sv + drift
    const pitch = runtime.camera.pitch + (BAT_VIEW.pitch - runtime.camera.pitch) * b
    const viewDistance = BAT_VIEW.narrowDistance + (BAT_VIEW.distance - BAT_VIEW.narrowDistance) * wide
    const distance = runtime.camera.distance + (viewDistance - runtime.camera.distance) * b + BAT_VIEW.slow.distance * sv
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      Math.max(_target.y + Math.sin(pitch) * distance, 0.6),
      _target.z + Math.cos(yaw) * horizontal,
    )

    // After a slide the camera is far down the hill; jump back rather than swoop.
    if (runtime.camera.snap) {
      runtime.camera.snap = false
      initialised.current = false
    }

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the default camera started.
      camera.position.copy(_desired)
      lookAt.current.copy(_target)
      initialised.current = true
    }

    camera.position.lerp(_desired, 1 - Math.exp(-POSITION_SMOOTHING * delta))
    lookAt.current.lerp(_target, 1 - Math.exp(-LOOK_SMOOTHING * delta))
    camera.lookAt(lookAt.current)
    camera.updateMatrixWorld()
    placeLocalBubble(camera, state.size.width, state.size.height)
  })

  return null
}

export default FollowCamera
