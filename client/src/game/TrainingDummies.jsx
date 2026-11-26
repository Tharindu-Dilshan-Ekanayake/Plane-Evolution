import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three'

import { TRAIN_INTERVAL } from '@shared/balance'
import { DUMMY_BASE, dummySpot, PAD_COUNT, padAt, padDir, PAD_YAWS } from '@shared/world'

import { sfx } from '../audio/sfx'
import { remotePlayers } from '../net/remotePlayers'
import { getGame } from '../store/game'
import { getQuality } from '../store/quality'
import { BlockSet, disposeBlocks } from './blocks'
import { CLICK_CONTACT, clicks } from './clickSwing'
import { burst } from './fx/fxQueue'
import { sharedMaterials, STYLE } from './materials'
import { CAGE_CONTACT } from './playerPose'
import { runtime } from './runtime'
import { swordTrailLook } from './swordTrails'
import { swordLength } from './swords'

/**
 * The training dummies (the template's batting cages): one on each pad's platform at
 * dummySpot, built of chunky blocks - a straw dummy, a wooden one, a stone golem, an iron
 * knight in a plumed helm, crystal and diamond golems with glowing cores, a galaxy titan in
 * a gold crown and, in Dragonfire Peaks, a magma golem and a horned inferno titan with a
 * head of fire. Each hangs on a spring: slash it (you, training there, or anyone else) and
 * it rocks back and squashes, shudders and swings upright again, a spray of sparks
 * flying off the cut.
 *
 * Every slash also leaves a crescent of light where the blade went - the sword's own glow
 * colour, bright at its leading edge, gone in a blink - for training slashes and click
 * slashes alike (SlashArcs, below).
 *
 * All nine dummies are one BlockSet (one draw call); each frame only the dummies that are
 * still moving are re-placed. The arcs are one instanced mesh (one draw call). Nothing is
 * allocated per frame.
 */

/** A dummy's boxes, in its own frame: facing -X, at the player training on its pad. */
const PART = {
  BASE: 0,
  POST: 1,
  BODY: 2,
  BELT: 3,
  HEAD: 4,
  ARMS: 5,
  HAND_L: 6,
  HAND_R: 7,
  FACE: 8,
  HAT: 9,
  TARGET: 10,
  CORE: 11,
  CREST: 12,
}
const PARTS = 13

/** Where each part sits and how big it is: [x, y, z, sx, sy, sz] above the platform. */
const LAYOUT = [
  [0, 0.06, 0, 0.9, 0.12, 0.9],
  [0, 0.6, 0, 0.22, 1.0, 0.22],
  [0, 1.38, 0, 0.62, 0.86, 0.76],
  [0, 1.02, 0, 0.66, 0.12, 0.8],
  [0, 2.06, 0, 0.5, 0.5, 0.5],
  [0, 1.58, 0, 0.26, 0.22, 1.56],
  [0, 1.58, 0.86, 0.3, 0.32, 0.18],
  [0, 1.58, -0.86, 0.3, 0.32, 0.18],
  [-0.26, 2.08, 0, 0.03, 0.12, 0.32],
  [0, 2.38, 0, 0.58, 0.14, 0.58],
  [-0.32, 1.4, 0, 0.03, 0.36, 0.36],
  [-0.33, 1.4, 0, 0.03, 0.16, 0.16],
  [0, 2.58, 0, 0.12, 0.3, 0.42],
]

/**
 * Each pad's dummy: its colours and styles per part, [colour, style] (null: left out),
 * and how springy it is.
 */
