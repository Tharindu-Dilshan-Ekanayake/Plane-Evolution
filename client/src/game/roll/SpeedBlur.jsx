import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { BufferAttribute, BufferGeometry, FramebufferTexture, LinearFilter, Mesh, OrthographicCamera, Scene, ShaderMaterial, Vector2 } from 'three'

import { roll } from './rollControl'

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Blur starts at this speed (m/s) and is full by this one. */
const BLUR_FROM = 35
const BLUR_FULL = 220
/** Where the canyon vanishes on screen (uv, y up): everything smears away from here. */
const VANISH = new Vector2(0.5, 0.57)
const _size = new Vector2()

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// The copy holds the screen's own (display-encoded, tone-mapped) colours, so they're
// averaged and written back as they are: no colour-space conversion either way.
const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform float uAmount;
  uniform vec2 uCenter;
  varying vec2 vUv;
  void main() {
    vec2 toCenter = uCenter - vUv;
    // Sharp through the middle where the rider is, smearing harder out to the sides
    // (and a little at the top and bottom), as a camera rushing forward would.
    float edge = smoothstep(0.22, 0.95, length(vec2(toCenter.x * 2.0, toCenter.y * 1.1)));
    float reach = uAmount * edge * 0.16;
    // A per-pixel offset into the steps hides their banding as fine grain.
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < SAMPLES; i++) {
      float t = (float(i) + jitter) / float(SAMPLES);
      sum += texture2D(tScene, vUv + toCenter * reach * t).rgb;
    }
    gl_FragColor = vec4(sum / float(SAMPLES), 1.0);
  }
`

/**
 * The blur's material (one per sample count) and its screen triangle, kept for the whole
 * session: a material disposed after each throw took its compiled shader with it, and the
 * next throw compiled it again. Tiny; only the screen copy is let go between throws.
 */
const MATERIALS = new Map()
let triangle = null
function blurMaterial(samples) {
  let material = MATERIALS.get(samples)
  if (!material) {
    material = new ShaderMaterial({
      defines: { SAMPLES: samples },
      uniforms: { tScene: { value: null }, uAmount: { value: 0 }, uCenter: { value: VANISH } },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    MATERIALS.set(samples, material)
  }
  return material
}

/** A copy of the screen, `width` x `height` (the drawing buffer's size), smoothly sampled. */
function screenCopy(width, height) {
  const texture = new FramebufferTexture(width, height)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

/** The full-screen pass that blurs the screen's copy back over it. */
function createPass(samples) {
  if (!triangle) {
    // One triangle covering the screen.
    triangle = new BufferGeometry()
    triangle.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  }
  const material = blurMaterial(samples)
  material.uniforms.uAmount.value = 0
  const quad = new Mesh(triangle, material)
  quad.frustumCulled = false
  const scene = new Scene()
  scene.add(quad)
  return { material, scene, camera: new OrthographicCamera(), copy: null, amount: 0 }
}

/**
 * Motion blur down the sides of the screen while your sword flies fast: the scene is drawn
 * to the screen as usual, copied, and the copy drawn back over it through a zoom blur that
 * leaves the middle (the sword) sharp and smears the edges away from the road's vanishing
 * point, more the faster you go. Below BLUR_FROM it's just the usual render, so a slow
 * throw costs nothing extra.
 *
 * Drawing the scene to the screen (not into a render target) matters: three builds every
 * material a second shader for a render target (linear output, no tone mapping), and
 * whatever was first seen through the blur - the portal, the Sword Wall - compiled that
 * mid-throw, a frame of a second or more on some GPUs. A screen copy is also a quarter of
 * an antialiased target's memory.
 *
 * Post-processing, so MEDIUM and HIGH only (`motionBlur` samples). Mounted only while
 * flying: its frame callback has priority 1, which takes the rendering over from R3F
 * until it unmounts.
 *
 * @param {{ samples: number }} props
 */
export function SpeedBlur({ samples }) {
  const gl = useThree((s) => s.gl)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)
  const passRef = useRef(null)
  /** The renderer, kept to hand stats counting back to it on the way out. */
  const glRef = useRef(null)

  useEffect(() => {
    const pass = createPass(samples)
    passRef.current = pass
    // Compiled now, during the push-off, not mid-ride when the blur first kicks in (once a
    // session: the material is kept, so after the first throw this is already done).
    gl.compileAsync(pass.scene, pass.camera).catch(() => {})
    return () => {
      passRef.current = null
      pass.material.uniforms.tScene.value = null
    }
  }, [gl, samples])

  // The screen copy, the drawing buffer's size: remade when that changes, never per frame.
  useEffect(() => {
    const pass = passRef.current
    if (!pass) return undefined
    gl.getDrawingBufferSize(_size)
    const copy = screenCopy(_size.x, _size.y)
    pass.copy = copy
    pass.material.uniforms.tScene.value = copy
    return () => {
      if (pass.copy === copy) pass.copy = null
      copy.dispose()
    }
  }, [gl, samples, width, height, dpr])

  useEffect(
    () => () => {
      if (glRef.current) glRef.current.info.autoReset = true
    },
    [],
  )

  useFrame((state, rawDelta) => {
    const { gl: renderer, scene, camera } = state
    glRef.current = renderer
    // Two renders a frame: count both in the stats (PerfProbe), not just the last.
    renderer.info.autoReset = false
    renderer.info.reset()
    const pass = passRef.current
    const delta = Math.min(rawDelta, 0.05)
    const want = roll.active && !roll.stopped && !roll.crashed ? smoothstep(BLUR_FROM, BLUR_FULL, roll.speed) : 0
    if (pass) pass.amount += (want - pass.amount) * (1 - Math.exp(-4 * delta))
    renderer.setRenderTarget(null)
    renderer.render(scene, camera)
    if (!pass || !pass.copy || pass.amount < 0.01) return
    // Mid-resize (the copy is remade in an effect): skip the blur for that frame.
    renderer.getDrawingBufferSize(_size)
    if (pass.copy.image.width !== _size.x || pass.copy.image.height !== _size.y) return
    renderer.copyFramebufferToTexture(pass.copy)
    pass.material.uniforms.uAmount.value = pass.amount
    renderer.render(pass.scene, pass.camera)
  }, 1)

  return null
}

export default SpeedBlur
