import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three'

import { RARITIES, TIRES } from '@shared/balance'
import {
  SWORD_COLUMN_PITCH,
  SWORD_COLUMNS,
  SWORD_COUNTER,
  SWORD_TIER_BASE,
  SWORD_TIER_HEIGHT,
  SWORD_TIERS,
  SWORD_UP,
  SWORD_WALL,
  SWORD_WALL_TOP,
  TIRE_STANDS,
} from '@shared/world'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { createGlowInstances, disposeGlow } from '../glow'
import { standLabelSpec, standState } from '../labels/lobbyLabels'
import { updateWorldLabel } from '../labels/registry'
import { sharedMaterials, STYLE } from '../materials'
import { venueOf } from '../sceneStyle'
import { createSwordShowcase, disposeSwordShowcase, getSwordGeometry, swordTrail } from '../swords'
import {
  CORNICE,
  COUNTER_SIGN,
  END_PILLAR,
  frameBottom,
  frameTop,
  LEDGE,
  NICHE_BACK,
  NICHE_WIDTH,
  nicheCeiling,
  PANEL_FRONT,
  PILLAR,
  PLATE,
  PLATE_FRONT,
  WALL_FACE,
} from './swordWall'

/**
 * How big each sword hangs: scaled towards TARGET metres tall (so the early, short swords
 * still read from across the courtyard), never under MIN nor over MAX times its size, and
 * never taller than TALLEST - which fits its niche: its middle SWORD_UP over the niche's
 * floor, its foot clear of the plate below, its tip under the ledge above.
 */
const SWORD_FIT = { target: 2.7, min: 1.15, max: 1.75, tallest: 3.3 }

function swordHeight(id) {
  const geometry = getSwordGeometry(id)
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  return geometry.boundingBox.max.y - geometry.boundingBox.min.y
}

function shownScale(id) {
  const h = swordHeight(id)
  return Math.min(SWORD_FIT.tallest / h, Math.max(SWORD_FIT.min, Math.min(SWORD_FIT.max, SWORD_FIT.target / h)))
}

/** Each niche's state colours: its glowing frame, its back panel, its halo. */
const NEXT = new Color('#7dff4a')
const GOLD = new Color('#ffd21f')
const DIM = new Color('#1c2030')
const PANEL_DARK = new Color('#10162a')
const PANEL_LOCKED = new Color('#0c0f18')

function nicheLooks(tire) {
  const rarity = new Color(RARITIES[tire.rarity]?.color ?? '#ffffff')
  return {
    frame: { equipped: GOLD, owned: rarity, buy: NEXT, locked: rarity.clone().lerp(DIM, 0.72) },
    panel: {
      equipped: GOLD.clone().lerp(PANEL_DARK, 0.78),
      owned: rarity.clone().lerp(PANEL_DARK, 0.84),
      buy: NEXT.clone().lerp(PANEL_DARK, 0.76),
      locked: PANEL_LOCKED,
    },
    halo: { equipped: GOLD, owned: rarity, buy: NEXT, locked: rarity.clone().multiplyScalar(0.22) },
  }
}

/** The niches' recolourable blocks come first: TIRE_STANDS.length back panels, then FRAME_STRIPS a niche. */
const FRAME_STRIPS = 4
const frameIndex = (stand, k) => TIRE_STANDS.length + stand.index * FRAME_STRIPS + k

/**
 * The Sword Wall (shared/world SWORD_WALL, SHOP its footprint), all in one block set - one
 * draw call. Front (west) to back (swordWall.js): a stone body SWORD_WALL_TOP tall; pillars
 * between the columns, a glowing gem on each at every tier; a ledge under each tier above
 * the first and a cornice over the last, gold-lined; merlons and two end turrets along the
 * top (the SWORD SHOP crown sign is the world's - structures.js buildShop). In each niche a
 * back panel and a glowing frame (recoloured by state - see nicheLooks), and under the sword
 * its name plate: a dark block with gold edges, its lettering a flat world label
 * (lobbyLabels). Then the SWORD COUNTER's dais: stone, a gold rune ring and crossed swords
 * inlaid on top, and a low sign board along its east edge.
 */