const S = STYLE
const DUMMIES = [
  // Straw Dummy: straw body and head under a straw hat, a red-and-white target.
  { parts: { BASE: ['#8a5a2b', S.SMOOTH], POST: ['#8a5a2b', S.SMOOTH], BODY: ['#e8c35a', S.STUDS], BELT: ['#a0743a', S.SMOOTH], HEAD: ['#e6cc8e', S.STUDS], ARMS: ['#a06a35', S.SMOOTH], HAND_L: ['#e8c35a', S.STUDS], HAND_R: ['#e8c35a', S.STUDS], FACE: ['#3a2a1a', S.SMOOTH], HAT: ['#d8b04a', S.STUDS], TARGET: ['#ffffff', S.SMOOTH], CORE: ['#e0262f', S.SMOOTH] }, give: 1.25 },
  // Wooden Dummy: carved wood bound with iron bands.
  { parts: { BASE: ['#6a4426', S.SMOOTH], POST: ['#6a4426', S.SMOOTH], BODY: ['#b07840', S.STUDS], BELT: ['#6c7380', S.PLATE], HEAD: ['#c08850', S.STUDS], ARMS: ['#8a5a2b', S.SMOOTH], HAND_L: ['#6c7380', S.PLATE], HAND_R: ['#6c7380', S.PLATE], FACE: ['#2a1a0e', S.SMOOTH], TARGET: ['#ffffff', S.SMOOTH], CORE: ['#2f8ff2', S.SMOOTH] }, give: 1.05 },
  // Stone Golem: mossy grey stone with glowing amber eyes.
  { parts: { BASE: ['#6f747c', S.STUDS], POST: ['#7d838c', S.STUDS], BODY: ['#8f949c', S.STUDS], BELT: ['#4fae3a', S.STUDS], HEAD: ['#9aa0a8', S.STUDS], ARMS: ['#7d838c', S.STUDS], HAND_L: ['#8f949c', S.STUDS], HAND_R: ['#8f949c', S.STUDS], FACE: ['#ffb12a', S.GLOW], HAT: ['#4fae3a', S.STUDS], CORE: ['#ffb12a', S.GLOW] }, give: 0.75 },
  // Iron Knight: plate armour, a dark visor and a red plume.
  { parts: { BASE: ['#4a4f58', S.SMOOTH], POST: ['#5a606a', S.SMOOTH], BODY: ['#c9d0da', S.PLATE], BELT: ['#7a4a26', S.SMOOTH], HEAD: ['#d6dce6', S.PLATE], ARMS: ['#aab2be', S.PLATE], HAND_L: ['#2f5fd0', S.SMOOTH], HAND_R: ['#c9d0da', S.PLATE], FACE: ['#1a1d24', S.SMOOTH], CREST: ['#e0262f', S.SMOOTH], TARGET: ['#2f5fd0', S.SMOOTH], CORE: ['#ffd21f', S.SMOOTH] }, give: 0.7 },
  // Crystal Golem: ice-blue crystal round a pink glowing core.
  { parts: { BASE: ['#5a6aa8', S.SMOOTH], POST: ['#7fb2ff', S.SMOOTH], BODY: ['#9fe6ff', S.SMOOTH], BELT: ['#c08bff', S.GLOW], HEAD: ['#bff4ff', S.SMOOTH], ARMS: ['#7fd2ff', S.SMOOTH], HAND_L: ['#c08bff', S.GLOW], HAND_R: ['#c08bff', S.GLOW], FACE: ['#ffffff', S.GLOW], CORE: ['#ff5fd2', S.GLOW], CREST: ['#c08bff', S.GLOW] }, give: 0.65 },
  // Diamond Golem (VERY OP!): faceted diamond, a cyan core.
  { parts: { BASE: ['#3a4a6a', S.PLATE], POST: ['#bff4ff', S.PLATE], BODY: ['#e8fbff', S.PLATE], BELT: ['#3fd8ff', S.GLOW], HEAD: ['#f4fdff', S.PLATE], ARMS: ['#bff4ff', S.PLATE], HAND_L: ['#3fd8ff', S.GLOW], HAND_R: ['#3fd8ff', S.GLOW], FACE: ['#3fd8ff', S.GLOW], CORE: ['#3fd8ff', S.GLOW], CREST: ['#ffffff', S.GLOW] }, give: 0.6 },
  // Galaxy Titan (BEST OVERALL!): a body of stars in a gold crown.
  { parts: { BASE: ['#1a1240', S.GALAXY], POST: ['#2a1a5a', S.GALAXY], BODY: ['#140a33', S.GALAXY], BELT: ['#ffd21f', S.GLOW], HEAD: ['#1a0e40', S.GALAXY], ARMS: ['#24145a', S.GALAXY], HAND_L: ['#a46bff', S.GLOW], HAND_R: ['#a46bff', S.GLOW], FACE: ['#ffffff', S.GLOW], HAT: ['#ffd21f', S.GLOW], CORE: ['#a46bff', S.GLOW], CREST: ['#ffd21f', S.GLOW] }, give: 0.55 },
  // Magma Golem: cracked lava rock, glowing from inside.
  { parts: { BASE: ['#2a1a14', S.SMOOTH], POST: ['#3a2018', S.LAVA], BODY: ['#3a1a10', S.LAVA], BELT: ['#ff7a1a', S.GLOW], HEAD: ['#3a1a10', S.LAVA], ARMS: ['#2a140c', S.LAVA], HAND_L: ['#3a1a10', S.LAVA], HAND_R: ['#3a1a10', S.LAVA], FACE: ['#ffd21f', S.GLOW], CORE: ['#ff5a14', S.GLOW] }, give: 0.6 },
  // Inferno Titan: obsidian with a head of fire and a pair of horns.
  { parts: { BASE: ['#1a1220', S.SMOOTH], POST: ['#241a2c', S.SMOOTH], BODY: ['#2a1420', S.LAVA], BELT: ['#ffd21f', S.GLOW], HEAD: ['#ff6a1e', S.GLOW], ARMS: ['#1a1220', S.LAVA], HAND_L: ['#ff3b0a', S.GLOW], HAND_R: ['#ff3b0a', S.GLOW], FACE: ['#ffe27a', S.GLOW], HAT: ['#1a1220', S.SMOOTH], CORE: ['#ff3b0a', S.GLOW], CREST: ['#ffd27a', S.GLOW] }, give: 0.55 },
]

