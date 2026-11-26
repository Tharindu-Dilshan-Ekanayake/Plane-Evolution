import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three'

import { ROLL_RECOVERY } from '@shared/balance'

import { getQuality } from '../../store/quality'
import { enchantAura } from '../enchants'
import { runtime } from '../runtime'
import { createSwordMesh, getSwordGeometry } from '../swords'
import { swordScale } from '../playerPose'
import { createRideState, KICK_HIT, laneFor, rideState, SWORD_SCALE } from './path'
import { advanceRoll, roll } from './rollControl'

/** Your sword and up to eight other players'. */
const MAX_SWORDS = 9
/** Seconds after leaving your hand the sword takes to grow to its full flying size. */
const GROW_S = 0.3
/** The aura shell round an enchanted sword: this much bigger, pulsing between these opacities. */
const AURA_GROW = 1.07
const AURA_MIN = 0.22
const AURA_MAX = 0.5

const _q = new Quaternion()
const _qr = new Quaternion()
const _v = new Vector3()
const _ax = new Vector3(1, 0, 0)
const _az = new Vector3(0, 0, 1)

/**
 * Places one sword (and its aura) from a ride state: turned end over end by its spin about
 * the sideways axis and leaned by its roll, its middle (`centerY` up the blade) on the
 * state's position - growing from its size in your hand to SWORD_SCALE as it leaves (`flown`
 * seconds ago), so the flying blade is huge and reads from far down the valley.
 */
function placeSword(slot, st, id, ballId, centerY, now, auraOn, len, flown) {
  const { sword, aura } = slot
  sword.setSword(id)
  _qr.setFromAxisAngle(_az, st.roll || 0)
  _q.setFromAxisAngle(_ax, st.spin).premultiply(_qr)
  const g = Math.min(1, Math.max(0, flown / GROW_S))
  const hand = swordScale(len)
  const s = hand + (SWORD_SCALE - hand) * g * g * (3 - 2 * g)
  _v.set(0, centerY * s, 0).applyQuaternion(_q)
  sword.position.copy(st.position).sub(_v)
  sword.quaternion.copy(_q)
  sword.scale.setScalar(s)
  sword.visible = true
  const color = auraOn ? enchantAura(ballId) : null
  if (!color) {
    aura.visible = false
    return
  }
  aura.geometry = sword.geometry
  aura.material.color.copy(color)
  aura.material.opacity = AURA_MIN + (AURA_MAX - AURA_MIN) * (0.5 + 0.5 * Math.sin(now * 0.012))
  const a = s * AURA_GROW
  _v.set(0, centerY * a, 0).applyQuaternion(_q)
  aura.position.copy(st.position).sub(_v)
  aura.quaternion.copy(_q)
  aura.scale.setScalar(a)
  aura.visible = true
}

/**
 * Every sword out on the road: yours (the throw playing in rollControl) and other
 * players', replayed from their throws' numbers down their own lines (runtime.ghostRolls)
 * - spinning end over end as they fly, then stuck point-first in the road, quivering, until
 * the throw is over. Each drawn as the sword it is (swords.js: one shared material), an
 * enchanted one wrapped in its aura's glow (an inverted shell, additive). Nothing is drawn
 * while no sword is out; nothing is allocated while they fly. Your sword casts a blob
 * shadow on presets without realtime ones.
 */
export default function SwordFlight() {
  const groupRef = useRef(null)
  /** Ride states for other players' swords, by session id. */
  const ghosts = useRef(new Map())
  /** Spare ride states, made up front: a new player's throw never allocates mid-frame. */
  const spare = useRef(Array.from({ length: MAX_SWORDS }, () => createRideState()))
  const shadowRef = useRef(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)

  const slots = useMemo(() => {
    const group = new Group()
    const list = Array.from({ length: MAX_SWORDS }, () => {
      const sword = createSwordMesh()
      sword.visible = false
      const aura = new Mesh(
        getSwordGeometry('bicycle'),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: AURA_MIN, blending: AdditiveBlending, depthWrite: false, side: BackSide }),
      )
      aura.visible = false
      aura.frustumCulled = false
      aura.renderOrder = 2
      group.add(sword, aura)
      return { sword, aura }
    })
    // Reached from the frame loop through the group (its ref), never this memo.
    group.userData.list = list
    return { group, list }
  }, [])

  // The aura's shader compiled now, while the road loads, not on the first enchanted
  // throw: shown just long enough to be gathered (compile only takes what's visible).
  useEffect(() => {
    const group = groupRef.current
    if (import.meta.env.DEV || !group) return
    const { aura } = group.userData.list[0]
    aura.visible = true
    group.visible = true
    gl.compileAsync?.(group, camera, scene)?.catch(() => null)
    aura.visible = false
  }, [gl, camera, scene])

  useEffect(() => {
    const shadow = { position: new Vector3(), size: 0.9, visible: false }
    shadowRef.current = shadow
    runtime.shadowCasters.add(shadow)
    return () => {
      runtime.shadowCasters.delete(shadow)
      // The swords' geometry and material are shared (swords.js); the auras' materials are ours.
      for (const { aura } of slots.list) aura.material.dispose()
    }
  }, [slots])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const list = group.userData.list
    const now = performance.now()
    const shadow = shadowRef.current
    const others = getQuality().particles
    let count = 0

    if (roll.active) {
      advanceRoll(state.clock.elapsedTime)
      if (roll.phase !== 'launch') {
        placeSword(list[0], roll, roll.tireId, roll.ballId, roll.centerY, now, true, roll.len, (now - roll.startedAt - roll.lag) / 1000 - KICK_HIT)
        count = 1
      }
      if (shadow) {
        shadow.visible = roll.phase !== 'launch'
        shadow.position.set(roll.position.x, 0, roll.position.z)
        shadow.size = roll.stuck ? 0.8 : 0.6 + Math.min(0.8, roll.air * 0.02)
      }
    } else if (shadow) {
      shadow.visible = false
    }

    for (const [sid, ghost] of runtime.ghostRolls) {
      const elapsed = (now - ghost.startedAt) / 1000
      if (elapsed > ghost.duration + ROLL_RECOVERY + 1) continue
      let st = ghosts.current.get(sid)
      if (!st) {
        st = spare.current.pop()
        if (!st) continue
        ghosts.current.set(sid, st)
      }
      rideState(elapsed, ghost, Number.isFinite(ghost.lane) ? ghost.lane : laneFor(sid), st)
      if (count >= MAX_SWORDS) break
      if (st.phase === 'launch') continue
      // Other players' auras only where there's power to spare (not on LOW).
      placeSword(list[count], st, ghost.tireId || 'bicycle', ghost.ballId || 'plain', Number.isFinite(ghost.centerY) ? ghost.centerY : 0.55, now, others, ghost.len || 1.4, elapsed - KICK_HIT)
      count += 1
    }
    // Forget the ones that are over (their states back to the spares).
    for (const [sid, st] of ghosts.current) {
      if (runtime.ghostRolls.has(sid)) continue
      ghosts.current.delete(sid)
      spare.current.push(st)
    }

    for (let i = count; i < MAX_SWORDS; i += 1) {
      list[i].sword.visible = false
      list[i].aura.visible = false
    }
    group.visible = count > 0
  })

  return <primitive ref={groupRef} object={slots.group} />
}