function buildWall(c, shop) {
  const set = new BlockSet()
  const { minZ, maxZ } = SWORD_WALL
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const backX = SWORD_WALL.x + SWORD_WALL.depth

  // Recolourable first (their instance index is known): back panels, then frames.
  for (const s of TIRE_STANDS) {
    const lo = s.floor
    const hi = nicheCeiling(s)
    set.add((PANEL_FRONT + NICHE_BACK) / 2, (lo + hi) / 2, s.z, NICHE_BACK - PANEL_FRONT, hi - lo, NICHE_WIDTH, PANEL_DARK, STYLE.SMOOTH)
  }
  const fx = PANEL_FRONT - 0.075
  const hw = NICHE_WIDTH / 2 - 0.14
  for (const s of TIRE_STANDS) {
    const lo = frameBottom(s)
    const hi = frameTop(s)
    set.add(fx, hi, s.z, 0.15, 0.12, 2 * hw + 0.12, '#ffffff', STYLE.GLOW)
    set.add(fx, lo, s.z, 0.15, 0.12, 2 * hw + 0.12, '#ffffff', STYLE.GLOW)
    set.add(fx, (lo + hi) / 2, s.z - hw, 0.15, hi - lo, 0.12, '#ffffff', STYLE.GLOW)
    set.add(fx, (lo + hi) / 2, s.z + hw, 0.15, hi - lo, 0.12, '#ffffff', STYLE.GLOW)
  }

  // The body, its face the niches' back; the base course along its foot.
  set.addOn((NICHE_BACK + backX) / 2, 0, midZ, backX - NICHE_BACK, SWORD_WALL_TOP, length, c.stone[1], STYLE.STUDS)
  set.addOn((WALL_FACE - 0.1 + NICHE_BACK) / 2, 0, midZ, NICHE_BACK - WALL_FACE + 0.1, SWORD_TIER_BASE, length + END_PILLAR, c.dark, STYLE.STUDS)
  set.add(WALL_FACE - 0.12, SWORD_TIER_BASE - 0.06, midZ, 0.05, 0.08, length + END_PILLAR, c.trim, STYLE.GLOW)

  // Pillars, a gem on each at every tier's sword height.
  const pillarTop = SWORD_WALL_TOP - CORNICE
  for (let k = 0; k <= SWORD_COLUMNS; k += 1) {
    const z = minZ + k * SWORD_COLUMN_PITCH
    const end = k === 0 || k === SWORD_COLUMNS
    set.addOn((WALL_FACE + NICHE_BACK) / 2, SWORD_TIER_BASE, z, NICHE_BACK - WALL_FACE, pillarTop - SWORD_TIER_BASE, end ? END_PILLAR : PILLAR, c.stone[0], STYLE.STUDS)
    for (let t = 0; t < SWORD_TIERS; t += 1) {
      set.add(WALL_FACE - 0.04, SWORD_TIER_BASE + t * SWORD_TIER_HEIGHT + SWORD_UP, z, 0.28, 0.28, 0.28, c.glow, STYLE.GLOW, Math.PI / 4)
    }
  }

  // A ledge under each tier above the first, its front gold-lined; the cornice over the last.
  const ledgeFront = WALL_FACE - 0.45
  for (let t = 1; t < SWORD_TIERS; t += 1) {
    const floor = SWORD_TIER_BASE + t * SWORD_TIER_HEIGHT
    set.addOn((ledgeFront + NICHE_BACK) / 2, floor - LEDGE, midZ, NICHE_BACK - ledgeFront, LEDGE, length + 2 * END_PILLAR, c.cap, STYLE.SMOOTH)
    set.add(ledgeFront - 0.02, floor - LEDGE / 2, midZ, 0.05, 0.09, length + 2 * END_PILLAR, c.trim, STYLE.GLOW)
  }
  const corniceFront = WALL_FACE - 0.7
  set.addOn((corniceFront + NICHE_BACK) / 2, pillarTop, midZ, NICHE_BACK - corniceFront, CORNICE, length + 2 * END_PILLAR + 0.4, c.cap, STYLE.SMOOTH)
  set.add(corniceFront - 0.02, pillarTop + CORNICE / 2, midZ, 0.05, 0.12, length + 2 * END_PILLAR + 0.4, c.trim, STYLE.GLOW)

  // Merlons along the top's front edge, leaving the middle to the crown sign; a turret at each end.
  for (let z = minZ + 1.8; z <= maxZ - 1.79; z += SWORD_COLUMN_PITCH / 2) {
    if (z > 1.5 && z < 28.5) continue
    set.addOn(WALL_FACE + 0.3, SWORD_WALL_TOP, z, 0.9, 1.0, 1.1, c.stone[0], STYLE.STUDS)
  }
  for (const z of [minZ, maxZ]) {
    const tx = (WALL_FACE + backX) / 2
    set.addOn(tx, SWORD_WALL_TOP, z, backX - WALL_FACE + 0.2, 3.4, 2.6, c.stone[0], STYLE.STUDS)
    set.addOn(tx, SWORD_WALL_TOP + 3.4, z, backX - WALL_FACE + 0.6, 0.4, 3.0, c.cap, STYLE.SMOOTH)
    for (const dz of [-0.95, 0.95]) set.addOn(WALL_FACE + 0.2, SWORD_WALL_TOP + 3.8, z + dz, 0.6, 0.7, 0.6, c.stone[0], STYLE.STUDS)
    set.add(tx, SWORD_WALL_TOP + 4.6, z, 0.5, 0.5, 0.5, c.glow, STYLE.GLOW, Math.PI / 4)
  }

  // Each niche's name plate: a dark block, gold-edged top and bottom.
  for (const s of TIRE_STANDS) {
    set.add((PLATE_FRONT + PANEL_FRONT) / 2, s.plateY, s.z, PANEL_FRONT - PLATE_FRONT, PLATE.height, PLATE.width, shop.panel, STYLE.SMOOTH)
    for (const side of [-1, 1]) {
      set.add(PLATE_FRONT - 0.02, s.plateY + side * (PLATE.height / 2 - 0.035), s.z, 0.05, 0.07, PLATE.width, c.trim, STYLE.GLOW)
    }
  }

  buildCounter(set, c, shop)
  return set.build(sharedMaterials().blocks)
}