/** The spring every dummy hangs on: how stiff, how damped, how hard a slash knocks it (rad/s). */
const STIFF = 90
const DAMP = 7
const KNOCK = 3.2
/** Sparks per slash, on presets with particles. */
const SPARKS = 8

const _m = new Matrix4()
const _local = new Matrix4()
const _pivot = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()
const ZERO = new Matrix4().makeScale(0, 0, 0)
const PART_NAMES = Object.keys(PART)

/**
 * Each dummy's spot (on its platform, out beyond its pad: shared/world dummySpot) and its
 * turn about the vertical so its front (-X) faces back in at the pad, and the way out
 * (where a slash knocks it): made once.
 */
const SPOTS = Array.from({ length: PAD_COUNT }, (_, i) => dummySpot(i))
const OUT = Array.from({ length: PAD_COUNT }, (_, i) => padDir(i))
const TURNS = OUT.map((d) => Math.atan2(-d.z, d.x))
const _turnQ = new Quaternion()
const _yAxis = new Vector3(0, 1, 0)

function createDummies() {
  const set = new BlockSet()
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const look = DUMMIES[i] || DUMMIES[0]
    for (let k = 0; k < PARTS; k += 1) {
      const paint = look.parts[PART_NAMES[k]]
      // Colours and styles here; every part is placed (turned to face its pad) just below.
      // Parts a dummy doesn't have are kept, shrunk to nothing.
      set.add(0, 0, 0, 0, 0, 0, paint ? paint[0] : '#000000', paint ? paint[1] : S.SMOOTH)
    }
  }
  const mesh = set.build(sharedMaterials().blocks)
  for (let i = 0; i < PAD_COUNT; i += 1) placeDummy(mesh, i, 0, 0, 1)
  mesh.instanceMatrix.needsUpdate = true
  // Bounds from where they really stand, padded for their rocking.
  mesh.computeBoundingSphere()
  mesh.boundingSphere.radius += 1.5
  mesh.castShadow = true
  return mesh
}

