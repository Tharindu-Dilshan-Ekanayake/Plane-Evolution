import { useSyncExternalStore } from 'react'
import { Color, DirectionalLight, Group, HemisphereLight, OrthographicCamera, Scene, WebGLRenderTarget } from 'three'

import { TIRES } from '@shared/balance'

import { glowTime } from './glow'
import { createSwordMesh, getSwordGeometry } from './swords'

/**
 * Sword portraits for the Sword Shop panel, rendered from the very models the world uses
 * (swords.js: the same geometry and the same painted material), so a sword looks the same
 * in the shop as on the wall, in your hand and in flight. No image assets to download.
 *
 * Like the pet portraits (pets/petIcons.js): queued once the game has been up a moment
 * (queueAllSwordIcons, from GameScene) or as soon as the shop asks for one, made one a
 * frame by SwordIconBaker, each read back asynchronously (a synchronous read-back makes the
 * main thread wait for the GPU) and kept as an ImageBitmap that SwordIcon draws onto a
 * small canvas. Bitmaps live on the CPU side, so a lost WebGL context costs none of them;
 * the baker re-attaches to the new renderer and carries on with whatever was left.
 *
 * Every portrait: the sword diagonal, point up-right, turned a little on its long axis so
 * its faces catch the light, filling the square, on a transparent background.
 */

const SIZE = 160
/** Sword id -> ImageBitmap. */
const bitmaps = new Map()
const queue = []
const listeners = new Set()
let renderer = null
let rig = null
/** The rig's shader is compiled (in the background) and portraits can be drawn. */
let ready = false
let notifyScheduled = false
/** A portrait being read back: the next waits for it. */
let busy = null
const _previousClear = new Color()

/** linear -> sRGB byte lookup: render targets come back in linear light. */
const TO_SRGB = new Uint8Array(256)
for (let i = 0; i < 256; i += 1) {
  const c = i / 255
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  TO_SRGB[i] = Math.round(Math.min(1, Math.max(0, s)) * 255)
}

function buildRig() {
  const scene = new Scene()
  scene.add(new HemisphereLight('#ffffff', '#8fa0c0', 2.1))
  const key = new DirectionalLight('#fff4e0', 2.4)
  key.position.set(-2, 3, 4)
  scene.add(key)
  const fill = new DirectionalLight('#bfe0ff', 0.9)
  fill.position.set(3, -1, 2)
  scene.add(fill)
  // The square is -1..1 both ways: the sword is scaled to fill its diagonal.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20)
  camera.position.set(0, 0, 6)
  camera.lookAt(0, 0, 0)
  const target = new WebGLRenderTarget(SIZE, SIZE, { samples: 4 })
  // Turned on its long axis first (to show its faces), then tilted to point up-right.
  const pose = new Group()
  pose.rotation.order = 'ZYX'
  pose.rotation.set(0, 0.5, -Math.PI / 4)
  const mesh = createSwordMesh()
  pose.add(mesh)
  scene.add(pose)
  return { scene, camera, target, pose, mesh, pixels: new Uint8Array(SIZE * SIZE * 4) }
}

/** Dresses the rig as sword `id`: centred on its middle, as big as the square allows. */
function pose(id) {
  rig.mesh.setSword(id)
  const box = getSwordGeometry(id).boundingBox
  const length = box.max.y - box.min.y
  const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
  // Pommel to tip along the diagonal (2.83 across), and the guard's span across it.
  const scale = Math.min(2.5 / length, 1.3 / width)
  rig.pose.scale.setScalar(scale)
  rig.mesh.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2)
}

/** The glow clock (glow.js glowTime) a portrait is drawn at: between two gleams. */
const PORTRAIT_CLOCK = 2.0

/** Draws sword `id` into the offscreen target. */
function draw(id) {
  pose(id)
  const previousTarget = renderer.getRenderTarget()
  const previousClear = renderer.getClearColor(_previousClear)
  const previousAlpha = renderer.getClearAlpha()
  renderer.setRenderTarget(rig.target)
  renderer.setClearColor(0x000000, 0)
  renderer.clear()
  // A still between the blades' gleams (swords.js sweeps one every 3.6 s), so no
  // portrait freezes a bright band across its blade; the clock is put back straight after.
  const clock = glowTime.value
  glowTime.value = PORTRAIT_CLOCK
  renderer.render(rig.scene, rig.camera)
  glowTime.value = clock
  renderer.setRenderTarget(previousTarget)
  renderer.setClearColor(previousClear, previousAlpha)
}