/**
 * The SWORD COUNTER (shared/world SWORD_COUNTER, counterRect): a stone dais exactly its
 * walkable height, a dark inlay on top with a ring of glowing gold runes and crossed
 * swords in it, gold-lined edges, and a low sign board along the east (wall) edge.
 * Nothing on it stands over 1.2 m: from the courtyard it never hides a name plate.
 */
function buildCounter(set, c, shop) {
  const { x, z, half, height } = SWORD_COUNTER
  const top = height
  set.addOn(x, 0, z, half * 2, top - 0.02, half * 2, c.stone[2], STYLE.STUDS)
  set.addOn(x, top - 0.02, z, half * 2 - 0.4, 0.02, half * 2 - 0.4, shop.panel, STYLE.SMOOTH)
  // Gold edges round the top.
  for (const side of [-1, 1]) {
    set.add(x + side * (half - 0.08), top - 0.03, z, 0.16, 0.06, half * 2, c.trim, STYLE.GLOW)
    set.add(x, top - 0.03, z + side * (half - 0.08), half * 2 - 0.32, 0.06, 0.16, c.trim, STYLE.GLOW)
  }
  // The rune ring: short glowing bars round a circle, each along it.
  const RUNES = 16
  const r = half - 0.85
  for (let k = 0; k < RUNES; k += 1) {
    const a = (k / RUNES) * Math.PI * 2
    set.add(x + Math.cos(a) * r, top + 0.012, z + Math.sin(a) * r, 0.62, 0.025, k % 2 ? 0.12 : 0.18, c.trim, STYLE.GLOW, -a - Math.PI / 2)
  }
  // Crossed swords in the ring, and a gem where they cross.
  // (One a hair over the other: no shared plane where they cross.)
  set.add(x, top + 0.014, z, 2.6, 0.025, 0.14, '#ffffff', STYLE.GLOW, Math.PI / 4)
  set.add(x, top + 0.02, z, 2.6, 0.025, 0.14, '#ffffff', STYLE.GLOW, -Math.PI / 4)
  set.add(x, top + 0.03, z, 0.34, 0.06, 0.34, c.glow, STYLE.GLOW, Math.PI / 4)
  // The sign board, gold-framed (its lettering: lobbyLabels, flat in front of it).
  const { x: sx, depth, bottom, top: signTop, width } = COUNTER_SIGN
  set.addOn(sx, bottom, z, depth, signTop - bottom, width, shop.band, STYLE.SMOOTH)
  set.addOn(sx - 0.03, bottom + 0.06, z, depth, signTop - bottom - 0.12, width - 0.12, shop.panel, STYLE.SMOOTH)
  set.add(sx - depth / 2 - 0.04, signTop - 0.04, z, 0.06, 0.07, width, c.trim, STYLE.GLOW)
  for (const side of [-1, 1]) set.add(sx - depth / 2 - 0.04, (bottom + signTop) / 2, z + side * (width / 2 - 0.04), 0.06, signTop - bottom, 0.07, c.trim, STYLE.GLOW)
}