/** Places dummy `i`'s parts, rocked back (away from its pad) `lean` radians, twisted `twist` and squashed `squash`. */
function placeDummy(mesh, i, lean, twist, squash) {
  const look = DUMMIES[i] || DUMMIES[0]
  const spot = SPOTS[i]
  _q.setFromEuler(_e.set(0, twist, -lean)).premultiply(_turnQ.setFromAxisAngle(_yAxis, TURNS[i]))
  _pivot.compose(_p.set(spot.x, DUMMY_BASE, spot.z), _q, _s.set(1, 1, 1))
  for (let k = 0; k < PARTS; k += 1) {
    const index = i * PARTS + k
    if (!look.parts[PART_NAMES[k]]) {
      mesh.setMatrixAt(index, ZERO)
      continue
    }
    const [x, y, z, sx, sy, sz] = LAYOUT[k]
    // Above the post the body squashes down and bulges out, then springs back.
    const above = k !== PART.BASE && k !== PART.POST
    const yy = above ? 1.0 + (y - 1.0) * squash : y
    const wide = above ? 1 / Math.sqrt(squash) : 1
    _local.compose(_p.set(x, yy, z), _q.identity(), _s.set(sx * wide, sy * (above ? squash : 1), sz * wide))
    mesh.setMatrixAt(index, _m.multiplyMatrices(_pivot, _local))
  }
}

// --- The slash arcs -------------------------------------------------------------------

const ARCS = 6
const ARC_SEGMENTS = 18
const ARC_LIFE = 0.24
/** The arc sweeps this far either side of the cut's middle (radians). */
const ARC_HALF = 1.15

/** A crescent strip: `aArc` is (along 0-1 from the tail to the leading edge, across 0-1 from the hilt out). */
function createArcGeometry() {
  const positions = []
  const arcs = []
  const index = []
  for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
    const f = i / ARC_SEGMENTS
    const a = -ARC_HALF + f * ARC_HALF * 2
    for (let j = 0; j < 2; j += 1) {
      // Unit circle, scaled per arc by the instance matrix; inner edge at 0.45.
      const r = j ? 1 : 0.45
      positions.push(Math.cos(a) * r, Math.sin(a) * r, 0)
      arcs.push(f, j)
    }
    if (i < ARC_SEGMENTS) {
      const b = i * 2
      index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setAttribute('aArc', new BufferAttribute(new Float32Array(arcs), 2))
  g.setIndex(index)
  return g
}

const arcVertex = /* glsl */ `
  attribute vec2 aArc;
  attribute float aAge;
  varying vec2 vArc;
  varying float vAge;
  varying vec3 vColor;
  void main() {
    vArc = aArc;
    vAge = aAge;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const arcFragment = /* glsl */ `
  varying vec2 vArc;
  varying float vAge;
  varying vec3 vColor;
  void main() {
    // Sweeping on: the leading edge races ahead, the tail fading out behind it.
    float head = clamp(vAge / 0.07, 0.0, 1.0);
    float along = smoothstep(head - 0.75, head, vArc.x) * (1.0 - smoothstep(head, head + 0.02, vArc.x));
    float across = smoothstep(0.0, 0.5, vArc.y) * (1.0 - smoothstep(0.85, 1.0, vArc.y));
    float fade = 1.0 - smoothstep(0.08, ${ARC_LIFE.toFixed(2)}, vAge);
    float a = along * across * fade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.45 * across), a);
    #include <colorspace_fragment>
  }
