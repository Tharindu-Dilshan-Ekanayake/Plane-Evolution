import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three'

import { CHARGE_TIME } from '@shared/balance'

import { getGame } from '../store/game'
import { getQuality } from '../store/quality'
import { heldFor, launch } from './launch'
import { runtime } from './runtime'
import { swordTrailLook } from './swordTrails'

/**
 * Winding up a throw: motes of light in your sword's own trail colours (swordTrails.js)
 * streaming in from all round you and gathering on the blade drawn back behind your head -
 * faster and thicker as the meter fills, a steady blaze of them once it's full. Your own
 * throws only (other players' wind-ups are just the pose).
 *
 * One pool of camera-facing twinkles (the trail's own look), one draw call, drawn only
 * while you wind up; left out on presets without particles. Nothing allocated per frame.
 */

const MOTES = 48
/** Seconds a mote takes to fly in, and how far out it starts. */
const LIFE = 0.5
const REACH = 1.9
/** A second's worth of motes at the start of the wind-up, and at full charge. */
const RATE_FROM = 18
const RATE_FULL = 70

/**
 * Where the blade is gathered, from the player's feet in character space (facing +Z, left
 * +X): behind and above the right shoulder, the sword drawn back (playerPose THROW_KEYS[0]).
 */
const FOCUS = new Vector3(-0.3, 1.95, -0.75)

const vertex = /* glsl */ `
  attribute float aFade;
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vec3 centre = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float size = length(instanceMatrix[0].xyz);
    vec4 mv = modelViewMatrix * vec4(centre, 1.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    vColor = instanceColor;
    vUv = uv;
    vFade = aFade;
  }
`
const fragment = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float spot = 1.0 - smoothstep(0.0, 0.4, length(p));
    float rays = (1.0 - smoothstep(0.0, 0.08, abs(p.x))) * (1.0 - smoothstep(0.2, 1.0, abs(p.y)))
      + (1.0 - smoothstep(0.0, 0.08, abs(p.y))) * (1.0 - smoothstep(0.2, 1.0, abs(p.x)));
    float alpha = clamp(spot + rays * 0.7, 0.0, 1.0) * vFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), spot * 0.55), alpha);
    #include <colorspace_fragment>
  }
`

const _m = new Matrix4()
const _q = new Quaternion()
const _s = new Vector3()
const _p = new Vector3()
const _focus = new Vector3()
const _up = new Vector3(0, 1, 0)
const ZERO = new Matrix4().makeScale(0, 0, 0)
const WHITE = new Color('#ffffff')

export default function ChargeFX() {
  const ref = useRef(null)
  /** Each mote's flight, made once on mount (a ref: rewritten every frame). */
  const motesRef = useRef(null)
  const state = useRef({ owed: 0, next: 0 })
  const mesh = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1)
    geometry.setAttribute('aFade', new InstancedBufferAttribute(new Float32Array(MOTES), 1))
    const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending: AdditiveBlending })
    const m = new InstancedMesh(geometry, material, MOTES)
    // Coloured once, so the colour attribute exists before the shader compiles.
    for (let i = 0; i < MOTES; i += 1) {
      m.setMatrixAt(i, ZERO)
      m.setColorAt(i, WHITE)
    }
    m.frustumCulled = false
    m.renderOrder = 6
    m.count = 0
    return m
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  // The motes' pool, made once here (never in the frame loop).
  useEffect(() => {
    motesRef.current = Array.from({ length: MOTES }, () => ({ life: 0, from: new Vector3(), size: 0.1 }))
    return () => {
      motesRef.current = null
    }
  }, [])

  useFrame((_frame, rawDelta) => {
    const m = ref.current
    const motes = motesRef.current
    if (!m || !motes) return
    const delta = Math.min(rawDelta, 0.05)
    const st = state.current
    const winding = launch.stage === 'charge' && launch.gripping && !launch.released && getQuality().particles
    // The blade's place in the world: the focus turned with the player.
    const player = runtime.player
    _q.setFromAxisAngle(_up, player.yaw)
    _focus.copy(FOCUS).applyQuaternion(_q).add(player.position)

    if (winding) {
      const look = swordTrailLook(getGame().profile.equippedTire)
      const colors = look.colors
      const full = Math.min(1, heldFor() / CHARGE_TIME)
      st.owed += delta * (RATE_FROM + (RATE_FULL - RATE_FROM) * full)
      while (st.owed >= 1) {
        st.owed -= 1
        const i = st.next
        st.next = (st.next + 1) % MOTES
        const mote = motes[i]
        mote.life = LIFE * (0.7 + Math.random() * 0.5)
        // From a random point on a sphere round the blade (never from under the floor).
        _p.set(Math.random() - 0.5, Math.random() * 0.8 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(REACH * (0.7 + Math.random() * 0.5))
        mote.from.copy(_p)
        mote.size = 0.09 + Math.random() * 0.1 + full * 0.05
        const pick = i % 3 === 0 ? look.head : colors ? colors[i % colors.length] : i % 3 === 1 ? look.tail : look.head
        m.setColorAt(i, pick)
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    } else {
      st.owed = 0
    }

    const fades = m.geometry.getAttribute('aFade')
    let alive = false
    for (let i = 0; i < MOTES; i += 1) {
      const mote = motes[i]
      if (mote.life <= 0) continue
      mote.life -= delta
      if (mote.life <= 0 || !winding) {
        // Let go (or stepped off): whatever's still flying in vanishes with the throw.
        mote.life = 0
        m.setMatrixAt(i, ZERO)
        fades.setX(i, 0)
        continue
      }
      alive = true
      // Flying in, faster as it nears: the gap closes on an ease-in curve.
      const k = mote.life / LIFE
      _p.copy(mote.from).multiplyScalar(k * k).add(_focus)
      _s.setScalar(mote.size * (0.5 + k))
      m.setMatrixAt(i, _m.compose(_p, _q.identity(), _s))
      fades.setX(i, Math.min(1, (1 - k) * 3) * 0.9)
    }
    m.count = alive ? MOTES : 0
    if (alive) {
      m.instanceMatrix.needsUpdate = true
      fades.needsUpdate = true
    }
  })

  return <primitive ref={ref} object={mesh} />
}