/**
 * The Sword Wall's middle, and how near the camera must be to draw its swords and halos:
 * LOW, then the rest - from anywhere in the courtyard; they're dropped once the camera's
 * off down the road after a throw (and frustum-culled whenever they're out of view).
 */
const WALL_MID = { x: SWORD_WALL.x, z: (SWORD_WALL.minZ + SWORD_WALL.maxZ) / 2 }
const SHOWCASE_RANGE = [95, 140]
/** The halos sit just in front of each niche's back panel, behind its sword. */
const HALO_X = PANEL_FRONT - 0.12

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()

// --- Sparkles round the rarest swords -----------------------------------------------------

/**
 * Twinkles of light drifting up round the Mythic, Secret and Legend swords (RARITIES
 * order 5 up: the wall's last twenty niches), each in its sword's own colour - twice as
 * many round a Legend sword. One pool of camera-facing stars, one additive draw call,
 * only on presets with particles and only near the wall; nothing allocated per frame.
 */
const SPARKLES = 72
const SPARKLE_RATE = 26
const SPARKLE_LIFE = [0.9, 1.7]
const SPARKLE_SIZE = [0.2, 0.42]
const WHITE = new Color('#ffffff')
const ZERO = new Matrix4().makeScale(0, 0, 0)

const sparkleVertex = /* glsl */ `
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
const sparkleFragment = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float spot = 1.0 - smoothstep(0.0, 0.35, length(p));
    float rays = (1.0 - smoothstep(0.0, 0.07, abs(p.x))) * (1.0 - smoothstep(0.15, 1.0, abs(p.y)))
      + (1.0 - smoothstep(0.0, 0.07, abs(p.y))) * (1.0 - smoothstep(0.15, 1.0, abs(p.x)));
    float alpha = clamp(spot + rays * 0.8, 0.0, 1.0) * vFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), spot * 0.6), alpha);
    #include <colorspace_fragment>
  }
`

function createSparkles() {
  const geometry = new PlaneGeometry(1, 1)
  geometry.setAttribute('aFade', new InstancedBufferAttribute(new Float32Array(SPARKLES), 1))
  const material = new ShaderMaterial({ vertexShader: sparkleVertex, fragmentShader: sparkleFragment, transparent: true, depthWrite: false, blending: AdditiveBlending })
  const mesh = new InstancedMesh(geometry, material, SPARKLES)
  // Coloured once, so the colour attribute exists before the shader compiles.
  for (let i = 0; i < SPARKLES; i += 1) {
    mesh.setMatrixAt(i, ZERO)
    mesh.setColorAt(i, WHITE)
  }
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  mesh.visible = false
  return mesh
}

/** The niches that sparkle (a Legend's twice), and each one's sparkle colour. */
function sparkleEmitters() {
  const list = []
  for (const stand of TIRE_STANDS) {
    const order = RARITIES[TIRES[stand.index].rarity]?.order ?? 0
    if (order < 5) continue
    list.push(stand.index)
    if (order >= 7) list.push(stand.index)
  }
  const tints = TIRES.map((tire) => swordTrail(tire.id).clone().lerp(WHITE, 0.35))
  return { list, tints }
}