/** The read-back pixels as an upright, sRGB, straight-alpha bitmap for `id`. */
async function store(id) {
  const image = new ImageData(SIZE, SIZE)
  const src = rig.pixels
  // GL rows run bottom-up; MSAA edges come back premultiplied.
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const from = ((SIZE - 1 - y) * SIZE + x) * 4
      const to = (y * SIZE + x) * 4
      const a = src[from + 3]
      const k = a > 0 ? 255 / a : 0
      image.data[to] = TO_SRGB[Math.min(255, Math.round(src[from] * k))]
      image.data[to + 1] = TO_SRGB[Math.min(255, Math.round(src[from + 1] * k))]
      image.data[to + 2] = TO_SRGB[Math.min(255, Math.round(src[from + 2] * k))]
      image.data[to + 3] = a
    }
  }
  bitmaps.set(id, await createImageBitmap(image))
}

/**
 * Called by SwordIconBaker once the renderer exists (and again with a new one after a lost
 * context). The rig is built here, at set-up, so the frame loop that draws portraits never
 * allocates; its shader compiles in the background before the first portrait is drawn.
 */
export function attachSwordIconRenderer(gl) {
  renderer = gl
  ready = false
  // A read-back cut off by a lost context never finishes: its sword goes back in the queue.
  if (busy) {
    if (!bitmaps.has(busy) && !queue.includes(busy)) queue.unshift(busy)
    busy = null
  }
  if (!rig) rig = buildRig()
  pose(TIRES[0].id)
  // Compiled with the portrait target bound: three builds a material a separate shader for
  // a render target (linear output, no tone mapping), and compileAsync gathers for whatever
  // target is bound when it's called. Without this the first portrait compiled the sword
  // shader there and then - a 2-3 s freeze in the lobby on some GPUs.
  let compiled = Promise.resolve()
  if (!import.meta.env.DEV && gl.compileAsync) {
    const previousTarget = gl.getRenderTarget()
    gl.setRenderTarget(rig.target)
    compiled = gl.compileAsync(rig.scene, rig.camera)
    gl.setRenderTarget(previousTarget)
  }
  compiled
    .catch(() => null)
    .then(() => {
      if (renderer === gl) ready = true
    })
}

/** Queues every sword's portrait (GameScene, a little after the game is on screen). */
export function queueAllSwordIcons() {
  for (const tire of TIRES) request(tire.id)
}

/** Re-renders the portraits' React components after the frame, not inside it. */
function notify() {
  if (notifyScheduled) return
  notifyScheduled = true
  setTimeout(() => {
    notifyScheduled = false
    for (const fn of listeners) fn()
  }, 0)
}

/**
 * Starts the next queued portrait, if none is under way (SwordIconBaker's frame loop).
 * Nothing to do once all thirty-six are made. The draw is tiny; the read-back finishes
 * later, off the frame.
 */
export function processSwordIconQueue() {
  if (busy || !ready || !renderer || !rig || queue.length === 0) return
  const id = queue.shift()
  busy = id
  const gl = renderer
  draw(id)
  gl.readRenderTargetPixelsAsync(rig.target, 0, 0, SIZE, SIZE, rig.pixels)
    .then(() => store(id))
    .catch((err) => console.warn('[swordIcons] portrait failed', id, err))
    .finally(() => {
      if (busy === id) busy = null
      notify()
    })
}

function request(id) {
  if (!id || bitmaps.has(id) || queue.includes(id) || busy === id) return
  queue.push(id)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Portrait bitmap for sword `id`; null until it has been rendered (asking queues it). */
export function useSwordIcon(id) {
  request(id)
  return useSyncExternalStore(subscribe, () => bitmaps.get(id) ?? null)
}

/** The portraits' size in pixels (they're drawn onto canvases this big). */
export const SWORD_ICON_SIZE = SIZE
