/**
 * Makes sure every shader program the renderer has built is really finished.
 *
 * `compileAsync` (ShaderWarmup, Roll) only waits for the driver where the
 * KHR_parallel_shader_compile extension exists. Many weak GPUs don't have it: there it
 * resolves at once, and each program is actually linked the first time it's drawn,
 * stalling that frame - the moment the fire bursts off the paddle, the crater opens...
 * Asking each program for its uniforms and attributes forces that wait now, while
 * nothing is moving. Free for programs that are already done.
 *
 * @param {import('three').WebGLRenderer} gl
 */
export function linkPrograms(gl) {
  linkAll(gl)
}

/**
 * Runs `fn` (a compile / compileAsync call) with every hidden object under `root` shown,
 * then hides them again. three's compile() gathers only what's visible, so whatever waits
 * hidden until it's needed (a burst, a splash, a ghost) was otherwise compiled the first
 * time it appeared - in the middle of a throw. compile() gathers synchronously, before any
 * frame, so nothing is ever drawn shown.
 *
 * @template T
 * @param {import('three').Object3D} root
 * @param {() => T} fn
 * @returns {T}
 */
export function withHiddenShown(root, fn) {
  const hidden = []
  root.traverse((o) => {
    if (!o.visible) {
      hidden.push(o)
      o.visible = true
    }
  })
  try {
    return fn()
  } finally {
    for (const o of hidden) o.visible = false
  }
}

function linkAll(gl) {
  for (const program of gl.info.programs ?? []) {
    try {
      program.getUniforms()
      program.getAttributes()
    } catch {
      // A program that failed to compile has already said so; nothing to wait for.
    }
  }
}