/**
 * Spawns, moves and fades the sparkles (or puts them all out when `on` is false). `pool`
 * holds their flights (`pool.current`, made the first time they're needed); `emitters`
 * is sparkleEmitters().
 */
function updateSparkles(mesh, pool, emitters, on, delta) {
  if (!mesh) return
  if (!on) {
    if (mesh.visible) {
      // Out with every one, so none is left frozen for next time.
      mesh.visible = false
      if (pool.current) pool.current.life.fill(0)
      const fades = mesh.geometry.getAttribute('aFade')
      for (let i = 0; i < SPARKLES; i += 1) {
        mesh.setMatrixAt(i, ZERO)
        fades.setX(i, 0)
      }
      mesh.instanceMatrix.needsUpdate = true
      fades.needsUpdate = true
    }
    return
  }
  mesh.visible = true
  pool.current ??= {
    x: new Float32Array(SPARKLES),
    y: new Float32Array(SPARKLES),
    z: new Float32Array(SPARKLES),
    rise: new Float32Array(SPARKLES),
    size: new Float32Array(SPARKLES),
    age: new Float32Array(SPARKLES),
    life: new Float32Array(SPARKLES),
    owed: 0,
    next: 0,
  }
  const f = pool.current
  const { list, tints } = emitters
  f.owed += delta * SPARKLE_RATE
  let recoloured = false
  while (f.owed >= 1) {
    f.owed -= 1
    const i = f.next
    f.next = (f.next + 1) % SPARKLES
    const stand = TIRE_STANDS[list[Math.floor(Math.random() * list.length)]]
    // Round the sword in its niche, in front of the back panel.
    f.x[i] = stand.x + (Math.random() - 0.35) * 0.9
    f.y[i] = stand.y + (Math.random() - 0.5) * 3.0
    f.z[i] = stand.z + (Math.random() - 0.5) * 2.6
    f.rise[i] = 0.25 + Math.random() * 0.3
    f.size[i] = SPARKLE_SIZE[0] + Math.random() * (SPARKLE_SIZE[1] - SPARKLE_SIZE[0])
    f.age[i] = 0
    f.life[i] = SPARKLE_LIFE[0] + Math.random() * (SPARKLE_LIFE[1] - SPARKLE_LIFE[0])
    mesh.setColorAt(i, tints[stand.index])
    recoloured = true
  }
  if (recoloured && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  const fades = mesh.geometry.getAttribute('aFade')
  for (let i = 0; i < SPARKLES; i += 1) {
    if (f.life[i] <= 0) continue
    f.age[i] += delta
    if (f.age[i] >= f.life[i]) {
      f.life[i] = 0
      mesh.setMatrixAt(i, ZERO)
      fades.setX(i, 0)
      continue
    }
    const k = f.age[i] / f.life[i]
    const swell = Math.sin(Math.PI * k)
    f.y[i] += f.rise[i] * delta
    const size = f.size[i] * (0.35 + 0.65 * swell)
    _m.makeScale(size, size, size).setPosition(f.x[i], f.y[i], f.z[i])
    mesh.setMatrixAt(i, _m)
    fades.setX(i, swell * (0.65 + 0.35 * Math.sin(f.age[i] * 17 + i)))
  }
  mesh.instanceMatrix.needsUpdate = true
  fades.needsUpdate = true
}

/**
 * The SWORD WALL: every sword (swords.js) hung upright in its niche (shared/world
 * TIRE_STANDS), point up, turning slowly like a trophy on a turntable and bobbing, a soft
 * halo glowing behind it, its name plate under it - and the SWORD COUNTER at the wall's
 * foot. Frames, panels, halos and plates recolour and rewrite as you buy and equip: gold
 * round the one you hold, bright green round the next to buy, your swords in their
 * rarity's colour, the ones past that dim. Three draw calls: the wall and counter, the
 * swords (all thirty-six turned in one mesh's vertex shader), the halos.
 */
export function TireShop() {
  // As a string: the profile is a fresh copy after every update (a throw, a slash...).
  const ownedKey = useGame((s) => s.profile.ownedTires.join(','))
  const equipped = useGame((s) => s.profile.equippedTire)
  const world = useGame((s) => s.profile.world || 0)
  const wallRef = useRef(null)
  const halosRef = useRef(null)
  const swordsRef = useRef(null)
  const sparklesRef = useRef(null)
  /** The sparkles' flights (a ref: rewritten every frame), made on the first frame that needs them. */
  const flightsRef = useRef(null)

  const assets = useMemo(() => {
    const v = venueOf(world)
    const wall = buildWall(v.castle, v.shop)
    // Every sword, in one draw call, each at its own fitted size.
    const scales = TIRE_STANDS.map((stand) => shownScale(TIRES[stand.index].id))
    const swords = createSwordShowcase(
      TIRE_STANDS.map((stand) => ({ id: TIRES[stand.index].id, x: stand.x, y: stand.y, z: stand.z, phase: stand.index, scale: scales[stand.index] })),
      SWORD_FIT.max,
    )
    // A soft glow behind each sword, the size of the sword (and never past its niche): set once.
    const halos = createGlowInstances(TIRE_STANDS.length, 0.5)
    for (const stand of TIRE_STANDS) {
      const size = Math.min(NICHE_WIDTH - 0.3, swordHeight(TIRES[stand.index].id) * scales[stand.index] + 0.6)
      halos.setMatrixAt(stand.index, _m.compose(_p.set(HALO_X, stand.y, stand.z), _q.identity(), _s.setScalar(size)))
    }
    halos.count = TIRE_STANDS.length
    halos.instanceMatrix.needsUpdate = true
    const looks = TIRES.map(nicheLooks)
    return { wall, swords, halos, looks, sparkles: createSparkles(), emitters: sparkleEmitters() }
  }, [world])

  useEffect(
    () => () => {
      disposeBlocks(assets.wall)
      disposeGlow(assets.halos)
      disposeSwordShowcase(assets.swords)
      assets.sparkles.geometry.dispose()
      assets.sparkles.material.dispose()
      assets.sparkles.dispose()
    },
    [assets],
  )

  // Recolour each niche and rewrite its plate whenever ownership changes.
  useEffect(() => {
    const wall = wallRef.current
    const halos = halosRef.current
    const profile = { ownedTires: ownedKey.split(','), equippedTire: equipped }
    for (const stand of TIRE_STANDS) {
      const state = standState(profile, stand.index)
      const look = assets.looks[stand.index]
      if (wall) {
        wall.setColorAt(stand.index, look.panel[state])
        for (let k = 0; k < FRAME_STRIPS; k += 1) wall.setColorAt(frameIndex(stand, k), look.frame[state])
      }
      halos?.setColorAt(stand.index, look.halo[state])
      updateWorldLabel(`stand-${stand.index}`, standLabelSpec(stand.index, state))
    }
    if (wall?.instanceColor) wall.instanceColor.needsUpdate = true
    if (halos?.instanceColor) halos.instanceColor.needsUpdate = true
  }, [ownedKey, equipped, assets])

  useFrame((state, rawDelta) => {
    const halos = halosRef.current
    const swords = swordsRef.current
    if (!halos || !swords) return
    // Distance culling: the swords and their halos only within SHOWCASE_RANGE of the wall -
    // at that distance they're a few pixels tall anyway.
    const cam = state.camera.position
    const quality = useQuality.getState()
    const distance = Math.hypot(cam.x - WALL_MID.x, cam.z - WALL_MID.z)
    const near = distance < SHOWCASE_RANGE[quality.level === 'LOW' ? 0 : 1]
    swords.visible = near
    halos.visible = near
    updateSparkles(sparklesRef.current, flightsRef, assets.emitters, near && distance < 90 && quality.settings.particles, Math.min(rawDelta, 0.05))
  })


  return (
    <>
      <primitive ref={wallRef} object={assets.wall} />
      <primitive ref={swordsRef} object={assets.swords} />
      <primitive ref={halosRef} object={assets.halos} />
      <primitive ref={sparklesRef} object={assets.sparkles} />
    </>
  )
}

export default TireShop