`

function createArcs() {
  const geometry = createArcGeometry()
  const age = new InstancedBufferAttribute(new Float32Array(ARCS).fill(99), 1)
  geometry.setAttribute('aAge', age)
  const material = new ShaderMaterial({
    vertexShader: arcVertex,
    fragmentShader: arcFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  const mesh = new InstancedMesh(geometry, material, ARCS)
  for (let i = 0; i < ARCS; i += 1) {
    mesh.setMatrixAt(i, ZERO)
    mesh.setColorAt(i, new Color('#ffffff'))
  }
  mesh.frustumCulled = false
  mesh.renderOrder = 3
  return mesh
}

/**
 * The plane a cut sweeps through, in character space (facing +Z): roughly upright in front
 * of you, tilted from high right to low left - its x axis the cut's middle (straight
 * ahead), its y axis the way the blade travels (to your left, for a forehand).
 */
const ARC_X = new Vector3(0.05, -0.06, 1).normalize()
const ARC_Z = new Vector3(0.38, -0.19, -0.9).normalize()
const ARC_Y = new Vector3().crossVectors(ARC_Z, ARC_X).normalize()
const ARC_BASIS = new Matrix4().makeBasis(ARC_X, ARC_Y, new Vector3().crossVectors(ARC_X, ARC_Y))
/** The backhand rises the other way: the same plane, mirrored. */
const ARC_BASIS_BACK = new Matrix4().makeBasis(ARC_X, ARC_Y.clone().negate(), new Vector3().crossVectors(ARC_X, ARC_Y).negate())
const _arcAt = new Matrix4()
const _turn = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _tint = new Color()

/** Character-space shoulder height the arcs circle round. */
const ARC_CENTRE = new Vector3(0, 1.38, 0.15)
const _centre = new Vector3()

export default function TrainingDummies() {
  const dummyRef = useRef(null)
  const arcRef = useRef(null)
  const assets = useMemo(() => ({ dummies: createDummies(), arcs: createArcs() }), [])
  /** Each dummy's spring: lean and its speed, twist and its speed, squash age. */
  const springs = useRef(Array.from({ length: PAD_COUNT }, () => ({ lean: 0, v: 0, twist: 0, tv: 0, hitAt: -9, moving: false })))
  /** Your last training phase, and other players' (their own clocks), by session id. */
  const phases = useRef({ mine: -1, others: new Map(), click: 0 })
  const nextArc = useRef(0)

  useEffect(
    () => () => {
      disposeBlocks(assets.dummies)
      assets.arcs.geometry.dispose()
      assets.arcs.material.dispose()
      assets.arcs.dispose()
    },
    [assets],
  )

  /** A slash landing on dummy `pad` (or, with pad -1, a click slash in the air). */
  const strike = (pad, now, x, y, z, yaw, swordId, back, local) => {
    if (pad >= 0) {
      const sp = springs.current[pad]
      const give = (DUMMIES[pad] || DUMMIES[0]).give
      sp.v += KNOCK * give
      sp.tv += (back ? -1 : 1) * 1.6 * give
      sp.hitAt = now
      sp.moving = true
      const spot = SPOTS[pad]
      const out = OUT[pad]
      if (getQuality().particles) burst({ x: spot.x - out.x * 0.35, y: DUMMY_BASE + 1.45, z: spot.z - out.z * 0.35, count: SPARKS, palette: 'power', speed: 5 })
      if (local) sfx.slashHit(pad)
    }
    // The crescent where the blade went.
    const arcs = arcRef.current
    if (!arcs) return
    const slot = nextArc.current
    nextArc.current = (slot + 1) % ARCS
    const len = swordLength(swordId)
    const radius = 0.5 + len * 1.05
    _turn.setFromAxisAngle(_up, yaw)
    _centre.copy(ARC_CENTRE).applyQuaternion(_turn)
    _arcAt.makeRotationFromQuaternion(_turn).multiply(back ? ARC_BASIS_BACK : ARC_BASIS)
    _arcAt.scale(_s.set(radius, radius, radius))
    _arcAt.setPosition(x + _centre.x, y + _centre.y, z + _centre.z)
    arcs.setMatrixAt(slot, _arcAt)
    // In the sword's own trail colour (swordTrails.js).
    arcs.setColorAt(slot, _tint.copy(swordTrailLook(swordId).head))
    arcs.geometry.getAttribute('aAge').setX(slot, 0)
    arcs.instanceMatrix.needsUpdate = true
    arcs.instanceColor.needsUpdate = true
  }

  useFrame((_state, rawDelta) => {
    const dummies = dummyRef.current
    const arcs = arcRef.current
    if (!dummies || !arcs) return
    const dt = Math.min(rawDelta, 0.05)
    const now = performance.now()
    const ph = phases.current
    const myId = getGame().profile.equippedTire

    // Your slashes: one landing each time your training phase passes CAGE_CONTACT.
    const cage = runtime.player.cage
    if (cage >= 0 && runtime.player.cagePhase >= 0) {
      const turns = runtime.player.cagePhase / (Math.PI * 2)
      if (ph.mine >= 0 && Math.floor(turns - CAGE_CONTACT) > Math.floor(ph.mine - CAGE_CONTACT)) {
        const p = runtime.player.position
        strike(cage, now, p.x, p.y, p.z, PAD_YAWS[cage], myId, Math.floor(turns) % 2 === 1, true)
      }
      ph.mine = turns
    } else {
      ph.mine = -1
    }

    // Your click slashes: the arc as the blade cuts.
    const c = clicks[0]
    if (c.at && c.at !== ph.click && now - c.at >= CLICK_CONTACT * 1000) {
      ph.click = c.at
      strike(-1, now, c.x, c.y, c.z, c.yaw, myId, false, true)
    }

    // Everyone else training: their slashes on their own clock (you can't see their phase).
    const others = ph.others
    for (const r of remotePlayers.values()) {
      const pad = r.anim === 'run' ? padAt(r.position.x, r.position.z, 0.6) : -1
      if (pad < 0) {
        others.delete(r.sessionId)
        continue
      }
      const prev = others.get(r.sessionId) ?? 0
      const turns = prev + dt / TRAIN_INTERVAL
      if (Math.floor(turns - CAGE_CONTACT) > Math.floor(prev - CAGE_CONTACT)) {
        strike(pad, now, r.position.x, r.position.y, r.position.z, PAD_YAWS[pad], r.tireId || 'bicycle', Math.floor(turns) % 2 === 1, false)
      }
      others.set(r.sessionId, turns)
    }
    if (others.size > remotePlayers.size) for (const sid of others.keys()) if (!remotePlayers.has(sid)) others.delete(sid)

    // The springs: only the dummies still moving are re-placed.
    let dirty = false
    for (let i = 0; i < PAD_COUNT; i += 1) {
      const sp = springs.current[i]
      if (!sp.moving) continue
      sp.v += (-STIFF * sp.lean - DAMP * sp.v) * dt
      sp.lean += sp.v * dt
      sp.tv += (-STIFF * 0.6 * sp.twist - DAMP * sp.tv) * dt
      sp.twist += sp.tv * dt
      const since = (now - sp.hitAt) / 1000
      const squash = since < 0.3 ? 1 - 0.14 * Math.sin((since / 0.3) * Math.PI) * Math.exp(-since * 4) : 1
      placeDummy(dummies, i, sp.lean, sp.twist, squash)
      dirty = true
      if (since > 0.4 && Math.abs(sp.lean) < 0.002 && Math.abs(sp.v) < 0.01 && Math.abs(sp.twist) < 0.002) {
        sp.moving = false
        sp.lean = sp.v = sp.twist = sp.tv = 0
        placeDummy(dummies, i, 0, 0, 1)
      }
    }
    if (dirty) dummies.instanceMatrix.needsUpdate = true

    // The arcs age and fade.
    const ages = arcs.geometry.getAttribute('aAge')
    let live = false
    for (let i = 0; i < ARCS; i += 1) {
      const a = ages.getX(i)
      if (a > ARC_LIFE) continue
      ages.setX(i, a + dt)
      live = true
    }
    ages.needsUpdate = live
    // Drawn only while one is live - but never hidden, so its shader is compiled with the rest.
    arcs.count = live ? ARCS : 0
  })

  return (
    <>
      <primitive ref={dummyRef} object={assets.dummies} />
      <primitive ref={arcRef} object={assets.arcs} />
    </>
  )
}
