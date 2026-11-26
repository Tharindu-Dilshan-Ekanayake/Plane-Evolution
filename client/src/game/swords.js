import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  Path,
  Quaternion,
  Shape,
  Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { RARITIES, TIRES } from '@shared/balance'

import { glowTime } from './glow'

/**
 * Every sword in the sword shop (shared/balance.js TIRES - the ids are the template's
 * tire ids, kept for saves; names and stats live there): each its own procedural shape -
 * a carved wooden practice sword, a bamboo blade, a chunky stone slab, a bone cleaver, a
 * copper gladius, an iron longsword, a steel claymore, a knight's broadsword, a pirate
 * cutlass, a desert scimitar, a crescent saber, an ice blade hung with icicles, a winged
 * royal greatsword with a ruby, an obsidian blade with glowing lava cracks, a lightning
 * bolt, an emerald fang, a ruby flamberge, a diamond greatblade, a rainbow prism blade, a
 * twisted unicorn horn, a galaxy saber, a dragon-headed slayer, a neon cyber blade and the
 * Infinity Blade circled by floating rings - then the twelve Legend swords after them: the
 * Soul Reaper's scythe hook, the Twin Moon's two blades, the Titan Axe-Sword, the Sawtooth
 * Ripper, the Phoenix Wing, the Abyssal Trident, the Blossom Dancer, the Celestial Halo, the
 * Void Rift, the Aurora Crystal, the Tempest and the Eternity Godblade. All painted by one
 * GLSL function (SWORD_GLSL); no textures. The shape gives each its silhouette, the painter
 * its detail - grain, fullers, filigree, runes, gems, cracks of light, feathers, petals -
 * so even all thirty-six together stay under 20k triangles.
 *
 * Each sword is one merged geometry, built lazily the first time it's needed and shared.
 * Every vertex carries its paint: `aP` (where it is on the sword, metres, for the
 * patterns - on blades, straightened: x is measured from the blade's own centre line, so
 * a curved or twisted blade's pattern follows it), `aLook` (which pattern, and how much it
 * glows) and two sRGB colours `aCa` / `aCb` - so every sword draws with one material and
 * one program, and swapping swords is swapping a geometry. The sword shop merges all
 * twenty-four into a single mesh that turns each sword on its stand in the vertex shader
 * (createSwordShowcase): one draw call.
 *
 * A sword's local frame: the grip's centre at the origin (the handle runs from y = -0.24
 * to 0.08: two hands at 0 and -0.14), the blade running up +Y from the guard (around
 * y = 0.1-0.16) to its tip at swordLength(id) - 1.25 m for the Wooden Sword up to 2.9 m
 * for the Eternity Godblade - its broad flat faces towards +-Z and its edges towards +-X, the
 * pommel below the handle. Units are metres (the avatar is 1.8 tall).
 */

/** The patterns SWORD_GLSL paints (a vertex's `aLook.x`). */
export const SWORD_LOOK = {
  PLAIN: 0,
  WOOD: 1,
  BAMBOO: 2,
  STONE: 3,
  BONE: 4,
  COPPER: 5,
  STEEL: 6,
  GLOSS: 7,
  METAL: 8,
  CHROME: 9,
  CANDY: 10,
  SWIRL: 11,
  ICE: 12,
  GOLD: 13,
  LAVA: 14,
  THUNDER: 15,
  GEM: 16,
  RAINBOW: 17,
  PASTEL: 18,
  GALAXY: 19,
  SCALES: 20,
  CARBON: 21,
  NEON: 22,
  PRISM: 23,
  GRIP: 24,
  LEATHER: 25,
  /** Polished steel: the bevelled edges (facets facing +-X) shine brighter than the flats. */
  BLADE: 26,
  /** BLADE with a dark groove (the fuller) down the middle of each face. */
  FULLER: 27,
  /** Dark steel (`a`) engraved down the middle with runes glowing in `b`. */
  RUNES: 28,
  /** BLADE inlaid with filigree in `b`: a stem down the middle and a chain of curls either side. */
  INLAY: 29,
  /** Black glass (`a`) split by a glowing crack (`b`) wandering down the middle, flecked with light. */
  CRACK: 30,
  /** Crystal shifting through `a`, `b` and violet in drifting bands, white along its cracks. */
  AURORA: 31,
  /** Spectral: wisps of glowing `b` rising through `a`, the rims lit. */
  GHOST: 32,
  /** Feathers: `a` at the root shading to `b` at the tips, barbed, glowing by `glow`. */
  FEATHER: 33,
  /** `a` scattered with five-petalled flowers in `b`, golden hearts. */
  PETALS: 34,
}
const K = SWORD_LOOK

/**
 * Per sword id: its base colour `a` (its stand's cap) and `trail` - the colour of its glow,
 * its stand's trim, its trail and anything else tinted by it. How each is shaped and
 * painted is its builder, below.
 */
export const SWORD_STYLES = {
  bicycle: { a: '#e2b47a', trail: '#ffe2a8' },
  mountain: { a: '#c4dc6a', trail: '#b6ff6a' },
  wood: { a: '#9aa1aa', trail: '#d6dce6' },
  stone: { a: '#f3ead2', trail: '#fff6dc' },
  cookie: { a: '#e07a3c', trail: '#ff9a5a' },
  pizza: { a: '#dfe6ee', trail: '#e8f0ff' },
  donut: { a: '#c9d2de', trail: '#bcd6ff' },
  watermelon: { a: '#ffcf3a', trail: '#7fb2ff' },
  monster: { a: '#e0a83a', trail: '#ffd27a' },
  mint: { a: '#ffd23a', trail: '#ff6a4a' },
  silver: { a: '#eef2f8', trail: '#d6e4ff' },
  ice: { a: '#c9f1ff', trail: '#bff4ff' },
  gold: { a: '#ffc81a', trail: '#ffd21f' },
  lava: { a: '#2a0f0b', trail: '#ff5a1c' },
  platinum: { a: '#ffd21f', trail: '#7fe6ff' },
  emerald: { a: '#2bd17a', trail: '#7dffb0' },
  ruby: { a: '#ff3b5c', trail: '#ff7a90' },
  diamond: { a: '#bff0ff', trail: '#bff4ff' },
  rainbow: { a: '#ffffff', trail: '#ff7ad9' },
  unicorn: { a: '#ffb6e6', trail: '#ffb0f0' },
  galaxy: { a: '#120a2a', trail: '#a46bff' },
  dragon: { a: '#22a552', trail: '#4cff7a' },
  cosmic: { a: '#c9d2de', trail: '#3fd8ff' },
  infinity: { a: '#ffffff', trail: '#ffffff' },
  reaper: { a: '#0e3a3a', trail: '#5fffe0' },
  twinmoon: { a: '#dfeaff', trail: '#9fd0ff' },
  titanaxe: { a: '#c98a3a', trail: '#ffb45a' },
  sawtooth: { a: '#3a3f48', trail: '#ff2a2a' },
  phoenixwing: { a: '#ff7a1a', trail: '#ffb21a' },
  abyssal: { a: '#0b2a5a', trail: '#2fe0ff' },
  blossom: { a: '#ff9cc8', trail: '#ffc0e0' },
  celestial: { a: '#fff3c4', trail: '#ffe27a' },
  voidrift: { a: '#0a0612', trail: '#b14dff' },
  aurora: { a: '#3fffb0', trail: '#7affd8' },
  tempest: { a: '#2a5aa8', trail: '#9ff4ff' },
  eternity: { a: '#ffe48a', trail: '#ffffff' },
}

// Parsed once: frame code looks colours up without allocating.
const PARSED = Object.fromEntries(Object.entries(SWORD_STYLES).map(([id, s]) => [id, { a: new Color(s.a), trail: new Color(s.trail) }]))
const styleOf = (id) => PARSED[id] || PARSED.bicycle

/** The colour of sword `id`'s glow, trims, trail and anything tinted by it. */
export const swordTrail = (id) => styleOf(id).trail
/** Sword `id`'s base colour. */
export const swordBase = (id) => styleOf(id).a

// --- The painter -------------------------------------------------------------------------

/**
 * The sword painter, in GLSL. `p` is where the fragment is on the sword (its local frame,
 * metres; straightened along a curved blade; on a few parts their own frame), `n` its
 * object-space normal (gem facets, the blades' bevelled edges), `vn` its view-space normal
 * (the shine: metals fake their reflections from it, so they gleam even on the LOW
 * preset), `look` the pattern, `a` / `b` its two colours (linear), `glow` how much it
 * lights itself, `t` a clock. Writes the diffuse colour and the light it gives off.
 *
 * Kept cheap to compile as well as to run: the cell pattern (a 3x3 loop) and the two
 * noises are each evaluated once, at a scale picked by the look, and every look shades
 * from those.
 */
const SWORD_GLSL = /* glsl */ `
  float sHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float sNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 sCells(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(sHash(i + g), sHash(i + g + 17.7));
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; id = sHash(i + g + 3.3); }
        else if (d < d2) { d2 = d; }
      }
    }
    return vec3(sqrt(d1), sqrt(d2), id);
  }
  vec3 sHue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
  void swordPaint(vec3 p, vec3 n, vec3 vn, float look, vec3 a, vec3 b, float glow, float t, out vec3 col, out vec3 emit) {
    int k = int(look + 0.5);
    // Continuous over the whole surface (no seam round the back), stretched along the sword.
    vec2 q = vec2(p.x + p.z, p.y);
    float ang = atan(p.z, p.x + 1e-5);
    float turn = ang / 6.28318;
    // A studio light up and to the left of the camera, and the sky above: the shine.
    float spec = pow(max(0.0, dot(vn, vec3(-0.36, 0.56, 0.75))), 22.0);
    float rim = pow(1.0 - clamp(vn.z, 0.0, 1.0), 2.0);
    float sky = smoothstep(-0.15, 0.3, vn.y);
    bool cellular = k == ${K.STONE} || k == ${K.ICE} || k == ${K.LAVA} || k == ${K.PRISM} || k == ${K.AURORA};
    float cs = k == ${K.STONE} ? 16.0 : k == ${K.ICE} ? 13.0 : k == ${K.LAVA} ? 15.0 : k == ${K.AURORA} ? 8.0 : 11.0;
    vec2 drift = k == ${K.LAVA} ? vec2(0.0, t * 0.05) : vec2(0.0);
    vec3 cl = cellular ? sCells(q * cs + drift) : vec3(1.0, 1.0, 0.0);
    float edge = cl.y - cl.x;
    bool steel = k == ${K.BLADE} || k == ${K.FULLER} || k == ${K.RUNES} || k == ${K.INLAY};
    vec2 ns = k == ${K.WOOD} ? vec2(45.0, 2.2) : (k == ${K.STEEL} || steel) ? vec2(80.0, 1.5) : k == ${K.GALAXY} ? vec2(6.0) : k == ${K.PASTEL} ? vec2(4.0) : k == ${K.GHOST} ? vec2(7.0, 2.5) : vec2(9.0);
    vec2 nd = k == ${K.LAVA} ? vec2(t * 0.4) : k == ${K.PASTEL} ? vec2(t * 0.1, 0.0) : k == ${K.GHOST} ? vec2(0.0, -t * 0.7) : vec2(0.0, t * 0.05);
    float n1 = sNoise(q * ns + nd);
    float n2 = sNoise(q * 23.0 + 7.0);
    col = a;
    emit = a * glow + vec3(spec * 0.2);
    if (k == ${K.WOOD}) {
      float ring = smoothstep(0.6, 0.95, sNoise(q * vec2(9.0, 0.7) + 3.0));
      col = mix(a, b, smoothstep(0.35, 0.8, n1) * 0.75 + ring * 0.25);
      emit = vec3(spec * 0.14);
    } else if (k == ${K.BAMBOO}) {
      float f = fract(p.y / 0.2);
      float dark = 1.0 - smoothstep(0.0, 0.12, min(f, 1.0 - f));
      col = mix(mix(a, b, sNoise(q * vec2(40.0, 2.0)) * 0.5), b * 0.7, dark * 0.6);
      emit = vec3(spec * 0.2);
    } else if (k == ${K.STONE}) {
      col = mix(b * 0.45, mix(a, b, cl.z) * (0.85 + 0.3 * n2), smoothstep(0.015, 0.07, edge));
      emit = vec3(0.0);
    } else if (k == ${K.BONE}) {
      float crack = 1.0 - smoothstep(0.0, 0.02, abs(n1 - 0.5));
      col = mix(a, b, smoothstep(0.3, 0.9, n2) * 0.6) * (1.0 - crack * 0.35);
      emit = vec3(spec * 0.15);
    } else if (k == ${K.COPPER}) {
      float v = smoothstep(0.6, 0.78, n1);
      vec3 metal = mix(b, a, 0.5 + 0.5 * sky) * (0.85 + 0.3 * n2);
      col = mix(metal * 0.6, vec3(0.18, 0.55, 0.45), v);
      emit = metal * (1.0 - v) * 0.35 + vec3(spec * (1.0 - v) * 0.9);
    } else if (k == ${K.STEEL}) {
      vec3 base = mix(b, a, 0.55 + 0.45 * n1);
      float band = 0.5 + 0.5 * sin(vn.y * 6.0 + vn.x * 2.5);
      col = base * 0.5;
      emit = base * (0.2 + 0.4 * band * sky) + vec3(spec);
    } else if (k == ${K.GLOSS}) {
      emit = a * glow + vec3(spec * 0.9) + a * rim * 0.15;
    } else if (k == ${K.METAL}) {
      col = a * 0.5;
      emit = mix(b, a, sky) * 0.45 + vec3(spec * 0.9) + a * glow;
    } else if (k == ${K.CHROME}) {
      float band = 0.5 + 0.5 * sin(vn.y * 8.0 - vn.x * 3.0);
      vec3 env = mix(b * 0.5, a, sky) * (0.55 + 0.45 * band);
      col = b * 0.25;
      emit = env * 0.75 + vec3(spec * 1.3) + a * rim * 0.25;
    } else if (k == ${K.CANDY}) {
      col = mix(a, b, step(0.5, fract(p.y * 7.0 + turn)));
      emit = vec3(spec * 0.75) + col * glow;
    } else if (k == ${K.SWIRL}) {
      float an = atan(p.z, p.x + 1e-5) / 6.28318;
      col = mix(a, b, step(0.5, fract(an * 3.0 + length(p.xz) * 14.0)));
      emit = vec3(spec * 0.8) + col * glow;
    } else if (k == ${K.ICE}) {
      col = mix(a, b, cl.z * 0.5 + n1 * 0.3);
      col = mix(col, vec3(1.0), (1.0 - smoothstep(0.01, 0.05, edge)) * 0.7);
      float sp = step(0.985, sHash(floor(q * 60.0) + floor(t * 3.0)));
      emit = a * glow + vec3(sp) + a * rim * 0.35 + vec3(spec * 0.8);
    } else if (k == ${K.GOLD}) {
      float band = 0.5 + 0.5 * sin(vn.y * 6.0 + vn.x * 3.0);
      vec3 metal = mix(a, b, band * sky * 0.7);
      float groove = 1.0 - smoothstep(0.0, 0.006, abs(fract(p.y * 9.0) - 0.5) - 0.44);
      float scroll = step(0.82, 0.5 + 0.5 * sin(turn * 37.699 + p.y * 40.0)) * step(0.5, fract(p.y * 4.5));
      metal *= 1.0 - (groove * 0.45 + scroll * 0.25);
      col = metal * 0.55;
      emit = metal * (0.3 + 0.35 * band) + vec3(spec * 1.1) + a * glow;
    } else if (k == ${K.LAVA}) {
      float crack = 1.0 - smoothstep(0.02, 0.1, edge);
      vec3 rock = a * (0.8 + 0.6 * n2);
      vec3 hot = mix(b, vec3(1.0, 0.86, 0.25), smoothstep(0.5, 1.0, crack) * (0.6 + 0.4 * n1));
      float pulse = 0.75 + 0.25 * sin(t * 3.0 + p.y * 9.0);
      col = mix(rock, hot, crack);
      emit = hot * crack * pulse * 1.1 + b * glow * 0.3;
    } else if (k == ${K.THUNDER}) {
      float z = abs(fract(q.x * 6.0 + abs(fract(p.y * 5.0) - 0.5) * 1.8 + t * 0.6) - 0.5);
      float bolt = 1.0 - smoothstep(0.03, 0.08, z);
      float flick = step(0.35, fract(sin(floor(t * 8.0)) * 43758.5));
      col = mix(a, b, bolt);
      emit = a * glow + b * bolt * (0.5 + 0.5 * flick) + vec3(spec * 0.6);
    } else if (k == ${K.GEM}) {
      // One shade per facet: its (flat) normal, snapped so every pixel of it agrees.
      vec3 nq = floor(n * 6.0 + 0.5);
      float h = sHash(nq.xy * 0.37 + nq.z * 1.71 + 0.5);
      col = mix(b, a, 0.45 + 0.55 * h);
      float glint = pow(max(0.0, sin(t * 2.0 + h * 40.0)), 24.0);
      emit = a * glow + col * 0.15 + vec3(glint * 0.8 + spec * 1.2) + a * rim * 0.4;
    } else if (k == ${K.RAINBOW}) {
      col = mix(sHue(fract(p.y * 1.1 - t * 0.25 + q.x * 0.6)), vec3(1.0), 0.15);
      emit = col * glow + vec3(spec * 0.6);
    } else if (k == ${K.PASTEL}) {
      float s = sin(p.y * 14.0 + n1 * 4.4 + q.x * 20.0);
      col = mix(mix(a, b, smoothstep(-0.6, 0.6, s)), vec3(1.0), smoothstep(0.65, 0.95, n2) * 0.6);
      emit = col * glow + vec3(spec * 0.5);
    } else if (k == ${K.GALAXY}) {
      float nn = n1 * 0.65 + n2 * 0.35;
      col = mix(a, b, smoothstep(0.35, 0.75, nn));
      col = mix(col, vec3(0.37, 0.84, 1.0), smoothstep(0.7, 0.95, nn) * 0.7);
      vec2 cellS = floor(q * 36.0);
      float blob = 1.0 - smoothstep(0.12, 0.38, length(fract(q * 36.0) - 0.5));
      float star = step(0.9, sHash(cellS)) * blob * (0.5 + 0.5 * sin(t * 4.0 + sHash(cellS + 5.0) * 30.0));
      col = mix(col, vec3(1.0), star);
      emit = vec3(star) + col * smoothstep(0.7, 0.95, nn) * 0.35 + a * glow;
    } else if (k == ${K.SCALES}) {
      float row = floor(q.y * 26.0);
      vec2 sq = vec2(q.x * 20.0 + mod(row, 2.0) * 0.5, q.y * 26.0);
      float d = length((fract(sq) - vec2(0.5, 0.25)) * vec2(1.0, 1.3));
      col = mix(a, b, smoothstep(0.2, 0.48, d));
      col = mix(col, a * 1.6, smoothstep(0.38, 0.44, d) * (1.0 - smoothstep(0.46, 0.5, d)));
      emit = vec3(spec * 0.5);
    } else if (k == ${K.CARBON}) {
      vec2 w = q * 70.0;
      float twill = step(0.5, fract(w.x * 0.5 + floor(w.y) * 0.5));
      col = mix(a, b, twill * 0.7 + 0.15 * n2);
      emit = vec3(spec * 0.55) + b * 0.1 * sky;
    } else if (k == ${K.NEON}) {
      float pulse = 0.8 + 0.2 * sin(t * 4.0 + p.y * 12.0);
      col = mix(a, vec3(1.0), 0.3);
      emit = a * (0.9 + glow) * pulse + vec3(spec * 0.5);
    } else if (k == ${K.PRISM}) {
      col = sHue(fract(cl.z + t * 0.2 + p.y * 0.3));
      col = mix(col, vec3(1.0), 0.25 + 0.3 * (1.0 - smoothstep(0.0, 0.05, edge)));
      emit = col * max(glow, 0.3) + vec3(spec);
    } else if (k == ${K.GRIP}) {
      float line = 1.0 - smoothstep(0.0, 0.12, fract(p.y * 32.0 + turn * 2.0));
      col = mix(a, b, step(0.5, fract(p.y * 12.0 + turn))) * (1.0 - 0.35 * line);
      emit = vec3(spec * 0.15);
    } else if (k == ${K.LEATHER}) {
      float s = fract(p.y * 18.0 + turn);
      float seam = 1.0 - smoothstep(0.0, 0.1, s);
      col = mix(a, a * 0.6, seam) * (0.85 + 0.3 * n1);
      float stitch = step(0.6, fract(turn * 16.0)) * (1.0 - smoothstep(0.03, 0.09, abs(s - 0.5)));
      col = mix(col, b, stitch * 0.8);
      emit = vec3(spec * 0.1);
    } else if (steel) {
      // Polished steel: the bevels (facets turned towards the edges, +-X) gleam pale and
      // bright, the flats show the brushed metal and the sky in them.
      float bevel = smoothstep(0.3, 0.7, abs(n.x));
      float band = 0.5 + 0.5 * sin(vn.y * 7.0 + vn.x * 2.5 + p.y * 1.7);
      vec3 dark = (k == ${K.RUNES} || k == ${K.INLAY}) ? a * 0.45 : b;
      vec3 steel = mix(dark, a, 0.55 + 0.45 * sky) * (0.9 + 0.2 * n1);
      vec3 edgeCol = mix(a, vec3(1.0), 0.5);
      col = mix(steel * 0.55, edgeCol * 0.6, bevel);
      emit = mix(steel * (0.22 + 0.38 * band * sky), edgeCol * (0.45 + 0.4 * band), bevel) + vec3(spec * 1.1);
      if (k == ${K.FULLER}) {
        // The fuller: a dark groove down the middle of the blade, from above the guard.
        float g = (1.0 - smoothstep(0.014, 0.022, abs(p.x))) * smoothstep(0.16, 0.22, p.y) * (1.0 - bevel);
        col *= 1.0 - 0.55 * g;
        emit *= 1.0 - 0.65 * g;
      } else if (k == ${K.RUNES}) {
        // Runes down the middle, one a cell: a stem and, by the cell's hash, a diagonal, a
        // bar and a hook - glowing and slowly pulsing.
        vec2 rc = vec2(p.x / 0.032, p.y / 0.09);
        float cell = floor(rc.y);
        vec2 f = vec2(rc.x, fract(rc.y) * 2.0 - 1.0);
        float h = sHash(vec2(cell, 7.0));
        float h2 = sHash(vec2(cell, 13.0));
        float stem = 1.0 - smoothstep(0.12, 0.24, abs(f.x));
        float diag = (1.0 - smoothstep(0.12, 0.26, abs(f.x - f.y * (h > 0.5 ? 0.8 : -0.8)))) * step(0.3, h);
        float bar = (1.0 - smoothstep(0.1, 0.22, abs(f.y - (h2 - 0.5)))) * step(0.45, h2) * step(abs(f.x), 0.8);
        float hook = (1.0 - smoothstep(0.1, 0.24, abs(length(f - vec2(0.0, 0.35)) - 0.45))) * step(0.75, h);
        float rune = max(max(stem, diag), max(bar, hook));
        rune *= step(abs(f.x), 1.0) * step(abs(f.y), 0.78) * smoothstep(0.24, 0.3, p.y) * (1.0 - bevel);
        float pulse = 0.75 + 0.25 * sin(t * 2.5 - p.y * 3.0);
        col = mix(col, b, rune);
        emit = mix(emit, b * (1.1 * pulse), rune);
      } else if (k == ${K.INLAY}) {
        // Filigree: a fine stem down the middle and a chain of curls either side of it.
        vec2 c = vec2(abs(p.x) - 0.03, (fract(p.y * 11.0) - 0.5) / 11.0);
        float curl = 1.0 - smoothstep(0.0035, 0.0075, abs(length(c) - 0.015));
        float stem = 1.0 - smoothstep(0.003, 0.0065, abs(p.x));
        float fil = max(stem, curl) * smoothstep(0.2, 0.26, p.y) * (1.0 - bevel);
        col = mix(col, b * 0.7, fil);
        emit = mix(emit, b * 0.8 + vec3(spec), fil);
      }
    } else if (k == ${K.CRACK}) {
      // Black glass, split down the middle by a wandering crack of light.
      float cx = 0.014 * sin(p.y * 21.0 + 1.3) + 0.008 * sin(p.y * 53.0);
      float d = abs(p.x - cx);
      float crack = 1.0 - smoothstep(0.004, 0.012, d);
      float halo = 1.0 - smoothstep(0.0, 0.05, d);
      float pulse = 0.8 + 0.2 * sin(t * 5.0 + p.y * 6.0);
      float fleck = step(0.992, sHash(floor(q * 70.0) + floor(t * 2.0)));
      col = mix(a * (0.8 + 0.4 * n2), b, crack);
      emit = b * (crack * 1.4 + halo * 0.35 + fleck * 0.8) * pulse + b * glow * 0.2 + vec3(spec * 0.9) + b * rim * 0.25;
    } else if (k == ${K.AURORA}) {
      // Layered crystal: bands of a, b and violet drifting up it, white along the cracks.
      float band = sin(p.y * 4.0 - t * 0.9 + cl.z * 2.0 + q.x * 6.0);
      vec3 c1 = mix(a, b, smoothstep(-0.6, 0.6, band));
      c1 = mix(c1, vec3(0.55, 0.25, 1.0), smoothstep(0.55, 0.95, sin(p.y * 2.3 + t * 0.6 + cl.z * 3.0)));
      col = mix(c1, vec3(1.0), 0.3 * (1.0 - smoothstep(0.0, 0.05, edge)));
      emit = c1 * max(glow, 0.3) + vec3(spec * 1.1) + c1 * rim * 0.4;
    } else if (k == ${K.GHOST}) {
      // Spectral: wisps rising through it, its rims glowing.
      float wisp = smoothstep(0.45, 0.85, n1);
      col = mix(a, b, wisp * 0.6);
      emit = b * (glow + wisp * 0.8 + rim * 0.6) + vec3(spec * 0.5);
    } else if (k == ${K.FEATHER}) {
      // Feathers: root to tip from a to b, combed into barbs.
      float g = smoothstep(0.05, 0.42, abs(p.x) + max(0.0, p.y - 0.1) * 0.25);
      vec3 base = mix(a, b, g);
      float barb = smoothstep(0.0, 0.3, fract(abs(p.x) * 24.0 + p.y * 16.0));
      col = base * (0.78 + 0.22 * barb);
      emit = base * glow * (0.7 + 0.3 * barb) + vec3(spec * 0.5) + base * rim * 0.2;
    } else if (k == ${K.PETALS}) {
      // Little five-petalled flowers scattered over it, each with a golden heart.
      vec2 pc = q * vec2(16.0, 11.0);
      vec2 cell = floor(pc);
      vec2 f = fract(pc) - 0.5 + (vec2(sHash(cell), sHash(cell + 3.1)) - 0.5) * 0.3;
      float r = length(f);
      float an = atan(f.y, f.x);
      float lobe = 0.1 * cos(an * 5.0);
      float petal = (1.0 - smoothstep(0.2 + lobe, 0.26 + lobe, r)) * step(0.45, sHash(cell + 9.0));
      float heart = 1.0 - smoothstep(0.04, 0.07, r);
      col = mix(a * (0.9 + 0.2 * n1), b, petal);
      col = mix(col, vec3(1.0, 0.82, 0.35), heart * petal);
      emit = col * glow + vec3(spec * 0.7) + a * rim * 0.2;
    }
  }

  /*
   * The finishing shine over the paint, every sword alike - \`info\` is the sword's
   * (aSword: its sparkle by rarity, its length) and its showcase phase:
   *  - a bright band sweeps up it on the slant, pommel to tip, every few seconds,
   *    catching its metal and crystal (not its wood, leather or cloth);
   *  - rarer swords (Epic up) twinkle with star glints over their metal and gems, and
   *    their edges light up in their own colours;
   *  - gems, crystals and glowing parts breathe.
   * A handful of operations a pixel - cheap enough for LOW.
   */
  void swordShine(vec3 p, vec3 vn, float look, vec3 a, vec3 b, vec3 info, float t, vec3 col, inout vec3 emit) {
    int k = int(look + 0.5);
    float spark = info.x;
    float len = max(info.y, 0.5);
    float ph = info.z;
    float m = 0.0;
    if (k == ${K.BLADE} || k == ${K.FULLER} || k == ${K.RUNES} || k == ${K.INLAY} || k == ${K.STEEL} || k == ${K.CHROME} || k == ${K.METAL} || k == ${K.GOLD}) m = 1.0;
    else if (k == ${K.COPPER} || k == ${K.ICE} || k == ${K.GEM} || k == ${K.AURORA} || k == ${K.PRISM} || k == ${K.CRACK} || k == ${K.GLOSS} || k == ${K.GALAXY} || k == ${K.NEON} || k == ${K.RAINBOW} || k == ${K.THUNDER} || k == ${K.CARBON}) m = 0.7;
    else if (k == ${K.GHOST} || k == ${K.CANDY} || k == ${K.SWIRL} || k == ${K.PASTEL} || k == ${K.SCALES} || k == ${K.BONE} || k == ${K.FEATHER} || k == ${K.PETALS}) m = 0.35;
    // The sweep: 0.85 s up the sword in every 3.6, each sword on the wall a beat apart.
    float head = fract(t / 3.6 + ph * 0.137) * (3.6 / 0.85);
    float span = len + 0.6;
    float x = ((p.y + p.x * 0.9 + 0.3) / span - head) * span / 0.075;
    // A sharp gleam in a soft glow.
    float band = exp(-x * x) + 0.22 * exp(-x * x * 0.08);
    emit += mix(vec3(1.0, 0.97, 0.9), b, 0.2) * band * m * (0.85 + 0.65 * spark);
    if (spark > 0.01 && m > 0.0) {
      // Star glints: a few cells of a fine grid flash in turn.
      vec2 g = vec2(p.x + p.z, p.y) * vec2(15.0, 8.0);
      vec2 cell = floor(g);
      float h = sHash(cell + 41.0);
      vec2 f = fract(g) - 0.5;
      float flash = pow(max(0.0, sin(t * 2.3 + h * 70.0)), 24.0) * step(1.0 - 0.22 * spark, h);
      float star = max((1.0 - smoothstep(0.0, 0.07, abs(f.x))) * (1.0 - smoothstep(0.05, 0.5, abs(f.y))), (1.0 - smoothstep(0.0, 0.07, abs(f.y))) * (1.0 - smoothstep(0.05, 0.5, abs(f.x))));
      star = max(star, 1.0 - smoothstep(0.0, 0.16, length(f)));
      emit += vec3(2.6) * star * flash;
      // Edges lit in its own colours.
      float rim = pow(1.0 - clamp(vn.z, 0.0, 1.0), 3.0);
      emit += mix(a, b, 0.6) * rim * spark * m * 0.35;
    }
    if (k == ${K.GEM} || k == ${K.NEON} || k == ${K.CRACK} || k == ${K.AURORA} || k == ${K.PRISM} || k == ${K.GHOST} || k == ${K.LAVA} || k == ${K.THUNDER}) {
      float breathe = 0.5 + 0.5 * sin(t * 2.2 + ph * 1.7 + p.y * 2.0);
      emit += col * (0.08 + 0.18 * breathe) * (0.5 + 0.5 * spark);
    }
  }
`

const VERTEX_HEAD = /* glsl */ `
  attribute vec3 aP;
  attribute vec2 aLook;
  attribute vec3 aCa;
  attribute vec3 aCb;
  attribute vec2 aSword;
  varying vec3 vSwordP;
  varying vec2 vSwordLook;
  varying vec3 vSwordA;
  varying vec3 vSwordB;
  varying vec3 vSwordN;
  varying vec3 vSwordInfo;
  uniform float uSwordTime;
  #ifdef SWORD_SHOWCASE
    attribute vec3 aCenter;
    attribute float aPhase;
  #endif
`

/**
 * The paint varyings, then the showcase's turn: every sword spins about its own upright
 * axis on its stand (aCenter) and bobs, each a beat behind the last (aPhase).
 */
const VERTEX_NORMAL = /* glsl */ `
  vSwordP = aP;
  vSwordLook = aLook;
  // Colours travel as sRGB bytes; light in linear.
  vSwordA = pow(aCa, vec3(2.2));
  vSwordB = pow(aCb, vec3(2.2));
  vSwordN = normal;
  // Its sparkle and length (aSword), and its beat on the wall (else none).
  vSwordInfo = vec3(aSword, 0.0);
  vec3 objectNormal = normal;
  #ifdef SWORD_SHOWCASE
    vSwordInfo.z = aPhase;
    float swordTurn = uSwordTime * 0.6 + aPhase * 0.7;
    float swordC = cos(swordTurn);
    float swordS = sin(swordTurn);
    objectNormal = vec3(swordC * normal.x + swordS * normal.z, normal.y, -swordS * normal.x + swordC * normal.z);
  #endif
`

const VERTEX_POSITION = /* glsl */ `
  vec3 transformed = position;
  #ifdef SWORD_SHOWCASE
    transformed = aCenter + vec3(swordC * position.x + swordS * position.z, position.y + sin(uSwordTime * 1.6 + aPhase) * 0.15, -swordS * position.x + swordC * position.z);
  #endif
`

/** A Lambert material taught to paint swords; `showcase` turns them on their stands. */
function createSwordMaterial(showcase) {
  const material = new MeshLambertMaterial({ color: 0xffffff })
  if (showcase) material.defines = { SWORD_SHOWCASE: '' }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSwordTime = glowTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <beginnormal_vertex>', VERTEX_NORMAL)
      .replace('#include <begin_vertex>', VERTEX_POSITION)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSwordTime;
        varying vec3 vSwordP;
        varying vec2 vSwordLook;
        varying vec3 vSwordA;
        varying vec3 vSwordB;
        varying vec3 vSwordN;
        varying vec3 vSwordInfo;
        ${SWORD_GLSL}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 swordCol;
        vec3 swordEmit;
        swordPaint(vSwordP, normalize(vSwordN), normal, vSwordLook.x, vSwordA, vSwordB, vSwordLook.y, uSwordTime, swordCol, swordEmit);
        swordShine(vSwordP, normal, vSwordLook.x, vSwordA, vSwordB, vSwordInfo, uSwordTime, swordCol, swordEmit);
        diffuseColor.rgb = swordCol;
        totalEmissiveRadiance += swordEmit;`,
      )
  }
  material.customProgramCacheKey = () => (showcase ? 'sword-showcase-v2' : 'sword-v2')
  return material
}

// --- Building a sword -----------------------------------------------------------------

const UP = new Vector3(0, 1, 0)
const _color = new Color()

/** sRGB bytes of a hex colour. */
function srgb(hex) {
  const h = _color.set(hex).getHex()
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255]
}

/** A transform: position, Euler rotation (XYZ) and scale. */
function at(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx, sy, sz))
}

/** A transform turning +Y to point along (dx, dy, dz), from (x, y, z). */
function aim(x, y, z, dx, dy, dz, sx = 1, sy = sx, sz = sx) {
  const q = new Quaternion().setFromUnitVectors(UP, new Vector3(dx, dy, dz).normalize())
  return new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(sx, sy, sz))
}

/** A lathe round the sword's axis from [radius, y] pairs, bottom to top. */
const lathe = (points, segments = 12) => new LatheGeometry(points.map(([r, y]) => new Vector2(Math.max(0, r), y)), segments)

/** A cone whose base sits at the origin, pointing up +Y. */
const spike = (radius, height, segments = 5) => new ConeGeometry(radius, height, segments, 1).translate(0, height / 2, 0)

/** Repeatable noise in 0-1 from a position (shared vertices get the same value). */
function hash3(x, y, z, seed = 0) {
  const h = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 997) * 78.233 + Math.round(z * 997) * 37.719 + seed * 19.19) * 43758.5453
  return h - Math.floor(h)
}

/** Pushes every vertex out from the origin by up to +-amount of its distance: a lumpy rock. */
function lumpy(geometry, amount, seed = 0) {
  const pos = geometry.getAttribute('position')
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = 1 + amount * (hash3(x, y, z, seed) - 0.5) * 2
    pos.setXYZ(i, x * k, y * k, z * k)
  }
  return geometry
}

/** A polygon (in the XY plane) as a Shape. */
function shapeOf(points) {
  const s = new Shape()
  s.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i += 1) s.lineTo(points[i][0], points[i][1])
  s.closePath()
  return s
}

/** A flat piece cut out of `shape` (XY plane), `depth` thick along Z and centred on z = 0. */
function plate(shape, depth, bevel = 0.005, curveSegments = 5) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments })
  g.translate(0, 0, -depth / 2)
  return g
}

/** The geometry flipped left to right (x -> -x), its triangles turned back outward. */
function mirrored(geometry) {
  for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
  geometry.applyMatrix4(new Matrix4().makeScale(-1, 1, 1))
  const index = geometry.index
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, a)
    }
  } else {
    for (const name of Object.keys(geometry.attributes)) {
      const attr = geometry.getAttribute(name)
      const n = attr.itemSize
      const arr = attr.array
      for (let v = 0; v + 2 < attr.count; v += 3) {
        for (let c = 0; c < n; c += 1) {
          const t = arr[(v + 1) * n + c]
          arr[(v + 1) * n + c] = arr[(v + 2) * n + c]
          arr[(v + 2) * n + c] = t
        }
      }
    }
  }
  return geometry
}

/** A five- (or n-) pointed star in the XY plane, centred on (0, cy). */
function star(points, outer, inner, cy = 0) {
  const pts = []
  for (let i = 0; i < points * 2; i += 1) {
    const a = Math.PI / 2 + (i / (points * 2)) * Math.PI * 2
    const r = i % 2 ? inner : outer
    pts.push([Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return shapeOf(pts)
}

/** A crescent with its horns up: `w` from the middle to each horn, horns at height `h` over its belly (y = y0). */
function crescent(w, h, y0 = 0, inner = 0.25) {
  const s = new Shape()
  s.moveTo(-w, y0 + h)
  s.quadraticCurveTo(0, y0 - h * 0.9, w, y0 + h)
  s.quadraticCurveTo(0, y0 + h * inner, -w, y0 + h)
  return s
}

/** A feathered wing on the +X side (mirror it for the left), `k` times the base size, from y0 up. */
function wing(k, y0, feathers = 4) {
  const tips =
    feathers > 4
      ? [
          [0.24, 0.045],
          [0.35, 0.03],
          [0.29, 0.085],
          [0.39, 0.11],
          [0.3, 0.14],
          [0.39, 0.2],
          [0.28, 0.2],
          [0.33, 0.29],
          [0.22, 0.24],
          [0.23, 0.35],
          [0.14, 0.22],
        ]
      : [
          [0.22, 0.05],
          [0.33, 0.04],
          [0.27, 0.1],
          [0.37, 0.14],
          [0.28, 0.16],
          [0.36, 0.25],
          [0.24, 0.2],
          [0.27, 0.32],
          [0.14, 0.2],
        ]
  const pts = [[0.04, 0.03], ...tips, [0.04, 0.13]]
  return shapeOf(pts.map(([x, y]) => [x * k, y0 + y * k]))
}

/** A flame with four tongues licking up on the +X side (mirror it for the left), from y0. */
function flame(k, y0) {
  const pts = [
    [0.04, 0.03],
    [0.2, 0.04],
    [0.31, 0.12],
    [0.24, 0.12],
    [0.31, 0.23],
    [0.2, 0.15],
    [0.21, 0.28],
    [0.13, 0.16],
    [0.1, 0.25],
    [0.05, 0.13],
  ]
  return shapeOf(pts.map(([x, y]) => [x * k, y0 + y * k]))
}

const valueAt = (f, u) => (typeof f === 'function' ? f(u) : f)
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * A blade, from its base at y0 up to its tip at y1: rows of horizontal cross-sections,
 * `u` (0 base - 1 tip) apart, joined into eight strips round it - each strip its own
 * vertices, so the facets keep crisp creases between them but shade smoothly along the
 * blade (or one facet a triangle with `flat`, for gems). Each cross-section is a lozenge
 * with a raised ridge: from the right edge (+X, `w` out, `edge` half-thick) up its bevel
 * to the ridge's flat (`bevel` of the way in, `t` half-thick), across to the left bevel
 * and out to the left edge (`wL`, `edgeL`: thick for a sabre's spine). Every parameter
 * may be a number or a function of u. `curve(u)` shifts the centre line sideways (a sabre
 * curving back), `twist(u)` turns the cross-section about it (a spiral horn). The paint
 * coordinates (attribute `aPaint`) are straightened: x from the centre line, untwisted.
 * The tip closes where the widths and thickness reach 0; the base is open (the guard
 * covers it).
 */
function blade({ y0 = 0.1, y1, w, wL = w, t, curve = null, twist = null, edge = 0, edgeL = edge, bevel = 0.42, bevelL = bevel, n = 10, spread = 1.35, rows = null }) {
  const us = rows ?? Array.from({ length: n + 1 }, (_, i) => 1 - (1 - i / n) ** spread)
  const rings = us.map((u) => {
    const y = y0 + (y1 - y0) * u
    const cx = curve ? curve(u) : 0
    const r = Math.max(0, valueAt(w, u))
    const l = Math.max(0, valueAt(wL, u))
    const th = Math.max(0, valueAt(t, u))
    const er = Math.min(th, Math.max(0, valueAt(edge, u)))
    const el = Math.min(th, Math.max(0, valueAt(edgeL, u)))
    const br = r * valueAt(bevel, u)
    const bl = l * valueAt(bevelL, u)
    const ang = twist ? twist(u) : 0
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const local = [
      [r, er],
      [br, th],
      [-bl, th],
      [-l, el],
      [-l, -el],
      [-bl, -th],
      [br, -th],
      [r, -er],
    ]
    return local.map(([x, z]) => [cx + x * c + z * s, y, -x * s + z * c, x, z])
  })
  const pos = []
  const paint = []
  const index = []
  for (let k = 0; k < 8; k += 1) {
    const k2 = (k + 1) % 8
    // An edge strip with no thickness anywhere (a sharp edge) is left out.
    let width = 0
    for (const ringPts of rings) width = Math.max(width, Math.hypot(ringPts[k][0] - ringPts[k2][0], ringPts[k][2] - ringPts[k2][2]))
    if (width < 1e-5) continue
    const base = pos.length / 3
    for (const ringPts of rings) {
      const a = ringPts[k]
      const b = ringPts[k2]
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2])
      paint.push(a[3], a[1], a[4], b[3], b[1], b[4])
    }
    for (let i = 0; i + 1 < rings.length; i += 1) {
      const a0 = base + i * 2
      index.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('aPaint', new BufferAttribute(new Float32Array(paint), 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

/** Half-width tapering from `a` at the base to `b`, then closing to a point over the last `tip` (`shape`: 'point' | 'round'). */
function taper(a, b, tip = 0.14, shape = 'point') {
  return (u) => {
    const w = a + (b - a) * u
    if (u <= 1 - tip) return w
    const v = (u - (1 - tip)) / tip
    return shape === 'round' ? w * Math.sqrt(Math.max(0, 1 - v * v)) : w * (1 - v)
  }
}

/** Rows for a blade: `n` even steps and then the tip region (from `tipFrom`) in `tipRows` finer ones. */
function rowsWithTip(n, tipFrom, tipRows = 4) {
  const rows = []
  for (let i = 0; i <= n; i += 1) rows.push((i / n) * tipFrom)
  for (let i = 1; i <= tipRows; i += 1) rows.push(tipFrom + (1 - tipFrom) * (1 - (1 - i / tipRows) ** 1.6))
  return rows
}

/** Collects a sword's parts, each with its paint, and merges them into one geometry. */
class SwordBuilder {
  constructor() {
    this.parts = []
  }

  /**
   * Adds a part painted `look` in colours `a` / `b`. `m` places it; `flat` shades it in
   * facets; `local` paints it in its own frame (before `m`), not the sword's. A blade's
   * own straightened paint coordinates (its `aPaint` attribute) win over both.
   */
  add(geometry, look, a, b = a, { glow = 0, m = null, flat = false, local = false } = {}) {
    let g = geometry
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'aPaint') g.deleteAttribute(name)
    g.clearGroups()
    if (flat && g.index) {
      const unshared = g.toNonIndexed()
      g.dispose()
      g = unshared
    }
    const painted = g.getAttribute('aPaint')
    const own = painted ? painted.array.slice() : local ? g.getAttribute('position').array.slice() : null
    if (painted) g.deleteAttribute('aPaint')
    if (m) g.applyMatrix4(m)
    if (flat || !g.getAttribute('normal')) g.computeVertexNormals()
    // A vertex touching only zero-area faces (a blade's tip) has no normal: point it up the blade.
    const normals = g.getAttribute('normal')
    for (let i = 0; i < normals.count; i += 1) {
      if (Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) < 0.5) normals.setXYZ(i, 0, 1, 0)
    }
    const count = g.getAttribute('position').count
    if (!g.index) g.setIndex(Array.from({ length: count }, (_, i) => i))
    g.setAttribute('aP', new BufferAttribute(own ?? g.getAttribute('position').array.slice(), 3))
    const looks = new Float32Array(count * 2)
    const ca = new Uint8Array(count * 3)
    const cb = new Uint8Array(count * 3)
    const [ar, ag, ab] = srgb(a)
    const [br, bg, bb] = srgb(b)
    for (let i = 0; i < count; i += 1) {
      looks[i * 2] = look
      looks[i * 2 + 1] = glow
      ca[i * 3] = ar
      ca[i * 3 + 1] = ag
      ca[i * 3 + 2] = ab
      cb[i * 3] = br
      cb[i * 3 + 1] = bg
      cb[i * 3 + 2] = bb
    }
    g.setAttribute('aLook', new BufferAttribute(looks, 2))
    g.setAttribute('aCa', new BufferAttribute(ca, 3, true))
    g.setAttribute('aCb', new BufferAttribute(cb, 3, true))
    this.parts.push(g)
    return this
  }

  build() {
    const merged = mergeGeometries(this.parts, false)
    for (const part of this.parts) part.dispose()
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    return merged
  }
}

// --- Hilts ----------------------------------------------------------------------------

/** Where the handle runs: the grip's centre is the origin. */
const HANDLE_BOTTOM = -0.24
const HANDLE_TOP = 0.08

/** The handle: an open tube (the guard and pommel close it), a touch fatter at the bottom. 20 triangles. */
function grip(b, r, look, a, c, { y0 = HANDLE_BOTTOM, y1 = HANDLE_TOP } = {}) {
  b.add(new CylinderGeometry(r * 0.96, r * 1.04, y1 - y0, 10, 1, true), look, a, c, { m: at(0, (y0 + y1) / 2, 0) })
}

/** A collar round the handle (or a blade's base): a short open tube of radius r at height y. 20 triangles. */
function band(b, r, y, h, look, a, c, opts = {}) {
  b.add(new CylinderGeometry(r, r, h, 10, 1, true), look, a, c, { ...opts, m: at(0, y, 0, 0, 0, 0, 1, 1, opts.sz ?? 1) })
}

/** Collars at both ends of a handle from y0 to y1. */
function collars(b, r, look, a, c, y0 = HANDLE_BOTTOM, y1 = HANDLE_TOP, opts = {}) {
  band(b, r * 1.15, y0 + 0.018, 0.03, look, a, c, opts)
  band(b, r * 1.15, y1 - 0.018, 0.03, look, a, c, opts)
}

/** A round pommel of radius r at height y (80 triangles). */
function ball(b, r, y, look, a, c, opts = {}) {
  b.add(new SphereGeometry(r, 8, 6), look, a, c, { ...opts, m: at(opts.x ?? 0, y, opts.z ?? 0, 0, 0, 0, opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1) })
}

/** A small knob of radius r at (x, y, z) (36 triangles). */
function knob(b, r, x, y, z, look, a, c, opts = {}) {
  b.add(new SphereGeometry(r, 6, 4), look, a, c, { ...opts, m: at(x, y, z, 0, 0, 0, opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1) })
}

/** A smooth orb of radius r at (x, y, z) (80 triangles). */
function orb(b, r, x, y, z, look, a, c, opts = {}) {
  b.add(new IcosahedronGeometry(r, 1), look, a, c, { ...opts, m: at(x, y, z) })
}

/** A gem (flat-shaded octahedron, 8 triangles) of radius r at (x, y, z), stretched by (sx, sy, sz). */
function gem(b, r, x, y, z, a, c, glow = 0.3, sx = 1, sy = 1, sz = 1, look = K.GEM) {
  b.add(new OctahedronGeometry(r, 0), look, a, c, { glow, flat: true, m: at(x, y, z, 0, 0, 0, sx, sy, sz) })
}

/** A crystal shard: a gem stretched along (dx, dy, dz), from its middle at (x, y, z). */
function shard(b, r, len, x, y, z, dx, dy, dz, look, a, c, glow = 0.4) {
  b.add(new OctahedronGeometry(r, 0), look, a, c, { glow, flat: true, m: aim(x, y, z, dx, dy, dz, 1, len / r / 2, 0.75) })
}

/** A straight crossguard: a box `w` wide at height y, `h` tall and `d` deep (12 triangles). */
function bar(b, w, y, look, a, c, h = 0.06, d = 0.08, opts = {}) {
  b.add(new BoxGeometry(w, h, d), look, a, c, { ...opts, m: at(opts.x ?? 0, y, 0, 0, 0, opts.rz ?? 0) })
}

/** A spike (flattened cone) of base radius r and length h from (x, y, z) along (dx, dy, dz). */
function horn(b, r, h, x, y, z, dx, dy, dz, look, a, c, opts = {}, segments = 5) {
  b.add(spike(r, h, segments), look, a, c, { ...opts, m: aim(x, y, z, dx, dy, dz, 1, 1, opts.flatZ ?? 0.65) })
}

/** A pair of plates, the given shape on the +X side and its mirror image on the -X side. */
function pair(b, makeShape, depth, bevel, look, a, c, opts = {}, curveSegments = 5) {
  b.add(plate(makeShape(), depth, bevel, curveSegments), look, a, c, opts)
  b.add(mirrored(plate(makeShape(), depth, bevel, curveSegments)), look, a, c, opts)
}

// --- More shapes ----------------------------------------------------------------------

/** A feather, quill along +Y from the origin, `k` times its base size. */
function feather(k) {
  const pts = [
    [0, 0],
    [0.03, 0.05],
    [0.055, 0.15],
    [0.05, 0.26],
    [0.025, 0.34],
    [0, 0.39],
    [-0.02, 0.33],
    [-0.035, 0.22],
    [-0.03, 0.1],
  ]
  return shapeOf(pts.map(([x, y]) => [x * k, y * k]))
}

/** A flower of `petals` round petals (tips `R` out, valleys `r0`), centred on (0, cy), one petal pointing up. */
function flower(petals, R, r0, cy, n = petals * 5) {
  const pts = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const r = r0 + (R - r0) * Math.abs(Math.cos(((a - Math.PI / 2) * petals) / 2)) ** 0.6
    pts.push([Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return shapeOf(pts)
}

/** An axe head on the +X side: a crescent bearded blade, its back along x = 0.04, centred on y = 0. */
function axeHead(k) {
  const pts = [
    [0.04, 0.15],
    [0.14, 0.2],
    [0.24, 0.31],
    [0.33, 0.25],
    [0.385, 0.11],
    [0.395, -0.02],
    [0.365, -0.16],
    [0.29, -0.31],
    [0.18, -0.27],
    [0.11, -0.15],
    [0.04, -0.1],
  ]
  return shapeOf(pts.map(([x, y]) => [x * k, y * k]))
}

/** A spiky bat wing on the +X side (mirror it for the left), from y0. */
function batWing(k, y0) {
  const pts = [
    [0.04, 0.03],
    [0.18, 0.0],
    [0.26, -0.07],
    [0.3, 0.04],
    [0.36, 0.02],
    [0.39, 0.14],
    [0.45, 0.16],
    [0.41, 0.31],
    [0.3, 0.22],
    [0.22, 0.31],
    [0.14, 0.18],
    [0.04, 0.12],
  ]
  return shapeOf(pts.map(([x, y]) => [x * k, y0 + y * k]))
}

/** The infinity sign: two lobes, each with its eye cut through, `R` from the middle to each end, centred on (0, cy). */
function infinitySign(R, cy) {
  const pts = []
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2
    const r = R * (0.42 + 0.58 * Math.abs(Math.cos(a)))
    pts.push([Math.cos(a) * r, cy + Math.sin(a) * r * 0.62])
  }
  const s = shapeOf(pts)
  for (const side of [-1, 1]) {
    const hole = new Path()
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      const x = side * 0.56 * R + Math.cos(a) * 0.2 * R
      const y = cy + Math.sin(a) * 0.17 * R
      if (i === 0) hole.moveTo(x, y)
      else hole.lineTo(x, y)
    }
    hole.closePath()
    s.holes.push(hole)
  }
  return s
}

/** A zig-zag centre line through `corners` ([u, x] pairs), and blade rows that land on its corners. */
function zigzag(corners) {
  const curve = (u) => {
    let i = 1
    while (i < corners.length - 1 && corners[i][0] < u) i += 1
    const [u0, x0] = corners[i - 1]
    const [u1, x1] = corners[i]
    return x0 + ((x1 - x0) * (u - u0)) / (u1 - u0)
  }
  const rows = []
  for (let i = 0; i + 1 < corners.length; i += 1) rows.push(corners[i][0], (corners[i][0] * 2 + corners[i + 1][0]) / 3, (corners[i][0] + corners[i + 1][0] * 2) / 3)
  rows.push(1)
  return { curve, rows }
}

/** Saw-toothed rows: two a tooth (its top and just under the next), up to `to`, then the tip's. */
function toothRows(teeth, to, tip = [0.93, 0.965, 0.99, 1]) {
  const rows = []
  for (let k = 0; k < teeth; k += 1) rows.push((k / teeth) * to, ((k + 1) / teeth) * to - 0.012)
  return [...rows, ...tip.filter((u) => u > to)]
}

/** 1 at a tooth's top falling to 0 under the next, for `teeth` teeth up to `to`. */
const sawAt = (u, teeth, to) => (u < to ? 1 - (((u / to) * teeth) % 1) : 0.5)
/** 1 below `from`, closing linearly to 0 at the tip. */
const closeFrom = (from) => (u) => (u < from ? 1 : Math.max(0, 1 - (u - from) / (1 - from)))

const STEEL = ['#dfe6ee', '#8a96a8']
const DARK_STEEL = ['#b8c2cf', '#5e6878']
const GOLD = ['#ffcf3a', '#fff1a8']
const BROWN = ['#6b3f22', '#d9b48a']

// --- The swords -----------------------------------------------------------------------

/** Every sword's builder, by id. Each returns its merged geometry. */
const BUILDERS = {
  // --- Common to Epic: honest materials, given real substance -------------------------

  /** A broad carved wooden practice sword: rounded tip, a stout crossbar with round ends, a cloth grip. */
  bicycle() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 1.25, w: taper(0.09, 0.08, 0.1, 'round'), t: taper(0.037, 0.034, 0.1, 'round'), edge: taper(0.015, 0.014, 0.1, 'round'), bevel: 0.48, rows: rowsWithTip(7, 0.9, 4) }), K.WOOD, '#e6b97e', '#b07a44')
    bar(b, 0.4, 0.11, K.WOOD, '#a8723e', '#7a4a22', 0.07, 0.09)
    for (const s of [-1, 1]) knob(b, 0.045, s * 0.2, 0.11, 0, K.WOOD, '#a8723e', '#7a4a22')
    grip(b, 0.037, K.GRIP, '#f2ead8', '#d6c8a8')
    collars(b, 0.037, K.LEATHER, '#8a5430', '#e6cfa6')
    ball(b, 0.062, -0.28, K.WOOD, '#a8723e', '#7a4a22')
    // A leather wrap round the blade's root, and a red cloth tassel off the pommel.
    band(b, 0.1, 0.2, 0.06, K.LEATHER, '#8a5430', '#e6cfa6', { sz: 0.46 })
    band(b, 0.1, 0.27, 0.025, K.LEATHER, '#6a3a1e', '#e6cfa6', { sz: 0.46 })
    horn(b, 0.032, 0.13, 0, -0.46, 0, 0, 1, 0, K.CANDY, '#e0402e', '#ff8a6a', { flatZ: 1 }, 6)
    return b.build()
  },

  /** A broad bamboo blade cut on the slant, its nodes raised, a fat node for a guard with two leaves, a twine grip. */
  mountain() {
    const b = new SwordBuilder()
    const cut = 0.86
    const W = 0.088
    const v = (u) => Math.max(0, (u - cut) / (1 - cut))
    b.add(
      blade({
        y1: 1.33,
        w: (u) => (u < cut ? W - 0.008 * u : W * (1 - v(u))),
        wL: (u) => (u < cut ? W - 0.008 * u : W * (1 - v(u))),
        curve: (u) => -W * v(u),
        t: 0.046,
        edge: 0.03,
        bevel: 0.68,
        rows: [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, cut, 0.9, 0.94, 0.97, 1],
      }),
      K.BAMBOO,
      '#c4dc6a',
      '#8fb444',
    )
    for (const y of [0.45, 0.8, 1.1]) band(b, W + 0.006, y, 0.03, K.PLAIN, '#7ea33a', '#7ea33a', { sz: 0.6 })
    b.add(new CylinderGeometry(0.12, 0.12, 0.07, 12), K.BAMBOO, '#9fbf4a', '#6f8f2a', { m: at(0, 0.11, 0, 0, 0, 0, 1, 1, 0.58) })
    for (const s of [-1, 1]) b.add(new SphereGeometry(1, 6, 3), K.PLAIN, '#3fae3a', '#3fae3a', { m: at(s * 0.13, 0.21, 0.04, 0, 0, s * -0.7, 0.02, 0.16, 0.05) })
    grip(b, 0.036, K.LEATHER, '#c9a46a', '#8a6a3a')
    band(b, 0.042, HANDLE_BOTTOM + 0.02, 0.035, K.LEATHER, '#a8844a', '#6a4a22')
    b.add(new CylinderGeometry(0.048, 0.048, 0.07, 10), K.BAMBOO, '#9fbf4a', '#6f8f2a', { m: at(0, -0.27, 0) })
    return b.build()
  },

  /** A chunky slab of grey stone, chipped all along both edges, lashed with leather above a rough rock guard. */
  wood() {
    const b = new SwordBuilder()
    const chip = (u, s) => 0.86 + 0.26 * hash3(u * 13.1, s, 0.4)
    const body = (u) => (u < 0.84 ? 0.132 - 0.022 * u : (0.113 * (1 - (u - 0.84) / 0.16) + 0.006))
    b.add(blade({ y1: 1.38, w: (u) => body(u) * chip(u, 1), wL: (u) => body(u) * chip(u, 2), t: (u) => 0.058 - 0.026 * u, edge: (u) => 0.022 - 0.013 * u, bevel: 0.5, n: 10, spread: 1.15 }), K.STONE, '#9aa1aa', '#6c7480')
    b.add(new BoxGeometry(0.29, 0.045, 0.125), K.LEATHER, '#7a4a24', '#d9b48a', { m: at(0, 0.25, 0) })
    b.add(lumpy(new BoxGeometry(0.42, 0.11, 0.14, 3, 1, 2), 0.12, 3), K.STONE, '#7f868f', '#585e66', { m: at(0, 0.11, 0), flat: true })
    for (const s of [-1, 1]) b.add(lumpy(new IcosahedronGeometry(0.06, 0), 0.2, s + 4), K.STONE, '#7f868f', '#585e66', { m: at(s * 0.22, 0.12, 0), flat: true })
    grip(b, 0.039, K.LEATHER, '#7a4a24', '#d9b48a')
    band(b, 0.045, HANDLE_BOTTOM + 0.03, 0.04, K.LEATHER, '#5a3418', '#c79a6a')
    b.add(lumpy(new IcosahedronGeometry(0.08, 0), 0.18, 5), K.STONE, '#7f868f', '#585e66', { m: at(0, -0.29, 0, 0.4, 0.7, 0), flat: true })
    // A glowing moss-green crystal set through the rock guard, and a chip of it in the pommel.
    gem(b, 0.052, 0, 0.115, 0, '#8dff6a', '#2a8a3a', 0.6, 1, 1.3, 2.1)
    gem(b, 0.036, 0, -0.29, 0, '#8dff6a', '#2a8a3a', 0.55, 1, 1, 3.3)
    return b.build()
  },

  /** A wide bone cleaver: a notched spine with two bone spurs, a knuckle-bone guard, a double knob. */
  stone() {
    const b = new SwordBuilder()
    const rows = [0, 0.12, 0.24, 0.36, 0.48, 0.58, 0.65, 0.69, 0.72, 0.75, 0.8, 0.86, 0.9, 0.94, 0.97, 1]
    const w = (u) => {
      const base = 0.13 + 0.06 * u
      return u < 0.88 ? base : base * Math.sqrt(Math.max(0, 1 - ((u - 0.88) / 0.12) ** 2))
    }
    const wL = (u) => {
      const notch = 0.036 * Math.max(0, 1 - Math.abs(u - 0.72) / 0.06)
      return u < 0.9 ? 0.056 - notch : 0.056 * (1 - (u - 0.9) / 0.1)
    }
    b.add(blade({ y1: 1.43, rows, w, wL, t: 0.04, curve: () => 0.05, edgeL: (u) => (u < 0.9 ? 0.034 : 0.034 * (1 - (u - 0.9) / 0.1)), bevel: 0.3, bevelL: 0.85 }), K.BONE, '#f3ead2', '#c9b98f')
    for (const y of [0.45, 0.95]) horn(b, 0.026, 0.11, -0.002, y, 0, -1, 0.55, 0, K.BONE, '#efe4c8', '#a89a78')
    b.add(new CylinderGeometry(0.035, 0.035, 0.32, 8, 1, true), K.BONE, '#efe4c8', '#c9b98f', { m: at(0.03, 0.11, 0, 0, 0, Math.PI / 2) })
    for (const x of [-0.13, 0.19]) for (const y of [0.085, 0.135]) b.add(new SphereGeometry(0.042, 5, 4), K.BONE, '#efe4c8', '#c9b98f', { m: at(x, y, 0) })
    grip(b, 0.037, K.LEATHER, '#5a3a22', '#c9a46a')
    collars(b, 0.037, K.LEATHER, '#3a2414', '#c9a46a')
    for (const x of [-0.032, 0.032]) b.add(new SphereGeometry(0.048, 5, 4), K.BONE, '#efe4c8', '#c9b98f', { m: at(x, -0.27, 0) })
    return b.build()
  },

  /** A broad leaf-shaped copper gladius with a strong central ridge, an oval riveted guard, a ridged wooden grip. */
  cookie() {
    const b = new SwordBuilder()
    const w = (u) => {
      const leaf = 0.05 * Math.exp(-(((u - 0.6) / 0.17) ** 2))
      const waist = -0.013 * Math.exp(-(((u - 0.22) / 0.13) ** 2))
      const body = 0.108 + leaf + waist
      return u < 0.8 ? body : body * (1 - (u - 0.8) / 0.2)
    }
    b.add(blade({ y1: 1.47, w, t: (u) => 0.046 * (1 - 0.6 * u), bevel: 0.2, n: 12, spread: 1.2 }), K.COPPER, '#e88a44', '#a04a1a')
    b.add(new CylinderGeometry(0.13, 0.13, 0.05, 14), K.COPPER, '#d06a2c', '#8a3a12', { m: at(0, 0.11, 0, 0, 0, 0, 1, 1, 0.62) })
    for (const s of [-1, 1]) gem(b, 0.016, s * 0.09, 0.14, 0, '#ffd08a', '#b06a2a', 0, 1, 1, 1, K.METAL)
    b.add(
      lathe(
        [
          [0.036, HANDLE_BOTTOM],
          [0.044, -0.19],
          [0.037, -0.13],
          [0.046, -0.07],
          [0.037, -0.01],
          [0.04, HANDLE_TOP + 0.01],
        ],
        10,
      ),
      K.WOOD,
      '#8a5430',
      '#5a3018',
    )
    b.add(new SphereGeometry(0.074, 8, 5), K.COPPER, '#e88a44', '#a04a1a', { m: at(0, -0.29, 0, 0, 0, 0, 1, 1, 0.7) })
    // Turquoise set in the pommel's faces, and a band of it under the guard.
    gem(b, 0.036, 0, -0.29, 0, '#3fe8c8', '#0a7a6a', 0.5, 1, 1, 2.2)
    band(b, 0.045, HANDLE_TOP - 0.004, 0.022, K.GLOSS, '#3fe8c8', '#0a7a6a', { glow: 0.15 })
    return b.build()
  },

  /** A broad straight longsword with a fuller, a flared crossguard on a langet block, a steel wheel pommel. */
  pizza() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 1.55, w: taper(0.098, 0.078, 0.13), t: 0.035, bevel: 0.36, n: 9 }), K.FULLER, ...STEEL)
    bar(b, 0.44, 0.11, K.STEEL, ...DARK_STEEL, 0.055, 0.075)
    bar(b, 0.1, 0.12, K.STEEL, ...DARK_STEEL, 0.11, 0.09)
    for (const s of [-1, 1]) bar(b, 0.05, 0.12, K.STEEL, ...DARK_STEEL, 0.11, 0.085, { x: s * 0.225, rz: s * 0.25 })
    // A garnet set through the langet block.
    gem(b, 0.031, 0, 0.125, 0, '#e0384f', '#6a0a1a', 0.45, 1, 1.3, 2.2)
    grip(b, 0.035, K.LEATHER, ...BROWN)
    collars(b, 0.035, K.METAL, ...DARK_STEEL)
    b.add(new CylinderGeometry(0.072, 0.072, 0.05, 14), K.STEEL, ...DARK_STEEL, { m: at(0, -0.29, 0, Math.PI / 2, 0, 0) })
    b.add(new CylinderGeometry(0.03, 0.03, 0.075, 8), K.STEEL, ...DARK_STEEL, { m: at(0, -0.29, 0, Math.PI / 2, 0, 0) })
    return b.build()
  },

  /** A long two-hander: parrying lugs on the ricasso, guard arms swept up with quatrefoil rings, a blue gem pommel. */
  donut() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 1.66, w: taper(0.102, 0.08, 0.12), t: 0.037, bevel: 0.36, n: 10 }), K.FULLER, '#e6edf5', '#7f8ba0')
    for (const s of [-1, 1]) horn(b, 0.03, 0.09, s * 0.09, 0.34, 0, s, 0.2, 0, K.STEEL, ...DARK_STEEL, {}, 4)
    bar(b, 0.1, 0.12, K.STEEL, ...DARK_STEEL, 0.11, 0.09)
    for (const s of [-1, 1]) {
      b.add(new BoxGeometry(0.28, 0.05, 0.065), K.STEEL, ...DARK_STEEL, { m: at(s * 0.16, 0.16, 0, 0, 0, s * 0.38) })
      b.add(new TorusGeometry(0.045, 0.013, 3, 8), K.STEEL, ...DARK_STEEL, { m: at(s * 0.3, 0.245, 0) })
      gem(b, 0.024, s * 0.3, 0.245, 0, '#7fb2ff', '#2a5bd7', 0.4)
    }
    grip(b, 0.037, K.GRIP, '#4a2e1a', '#2a1a10', { y0: -0.36 })
    collars(b, 0.037, K.METAL, ...DARK_STEEL, -0.36)
    ball(b, 0.062, -0.4, K.STEEL, ...DARK_STEEL, { sy: 1.2 })
    gem(b, 0.03, 0, -0.4, 0, '#7fb2ff', '#2a5bd7', 0.5, 1, 1, 2.4)
    return b.build()
  },

  /** A wide knight's broadsword inlaid with gold filigree, a flared gold guard, sapphires, a blue leather grip. */
  watermelon() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 1.7, w: taper(0.132, 0.108, 0.12), t: 0.037, bevel: 0.42, n: 9 }), K.INLAY, '#eef3f8', '#ffcf3a')
    bar(b, 0.5, 0.11, K.GOLD, ...GOLD, 0.06, 0.08)
    bar(b, 0.12, 0.12, K.GOLD, ...GOLD, 0.11, 0.09)
    for (const s of [-1, 1]) bar(b, 0.06, 0.125, K.GOLD, ...GOLD, 0.12, 0.09, { x: s * 0.255, rz: s * 0.2 })
    gem(b, 0.036, 0, 0.12, 0, '#3f7bff', '#1a3aa0', 0.45, 1, 1.2, 1.5)
    grip(b, 0.037, K.LEATHER, '#2a5bd7', '#ffcf3a')
    collars(b, 0.037, K.GOLD, ...GOLD)
    ball(b, 0.068, -0.29, K.GOLD, ...GOLD)
    for (const z of [-0.058, 0.058]) gem(b, 0.028, 0, -0.29, z, '#3f7bff', '#1a3aa0', 0.45, 1, 1, 0.6)
    return b.build()
  },

  /** A pirate's cutlass: a broad curved blade, a brass shell and knuckle bow, a ruby-eyed pommel. */
  monster() {
    const b = new SwordBuilder()
    const w = (u) => {
      const base = 0.082 + 0.036 * u
      return u < 0.86 ? base : base * (1 - (u - 0.86) / 0.14)
    }
    const wL = (u) => (u < 0.92 ? 0.032 : 0.032 * (1 - (u - 0.92) / 0.08))
    b.add(
      blade({ y1: 1.72, w, wL, t: 0.034, curve: (u) => -0.13 * u * u, edgeL: (u) => (u < 0.92 ? 0.022 : 0.022 * (1 - (u - 0.92) / 0.08)), bevel: 0.28, bevelL: 0.85, n: 12, spread: 1.2 }),
      K.BLADE,
      '#e8edf3',
      '#8a96a8',
    )
    const brass = ['#e8b040', '#8a5a10']
    b.add(new SphereGeometry(0.14, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), K.METAL, ...brass, { m: at(0, 0.06, 0, 0, 0, 0, 1, 0.5, 0.75) })
    b.add(new TorusGeometry(0.17, 0.016, 3, 10, Math.PI), K.METAL, ...brass, { m: at(0.02, -0.1, 0, 0, 0, -Math.PI / 2) })
    grip(b, 0.035, K.GRIP, '#2a1a14', '#120a08')
    band(b, 0.04, 0.06, 0.03, K.METAL, ...brass)
    knob(b, 0.054, 0, -0.28, 0, K.METAL, ...brass)
    gem(b, 0.024, 0, -0.28, 0, '#ff2a4a', '#9a0a20', 0.5, 1, 1, 2.6)
    return b.build()
  },

  /** A desert scimitar: strongly curved and widening, gold-engraved, a gold crescent guard set with a ruby, a tassel. */
  mint() {
    const b = new SwordBuilder()
    const w = (u) => {
      const base = 0.064 + 0.1 * smooth(0.15, 0.85, u)
      return u < 0.86 ? base : base * (1 - (u - 0.86) / 0.14) ** 0.8
    }
    const wL = (u) => (u < 0.9 ? 0.025 : 0.025 * (1 - (u - 0.9) / 0.1))
    b.add(
      blade({ y1: 1.76, w, wL, t: 0.031, curve: (u) => -0.3 * u * u, edgeL: (u) => (u < 0.9 ? 0.02 : 0.02 * (1 - (u - 0.9) / 0.1)), bevel: 0.28, bevelL: 0.85, n: 15, spread: 1.15 }),
      K.INLAY,
      '#f2f5fa',
      '#ffcf3a',
    )
    b.add(plate(crescent(0.21, 0.16, 0.05), 0.05, 0.006), K.GOLD, ...GOLD)
    gem(b, 0.034, 0, 0.1, 0, '#ff2a4a', '#9a0a20', 0.45, 1, 1.2, 1.8)
    grip(b, 0.035, K.GRIP, '#c81e2a', '#7a0e14')
    collars(b, 0.035, K.GOLD, ...GOLD)
    b.add(new ConeGeometry(0.052, 0.09, 10), K.GOLD, ...GOLD, { m: at(0, -0.285, 0, Math.PI, 0, 0) })
    b.add(new CylinderGeometry(0.012, 0.012, 0.06, 6), K.GOLD, ...GOLD, { m: at(0, -0.35, 0) })
    b.add(new ConeGeometry(0.036, 0.15, 8), K.PLAIN, '#d8202c', '#d8202c', { m: at(0, -0.45, 0) })
    return b.build()
  },

  /** An elegant curved silver saber engraved in pale blue, a disc guard set with sapphires, a long grip, a crescent pommel. */
  silver() {
    const b = new SwordBuilder()
    const w = (u) => (u < 0.88 ? 0.074 - 0.008 * u : 0.066 * (1 - (u - 0.88) / 0.12))
    const wL = (u) => (u < 0.9 ? 0.025 : 0.025 * (1 - (u - 0.9) / 0.1))
    b.add(
      blade({ y1: 1.8, w, wL, t: 0.03, curve: (u) => -0.18 * u ** 1.8, edgeL: (u) => (u < 0.9 ? 0.02 : 0.02 * (1 - (u - 0.9) / 0.1)), bevel: 0.3, bevelL: 0.85, n: 13, spread: 1.2 }),
      K.INLAY,
      '#f4f8fc',
      '#7fb0ff',
    )
    b.add(new CylinderGeometry(0.13, 0.13, 0.032, 18), K.METAL, '#eef2f8', '#9aa6b8', { m: at(0, 0.1, 0) })
    band(b, 0.132, 0.1, 0.045, K.GOLD, '#ffffff', '#9aa6b8')
    for (const s of [-1, 1]) gem(b, 0.026, s * 0.135, 0.1, 0, '#5f8fff', '#1a3aa0', 0.5, 1.2, 1, 1)
    grip(b, 0.034, K.GRIP, '#1c2a4a', '#cfd8e6', { y0: -0.32 })
    collars(b, 0.034, K.METAL, '#eef2f8', '#9aa6b8', -0.32)
    b.add(plate(crescent(0.08, 0.055, -0.04), 0.035, 0).applyMatrix4(at(0, -0.33, 0, Math.PI, 0, 0)), K.METAL, '#ffffff', '#8a96a8')
    return b.build()
  },

  /** A glowing ice blade hung with icicles on its back, a snowflake of crystal spikes for a guard. */
  ice() {
    const b = new SwordBuilder()
    const y1 = 1.85
    const wf = taper(0.112, 0.086, 0.15)
    b.add(blade({ y1, w: wf, t: 0.045, bevel: 0.32, n: 10 }), K.ICE, '#c9f1ff', '#4fb8ff', { glow: 0.28 })
    for (const y of [0.42, 0.68, 0.94, 1.2, 1.46]) {
      const u = (y - 0.1) / (y1 - 0.1)
      horn(b, 0.03, 0.16, -wf(u) * 0.92, y, 0, -1, -0.45, 0, K.ICE, '#e8fbff', '#7fd2ff', { glow: 0.35, flatZ: 0.6 })
    }
    bar(b, 0.16, 0.11, K.ICE, '#dff7ff', '#5fc0ff', 0.07, 0.09, { glow: 0.2 })
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 2 + Math.PI / 6 + (i * Math.PI) / 3
      shard(b, 0.035, 0.22, Math.cos(a) * 0.13, 0.12 + Math.sin(a) * 0.1, 0, Math.cos(a), Math.sin(a), 0, K.GEM, '#e8fbff', '#5fc0ff', 0.45)
    }
    grip(b, 0.036, K.GRIP, '#e8fbff', '#7fd2ff')
    collars(b, 0.036, K.ICE, '#dff7ff', '#5fc0ff', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.2 })
    gem(b, 0.066, 0, -0.31, 0, '#e8fbff', '#5fc0ff', 0.5, 1, 1.4, 1)
    return b.build()
  },

  // --- Legendary to Secret: dramatic silhouettes, each grander than the last -----------

  /** A royal gold greatsword: a raised core of ruby runes, golden feathered wings, a crown and a great ruby. */
  gold() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 1.9, w: taper(0.142, 0.118, 0.13), t: 0.037, bevel: 0.42, n: 10 }), K.GOLD, '#ffcf3a', '#fff3b0')
    b.add(blade({ y0: 0.16, y1: 1.76, w: taper(0.032, 0.026, 0.12), t: 0.045, bevel: 0.5, n: 8 }), K.RUNES, '#ffe27a', '#ff3b5c')
    bar(b, 0.14, 0.11, K.GOLD, '#ffc21a', '#fff1a8', 0.11, 0.08)
    pair(b, () => wing(1.05, 0.06, 5), 0.045, 0, K.FEATHER, '#ffc21a', '#fff6d0', { glow: 0.15 })
    for (const x of [-0.05, 0, 0.05]) horn(b, 0.018, x === 0 ? 0.09 : 0.065, x, 0.16, 0, x * 2, 1, 0, K.GOLD, ...GOLD, {}, 4)
    gem(b, 0.062, 0, 0.11, 0, '#ff2a4a', '#9a0a20', 0.45, 1, 1.15, 0.9)
    grip(b, 0.038, K.LEATHER, '#9a1020', '#ffcf3a')
    collars(b, 0.038, K.GOLD, ...GOLD)
    ball(b, 0.072, -0.3, K.GOLD, '#ffc21a', '#fff1a8')
    for (const z of [-0.062, 0.062]) gem(b, 0.03, 0, -0.3, z, '#ff2a4a', '#9a0a20', 0.5, 1, 1, 0.6)
    return b.build()
  },

  /** Jagged obsidian veined with lava, two great horns off the guard, embers floating beside it. */
  lava() {
    const b = new SwordBuilder()
    const teeth = 7
    const rows = toothRows(teeth, 1, [])
    rows.push(1)
    const jag = (u) => 0.82 + 0.3 * (1 - ((u * teeth) % 1))
    const body = (u) => (0.138 - 0.022 * u) * jag(u) * closeFrom(0.86)(u)
    b.add(blade({ y1: 1.95, rows, w: body, t: (u) => 0.048 * (1 - 0.5 * u), bevel: 0.36 }), K.LAVA, '#2a0f0b', '#ff5a1c', { glow: 0.45 })
    bar(b, 0.17, 0.11, K.LAVA, '#1e0a08', '#ff5a1c', 0.1, 0.09, { glow: 0.3 })
    for (const s of [-1, 1]) {
      horn(b, 0.055, 0.34, s * 0.07, 0.12, 0, s, 0.85, 0, K.LAVA, '#1e0a08', '#ff5a1c', { glow: 0.3, flat: true })
      horn(b, 0.032, 0.15, s * 0.07, 0.07, 0, s, -0.35, 0, K.LAVA, '#1e0a08', '#ff5a1c', { glow: 0.3, flat: true })
    }
    ;[
      [0.24, 0.62],
      [-0.25, 1.05],
      [0.23, 1.5],
      [-0.22, 1.86],
    ].forEach(([x, y]) => gem(b, 0.034, x, y, 0, '#ffb43a', '#ff3b00', 0.9, 1, 1.7, 1))
    grip(b, 0.037, K.GRIP, '#2a1210', '#5a1a10')
    collars(b, 0.037, K.LAVA, '#1e0a08', '#ff5a1c', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.3 })
    gem(b, 0.068, 0, -0.31, 0, '#ff7a1c', '#ff2a00', 0.9, 1, 1.3, 1)
    return b.build()
  },

  /** A lightning bolt: a crackling zig-zag blade, a ring of light round its base, a spiked guard, a thunder orb. */
  platinum() {
    const b = new SwordBuilder()
    const { curve, rows } = zigzag([
      [0, 0],
      [0.17, 0.09],
      [0.34, -0.075],
      [0.51, 0.09],
      [0.68, -0.075],
      [0.85, 0.065],
      [1, 0.015],
    ])
    b.add(blade({ y1: 2.0, rows, w: (u) => 0.118 * (1 - u ** 1.6), t: (u) => 0.045 * (1 - 0.7 * u), curve, bevel: 0.34 }), K.THUNDER, '#ffd21f', '#7fe6ff', { glow: 0.4 })
    b.add(new TorusGeometry(0.17, 0.013, 3, 14), K.NEON, '#7fe6ff', '#7fe6ff', { glow: 0.6, m: at(0, 0.32, 0, Math.PI / 2 - 0.3, 0, 0.2) })
    bar(b, 0.4, 0.11, K.METAL, '#2a3a66', '#7fe6ff', 0.06, 0.085)
    for (const s of [-1, 1]) {
      horn(b, 0.03, 0.17, s * 0.2, 0.11, 0, s, 0.25, 0, K.NEON, '#7fe6ff', '#7fe6ff', { glow: 0.6 })
      horn(b, 0.026, 0.15, s * 0.12, 0.13, 0, s * 0.4, 1, 0, K.NEON, '#ffe23a', '#ffe23a', { glow: 0.6 })
      horn(b, 0.022, 0.11, s * 0.15, 0.09, 0, s * 0.5, -1, 0, K.NEON, '#7fe6ff', '#7fe6ff', { glow: 0.6 })
    }
    grip(b, 0.036, K.GRIP, '#1a2a66', '#ffd21f')
    collars(b, 0.036, K.METAL, '#2a3a66', '#7fe6ff')
    orb(b, 0.07, 0, -0.31, 0, K.NEON, '#ffe23a', '#ffe23a', { glow: 0.7 })
    return b.build()
  },

  /** An emerald fang curving like a serpent's tooth, a second fang off the guard, emeralds floating by. */
  emerald() {
    const b = new SwordBuilder()
    b.add(
      blade({ y1: 2.03, w: (u) => 0.165 * (1 - u) ** 0.85, t: (u) => 0.064 * (1 - u) ** 0.7, curve: (u) => 0.16 * u ** 2.2, bevel: 0.22, n: 10, spread: 1.1 }),
      K.GEM,
      '#2bd17a',
      '#0a7a3c',
      { glow: 0.3, flat: true },
    )
    b.add(
      blade({ y0: 0, y1: 0.55, w: (u) => 0.06 * (1 - u) ** 0.8, t: (u) => 0.03 * (1 - u) ** 0.7, curve: (u) => 0.1 * u * u, bevel: 0.25, n: 6, spread: 1 }),
      K.GEM,
      '#2bd17a',
      '#0a7a3c',
      { glow: 0.3, flat: true, m: at(-0.12, 0.12, 0, 0, 0, 0.95) },
    )
    bar(b, 0.38, 0.11, K.CHROME, '#ffffff', '#5a6a7a', 0.065, 0.09)
    for (const s of [-1, 1]) knob(b, 0.042, s * 0.2, 0.11, 0, K.CHROME, '#ffffff', '#5a6a7a')
    gem(b, 0.042, 0, 0.11, 0, '#2bd17a', '#0a7a3c', 0.5, 1, 1, 1.5)
    gem(b, 0.04, 0.3, 0.9, 0, '#5fffa0', '#0a7a3c', 0.6, 1, 1.8, 1)
    gem(b, 0.032, -0.18, 1.35, 0, '#5fffa0', '#0a7a3c', 0.6, 1, 1.8, 1)
    grip(b, 0.036, K.GRIP, '#e8eef6', '#2bd17a')
    collars(b, 0.036, K.CHROME, '#ffffff', '#5a6a7a')
    b.add(new CylinderGeometry(0.044, 0.03, 0.05, 10), K.CHROME, '#ffffff', '#5a6a7a', { m: at(0, -0.265, 0) })
    gem(b, 0.064, 0, -0.33, 0, '#2bd17a', '#0a7a3c', 0.5, 1, 1.4, 1)
    return b.build()
  },

  /** A ruby flamberge: wavy flame-like edges, golden flames licking up from the guard, flames for a pommel. */
  ruby() {
    const b = new SwordBuilder()
    const w = (u) => {
      const body = (0.12 - 0.028 * u) * (1 + 0.17 * Math.sin(u * Math.PI * 10))
      return u < 0.86 ? body : body * Math.max(0, 1 - (u - 0.86) / 0.14)
    }
    b.add(blade({ y1: 2.1, w, t: (u) => 0.048 * (1 - 0.6 * u), bevel: 0.28, n: 28, spread: 1 }), K.GEM, '#ff3b5c', '#a00a2a', { glow: 0.3, flat: true })
    bar(b, 0.13, 0.1, K.GOLD, ...GOLD, 0.08, 0.075)
    pair(b, () => flame(1.05, 0.05), 0.05, 0, K.GOLD, ...GOLD)
    grip(b, 0.037, K.GRIP, '#5a0a14', '#ffcf3a')
    collars(b, 0.037, K.GOLD, ...GOLD)
    b.add(plate(flame(0.5, 0), 0.04, 0).applyMatrix4(at(0, -0.24, 0, Math.PI, 0, 0)), K.GOLD, ...GOLD)
    b.add(plate(flame(0.5, 0), 0.04, 0).applyMatrix4(at(0, -0.24, 0, 0, 0, Math.PI)), K.GOLD, ...GOLD)
    gem(b, 0.05, 0, -0.29, 0, '#ff3b5c', '#a00a2a', 0.55, 1, 1.3, 1)
    return b.build()
  },

  /** A huge faceted diamond blade crowned with crystals at its tip, a crystal fan for a guard, shards floating round it. */
  diamond() {
    const b = new SwordBuilder()
    const y1 = 2.15
    b.add(blade({ y1, w: taper(0.19, 0.158, 0.16), t: 0.072, bevel: 0.3, n: 9 }), K.GEM, '#bff0ff', '#5fc8ff', { glow: 0.35, flat: true })
    for (const s of [-1, 1]) shard(b, 0.05, 0.42, s * 0.16, y1 - 0.42, 0, s * 0.45, 1, 0, K.GEM, '#e8fbff', '#5fc8ff', 0.45)
    bar(b, 0.26, 0.1, K.CHROME, '#ffffff', '#9ad8ff', 0.07, 0.1)
    for (let i = 0; i < 6; i += 1) {
      const a = (i < 3 ? -1 : 1) * (0.35 + (i % 3) * 0.42)
      shard(b, 0.055, 0.33, Math.sin(a) * 0.2, 0.1 + Math.cos(a) * 0.09, 0, Math.sin(a), Math.cos(a), 0, K.GEM, '#e8fbff', '#5fc8ff', 0.45)
    }
    ;[
      [0.32, 0.75],
      [-0.33, 1.1],
      [0.31, 1.45],
      [-0.29, 1.78],
    ].forEach(([x, y]) => gem(b, 0.04, x, y, 0, '#e8fbff', '#5fc8ff', 0.6, 1, 2, 0.8))
    grip(b, 0.037, K.GRIP, '#e8fbff', '#5fc8ff')
    collars(b, 0.037, K.CHROME, '#ffffff', '#9ad8ff')
    b.add(new CylinderGeometry(0.046, 0.03, 0.05, 10), K.CHROME, '#ffffff', '#9ad8ff', { m: at(0, -0.265, 0) })
    gem(b, 0.085, 0, -0.34, 0, '#e8fbff', '#5fc8ff', 0.55, 1, 1.4, 0.9)
    return b.build()
  },

  /** A wide blade glowing every colour, a prism core, a prismatic star guard, five prisms fanned above it. */
  rainbow() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 2.2, w: taper(0.172, 0.146, 0.14), t: 0.044, bevel: 0.48, n: 9 }), K.RAINBOW, '#ffffff', '#ffffff', { glow: 0.5 })
    b.add(blade({ y0: 0.16, y1: 2.0, w: taper(0.036, 0.03, 0.12), t: 0.056, bevel: 0.5, n: 8 }), K.PRISM, '#ffffff', '#ffffff', { glow: 0.45 })
    b.add(plate(star(5, 0.22, 0.095, 0.12), 0.055, 0.006, 3), K.PRISM, '#ffffff', '#ffffff', { glow: 0.35 })
    for (let i = 0; i < 5; i += 1) {
      const a = Math.PI / 2 + (i - 2) * 0.48
      gem(b, 0.036, Math.cos(a) * 0.34, 0.2 + Math.sin(a) * 0.3, 0, '#ffffff', '#ffd6ff', 0.6, 1, 1.8, 1, K.PRISM)
    }
    grip(b, 0.037, K.GRIP, '#ffffff', '#ff7ad9')
    collars(b, 0.037, K.PRISM, '#ffffff', '#ffffff', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.3 })
    b.add(plate(star(5, 0.09, 0.042, 0), 0.04, 0, 3).applyMatrix4(at(0, -0.32, 0)), K.PRISM, '#ffffff', '#ffffff', { glow: 0.4 })
    return b.build()
  },

  /** A unicorn's horn: a twisted spiral blade, a gold collar, white feathered wings, hearts and a gem pommel. */
  unicorn() {
    const b = new SwordBuilder()
    b.add(
      blade({ y1: 2.25, w: (u) => 0.13 * (1 - u) ** 0.85, t: (u) => 0.07 * (1 - u) ** 0.85, twist: (u) => u * Math.PI * 5, bevel: 0.55, n: 26, spread: 1 }),
      K.PASTEL,
      '#ffb6e6',
      '#ffffff',
      { glow: 0.3 },
    )
    band(b, 0.1, 0.14, 0.06, K.GOLD, '#ffe6f6', '#ffffff')
    pair(b, () => wing(1.0, 0.07, 5), 0.045, 0, K.FEATHER, '#ffffff', '#ffb6e6', { glow: 0.2 })
    for (const [x, y] of [
      [0.24, 0.9],
      [-0.22, 1.4],
    ]) {
      gem(b, 0.034, x, y, 0, '#ff7ad9', '#c69bff', 0.6, 1.2, 1, 0.7)
    }
    grip(b, 0.036, K.GRIP, '#ffffff', '#ffb6e6')
    collars(b, 0.036, K.GOLD, '#ffe6f6', '#ffffff')
    gem(b, 0.066, 0, -0.31, 0, '#c69bff', '#ff7ad9', 0.55, 1, 1.4, 1)
    return b.build()
  },

  /** A galaxy saber: a curved blade full of stars, a crescent moon, stars and a little planet floating, a ringed planet pommel. */
  galaxy() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 2.3, w: taper(0.138, 0.12, 0.13), t: 0.044, curve: (u) => -0.1 * u * u, bevel: 0.42, n: 11 }), K.GALAXY, '#120a2a', '#7a3cff', { glow: 0.35 })
    b.add(plate(crescent(0.25, 0.18, 0.05), 0.055, 0.006), K.GLOSS, '#e8e6ff', '#e8e6ff', { glow: 0.4 })
    ;[
      [0.26, 0.7],
      [-0.27, 1.25],
      [0.2, 1.8],
    ].forEach(([x, y]) => gem(b, 0.028, x, y, 0, '#ffffff', '#c69bff', 1, 1, 1.6, 1, K.NEON))
    knob(b, 0.05, 0.3, 1.45, 0.05, K.PLAIN, '#ffb45a', '#ffb45a', { glow: 0.3 })
    grip(b, 0.037, K.GRIP, '#1a0a3a', '#a46bff')
    collars(b, 0.037, K.GLOSS, '#e8e6ff', '#e8e6ff', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.3 })
    ball(b, 0.078, -0.32, K.GALAXY, '#120a2a', '#7a3cff', { glow: 0.35 })
    b.add(new TorusGeometry(0.125, 0.013, 3, 16), K.NEON, '#c69bff', '#c69bff', { glow: 0.6, m: at(0, -0.32, 0, Math.PI / 2 - 0.45, 0, 0.3) })
    return b.build()
  },

  /** The Dragon Slayer: a massive serrated rune blade, a horned dragon's head with burning eyes, bat wings, a claw-held orb. */
  dragon() {
    const b = new SwordBuilder()
    const teeth = 10
    const rows = toothRows(teeth, 0.9)
    const tip = closeFrom(0.9)
    b.add(
      blade({
        y1: 2.35,
        rows,
        w: (u) => (0.18 - 0.03 * u) * tip(u),
        wL: (u) => (0.1 + 0.05 * sawAt(u, teeth, 0.9)) * tip(u),
        t: (u) => 0.06 * (1 - 0.4 * u),
        curve: (u) => 0.03 * u,
        edgeL: (u) => 0.035 * (1 - 0.4 * u) * tip(u),
        bevel: 0.3,
        bevelL: 0.8,
      }),
      K.RUNES,
      '#4a5656',
      '#4cff7a',
    )
    const scales = ['#22a552', '#0f6a2e']
    b.add(new BoxGeometry(0.2, 0.13, 0.13), K.SCALES, ...scales, { m: at(0, 0.11, 0) })
    b.add(new BoxGeometry(0.14, 0.06, 0.1), K.SCALES, ...scales, { m: at(0, 0.2, 0) })
    pair(b, () => batWing(0.95, 0.05), 0.035, 0, K.SCALES, '#1a7a3c', '#0a3a1c')
    for (const s of [-1, 1]) {
      horn(b, 0.036, 0.26, s * 0.08, 0.15, 0, s, 0.55, 0, K.BONE, '#efe4c8', '#a89a78', { flat: true })
      for (const z of [-0.067, 0.067]) gem(b, 0.02, s * 0.05, 0.14, z, '#ffe23a', '#ffe23a', 1, 1, 1, 1, K.NEON)
    }
    grip(b, 0.041, K.SCALES, ...scales)
    band(b, 0.048, 0.05, 0.035, K.METAL, '#3a4646', '#4cff7a')
    knob(b, 0.062, 0, -0.3, 0, K.NEON, '#4cff7a', '#4cff7a', { glow: 0.8 })
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2
      horn(b, 0.017, 0.11, Math.cos(a) * 0.046, -0.25, Math.sin(a) * 0.046, Math.cos(a) * 0.4, -1, Math.sin(a) * 0.4, K.BONE, '#efe4c8', '#a89a78', { flatZ: 1 }, 4)
    }
    return b.build()
  },

  /** A cyber blade: a neon energy blade with a white-hot core, a finned chrome emitter, two holographic rings, a carbon hilt. */
  cosmic() {
    const b = new SwordBuilder()
    const y1 = 2.38
    b.add(blade({ y1, w: taper(0.09, 0.08, 0.08, 'round'), t: 0.032, bevel: 0.5, rows: rowsWithTip(8, 0.92, 4) }), K.NEON, '#3fd8ff', '#3fd8ff', { glow: 1 })
    b.add(blade({ y0: 0.14, y1: y1 - 0.05, w: taper(0.032, 0.028, 0.08, 'round'), t: 0.04, bevel: 0.5, rows: rowsWithTip(6, 0.92, 3) }), K.NEON, '#ffffff', '#ffffff', { glow: 1 })
    for (const [y, r] of [
      [0.75, 0.22],
      [1.55, 0.19],
    ]) {
      b.add(new TorusGeometry(r, 0.01, 3, 14), K.NEON, '#3fd8ff', '#3fd8ff', { glow: 0.8, m: at(0, y, 0, Math.PI / 2 + 0.25, 0, -0.2) })
    }
    bar(b, 0.22, 0.11, K.CHROME, '#ffffff', '#4a5a75', 0.085, 0.1)
    bar(b, 0.23, 0.11, K.NEON, '#3fd8ff', '#3fd8ff', 0.022, 0.105, { glow: 1 })
    for (const s of [-1, 1]) bar(b, 0.14, 0.09, K.CHROME, '#ffffff', '#4a5a75', 0.035, 0.05, { x: s * 0.15, rz: s * -0.5 })
    b.add(new CylinderGeometry(0.045, 0.047, HANDLE_TOP - HANDLE_BOTTOM, 10, 1, true), K.CARBON, '#1a1d24', '#3a404d', { m: at(0, (HANDLE_TOP + HANDLE_BOTTOM) / 2, 0) })
    for (const y of [0.02, -0.1, -0.22]) band(b, 0.05, y, 0.016, K.NEON, '#3fd8ff', '#3fd8ff', { glow: 1 })
    b.add(new CylinderGeometry(0.052, 0.04, 0.06, 10), K.CHROME, '#ffffff', '#4a5a75', { m: at(0, -0.27, 0) })
    b.add(new IcosahedronGeometry(0.032, 0), K.NEON, '#5fd6ff', '#5fd6ff', { glow: 1, m: at(0, -0.31, 0) })
    return b.build()
  },

  /** The Infinity Blade: a prismatic crystal blade with a shining core, three rings circling it, the infinity sign, prism wings. */
  infinity() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 2.43, w: taper(0.186, 0.156, 0.14), t: 0.064, bevel: 0.36, n: 10 }), K.PRISM, '#ffffff', '#ffffff', { glow: 0.4 })
    b.add(blade({ y0: 0.18, y1: 2.2, w: taper(0.034, 0.028, 0.12), t: 0.076, bevel: 0.5, n: 8 }), K.NEON, '#ffffff', '#ffffff', { glow: 0.6 })
    ;[0.85, 1.4, 1.95].forEach((y, i) => {
      b.add(new TorusGeometry(0.31 - i * 0.03, 0.012, 3, 16), K.NEON, '#ffffff', '#ffffff', { glow: 0.55, m: at(0, y, 0, Math.PI / 2 + (i - 1) * 0.4, 0, (i - 1) * 0.28) })
    })
    bar(b, 0.15, 0.11, K.GLOSS, '#ffffff', '#ffffff', 0.1, 0.08, { glow: 0.3 })
    pair(b, () => wing(1.2, 0.05, 5), 0.045, 0, K.PRISM, '#ffffff', '#ffffff', { glow: 0.35 })
    b.add(plate(infinitySign(0.13, 0.2), 0.04, 0, 3), K.GOLD, '#fff3c4', '#ffffff', { glow: 0.3 })
    grip(b, 0.038, K.GRIP, '#ffffff', '#c69bff')
    collars(b, 0.038, K.PRISM, '#ffffff', '#ffffff', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.3 })
    b.add(new OctahedronGeometry(0.082, 0), K.PRISM, '#ffffff', '#ffffff', { glow: 0.45, flat: true, m: at(0, -0.34, 0, 0, 0, 0, 1, 1.4, 1) })
    return b.build()
  },

  // --- Legend: the third row --------------------------------------------------------

  /** The Soul Reaper: a ghostly blade crowned by a scythe's hook, bone spurs at the guard, a grinning skull with glowing eyes. */
  reaper() {
    const b = new SwordBuilder()
    const ghost = ['#0e3a3a', '#5fffe0']
    b.add(blade({ y1: 2.47, w: taper(0.105, 0.088, 0.1), t: 0.04, bevel: 0.36, n: 10 }), K.GHOST, ...ghost, { glow: 0.35 })
    // The scythe's hook: out to the left from near the top, curving down, its edge on the inside.
    b.add(
      blade({
        y0: 0,
        y1: 0.74,
        w: (u) => 0.05 * (1 - u) + 0.004,
        wL: (u) => 0.13 * (1 - u) ** 0.75,
        t: (u) => 0.042 * (1 - 0.75 * u),
        curve: (u) => -0.42 * u * u,
        edge: (u) => 0.028 * (1 - u),
        edgeL: 0,
        bevel: 0.8,
        bevelL: 0.3,
        n: 11,
        spread: 1.1,
      }),
      K.GHOST,
      ...ghost,
      { glow: 0.35, m: at(0.02, 2.24, 0, 0, 0, Math.PI / 2 - 0.3) },
    )
    bar(b, 0.2, 0.11, K.METAL, '#2a3434', '#5fffe0', 0.08, 0.09)
    for (const s of [-1, 1]) {
      horn(b, 0.03, 0.22, s * 0.09, 0.12, 0, s, 0.7, 0, K.BONE, '#efe4c8', '#a89a78', { flat: true })
      horn(b, 0.024, 0.14, s * 0.09, 0.09, 0, s, -0.6, 0, K.BONE, '#efe4c8', '#a89a78', { flat: true })
    }
    grip(b, 0.036, K.GRIP, '#1a2222', '#3fbfa8')
    collars(b, 0.036, K.METAL, '#2a3434', '#5fffe0')
    ball(b, 0.078, -0.32, K.BONE, '#efe4c8', '#b8a882', { sy: 1.05 })
    bar(b, 0.075, -0.395, K.BONE, '#efe4c8', '#b8a882', 0.04, 0.07)
    for (const s of [-1, 1]) for (const z of [-0.068, 0.068]) gem(b, 0.021, s * 0.028, -0.31, z, '#5fffe0', '#5fffe0', 1, 1, 1, 1, K.NEON)
    return b.build()
  },

  /** The Twin Moon Blade: two parallel silver-blue blades rising from one great crescent, moonstones on its horns. */
  twinmoon() {
    const b = new SwordBuilder()
    for (const s of [-1, 1]) {
      b.add(
        blade({ y0: 0.12, y1: 2.5, w: taper(0.072, 0.062, 0.12), t: 0.034, curve: (u) => s * (0.13 + 0.035 * Math.sin(Math.PI * u)), bevel: 0.36, n: 10 }),
        K.INLAY,
        '#e6f0ff',
        '#7fb6ff',
      )
    }
    b.add(plate(crescent(0.33, 0.21, 0.0, 0.3), 0.06, 0.006), K.METAL, '#dfeaff', '#6f8fc8')
    for (const s of [-1, 1]) knob(b, 0.045, s * 0.33, 0.215, 0, K.GLOSS, '#cfe6ff', '#cfe6ff', { glow: 0.45 })
    gem(b, 0.04, 0, 0.08, 0, '#9fd0ff', '#3a6ad0', 0.55, 1, 1.2, 1.8)
    grip(b, 0.036, K.GRIP, '#1a2a4a', '#cfe0ff')
    collars(b, 0.036, K.METAL, '#dfeaff', '#6f8fc8')
    b.add(plate(crescent(0.085, 0.06, -0.045), 0.035, 0).applyMatrix4(at(0, -0.33, 0, Math.PI, 0, 0)), K.METAL, '#dfeaff', '#6f8fc8')
    knob(b, 0.032, 0, -0.31, 0, K.GLOSS, '#cfe6ff', '#cfe6ff', { glow: 0.45 })
    return b.build()
  },

  /** The Titan Axe-Sword: a broad bronze greatsword with a bearded axe head near its tip, set in rough stone. */
  titanaxe() {
    const b = new SwordBuilder()
    const bronze = ['#d0903e', '#7a4a18']
    b.add(blade({ y1: 2.54, w: taper(0.152, 0.13, 0.12), t: 0.044, bevel: 0.36, n: 10 }), K.COPPER, ...bronze)
    b.add(plate(axeHead(1.05), 0.042, 0.012, 3).applyMatrix4(at(0.07, 1.98, 0)), K.BLADE, '#f0c27a', '#9a6a2a')
    horn(b, 0.05, 0.22, -0.11, 1.98, 0, -1, 0.25, 0, K.COPPER, ...bronze, { flat: true })
    b.add(lumpy(new BoxGeometry(0.32, 0.17, 0.13, 2, 1, 1), 0.1, 7), K.STONE, '#8a8f96', '#5c6168', { m: at(0.02, 1.98, 0), flat: true })
    gem(b, 0.03, 0.02, 1.98, 0, '#ffb45a', '#ff6a00', 0.7, 1, 1, 2.6)
    b.add(lumpy(new BoxGeometry(0.48, 0.13, 0.15, 3, 1, 2), 0.11, 9), K.STONE, '#8a8f96', '#5c6168', { m: at(0, 0.11, 0), flat: true })
    grip(b, 0.04, K.LEATHER, '#5a3418', '#d0903e')
    collars(b, 0.04, K.COPPER, ...bronze)
    b.add(new CylinderGeometry(0.05, 0.05, 0.05, 10), K.COPPER, ...bronze, { m: at(0, -0.27, 0) })
    b.add(lumpy(new IcosahedronGeometry(0.075, 0), 0.18, 11), K.STONE, '#8a8f96', '#5c6168', { m: at(0, -0.33, 0, 0.3, 0.5, 0), flat: true })
    return b.build()
  },

  /** The Sawtooth Ripper: a heavy dark blade lined both sides with glowing red teeth, an engine block for a guard. */
  sawtooth() {
    const b = new SwordBuilder()
    const y1 = 2.58
    const wf = taper(0.13, 0.112, 0.1)
    b.add(blade({ y1, w: wf, t: 0.046, edge: 0.014, bevel: 0.55, n: 10 }), K.METAL, '#3a3f48', '#8a92a0')
    for (let i = 0; i < 8; i += 1) {
      const y = 0.42 + i * 0.25
      const u = (y - 0.1) / (y1 - 0.1)
      for (const s of [-1, 1]) horn(b, 0.036, 0.12, s * wf(u) * 0.92, y, 0, s, 0.75, 0, K.NEON, '#ff2a2a', '#ff2a2a', { glow: 0.75, flatZ: 0.5 }, 4)
    }
    bar(b, 0.26, 0.11, K.METAL, '#2a2e36', '#ff2a2a', 0.12, 0.12)
    for (const s of [-1, 1]) b.add(new CylinderGeometry(0.022, 0.022, 0.16, 8, 1, true), K.CHROME, '#d8dee8', '#4a5262', { m: at(s * 0.1, 0.2, 0.045, 0, 0, s * -0.3) })
    grip(b, 0.038, K.GRIP, '#1a1a1e', '#ff2a2a')
    collars(b, 0.038, K.METAL, '#2a2e36', '#ff2a2a')
    knob(b, 0.056, 0, -0.29, 0, K.METAL, '#2a2e36', '#8a92a0')
    gem(b, 0.026, 0, -0.29, 0, '#ff2a2a', '#9a0a0a', 0.8, 1, 1, 2.4)
    return b.build()
  },

  /** The Phoenix Wing: a blade shaped like a burning feather, fiery feathers and flames off the guard, a tail of plumes. */
  phoenixwing() {
    const b = new SwordBuilder()
    const notches = 9
    const rows = toothRows(notches, 0.9, [0.93, 0.97, 1])
    const vane = (u) => 0.09 + 0.085 * Math.sin(Math.PI * Math.min(1, u / 0.95)) ** 0.8
    b.add(
      blade({
        y1: 2.62,
        rows,
        w: (u) => vane(u) * (0.8 + 0.25 * sawAt(u, notches, 0.9)) * closeFrom(0.9)(u),
        wL: (u) => (0.06 * (1 - u) ** 0.6 + 0.004) * closeFrom(0.95)(u),
        t: (u) => 0.042 * (1 - 0.6 * u),
        curve: (u) => 0.09 * u * u,
        bevel: 0.32,
      }),
      K.FEATHER,
      '#ffcf3a',
      '#ff3b1a',
      { glow: 0.45 },
    )
    for (const s of [-1, 1]) {
      b.add(plate(feather(1.4), 0.03, 0).applyMatrix4(at(s * 0.08, 0.12, 0, 0, 0, -s * 0.9)), K.FEATHER, '#ffcf3a', '#ff5a1c', { glow: 0.45 })
    }
    pair(b, () => flame(0.85, 0.05), 0.045, 0, K.FEATHER, '#ffcf3a', '#ff3b1a', { glow: 0.5 })
    bar(b, 0.13, 0.1, K.GOLD, ...GOLD, 0.08, 0.08)
    gem(b, 0.036, 0, 0.11, 0, '#ff3b1a', '#9a1a00', 0.7, 1, 1.2, 1.6)
    grip(b, 0.037, K.GRIP, '#7a1a0a', '#ffcf3a')
    collars(b, 0.037, K.GOLD, ...GOLD)
    for (const a of [-0.5, 0, 0.5]) horn(b, 0.026, 0.17, Math.sin(a) * 0.02, -0.25, 0, Math.sin(a), -1, 0, K.FEATHER, '#ffcf3a', '#ff3b1a', { glow: 0.5 })
    gem(b, 0.03, 0, -0.26, 0, '#ffcf3a', '#ff5a1c', 0.8)
    return b.build()
  },

  /** The Abyssal Trident Blade: a deep-sea blade splitting into three prongs, tentacles coiled round its guard, a pearl. */
  abyssal() {
    const b = new SwordBuilder()
    const deep = ['#061a3a', '#1f8fbf']
    b.add(blade({ y1: 2.18, w: (u) => (0.152 - 0.02 * u) * (u < 0.9 ? 1 : 1 - 0.6 * ((u - 0.9) / 0.1)), t: 0.046, bevel: 0.36, n: 9, spread: 1.1 }), K.GALAXY, ...deep, { glow: 0.35 })
    b.add(blade({ y0: 2.05, y1: 2.66, w: taper(0.056, 0.046, 0.35), t: 0.032, bevel: 0.36, n: 6, spread: 1 }), K.GALAXY, ...deep, { glow: 0.4 })
    for (const s of [-1, 1]) {
      b.add(
        blade({ y0: 1.98, y1: 2.5, w: (u) => 0.046 * (1 - 0.3 * u) * closeFrom(0.65)(u), t: 0.03, curve: (u) => s * (0.08 + 0.12 * Math.sqrt(u)), bevel: 0.36, n: 6, spread: 1 }),
        K.GALAXY,
        ...deep,
        { glow: 0.4 },
      )
    }
    bar(b, 0.22, 0.11, K.GALAXY, '#0a2448', '#2fe0ff', 0.1, 0.1, { glow: 0.25 })
    const tentacle = ['#3a2a6a', '#7a4ab0']
    b.add(new TorusGeometry(0.1, 0.018, 3, 9, Math.PI * 1.5), K.SCALES, ...tentacle, { m: at(0, 0.13, 0, Math.PI / 2 - 0.25, 0, 0.3) })
    b.add(new TorusGeometry(0.085, 0.016, 3, 9, Math.PI * 1.4), K.SCALES, ...tentacle, { m: at(0, 0.03, 0, Math.PI / 2 + 0.3, 2.2, -0.2) })
    for (const s of [-1, 1]) horn(b, 0.02, 0.14, s * 0.13, 0.15, 0, s, 0.9, 0.2, K.SCALES, ...tentacle, { flatZ: 1 }, 4)
    grip(b, 0.037, K.GRIP, '#0a2448', '#2fe0ff')
    collars(b, 0.037, K.GLOSS, '#2fe0ff', '#2fe0ff', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.4 })
    ball(b, 0.075, -0.32, K.GLOSS, '#eaf6ff', '#eaf6ff', { glow: 0.25 })
    return b.build()
  },

  /** The Blossom Dancer: a slender curved pink blade scattered with blossoms, a flower for a guard, petals drifting by. */
  blossom() {
    const b = new SwordBuilder()
    const w = (u) => (u < 0.88 ? 0.094 - 0.012 * u : 0.083 * (1 - (u - 0.88) / 0.12))
    const wL = (u) => (u < 0.9 ? 0.03 : 0.03 * (1 - (u - 0.9) / 0.1))
    b.add(
      blade({ y1: 2.7, w, wL, t: 0.034, curve: (u) => -0.22 * u * u, edgeL: (u) => (u < 0.9 ? 0.022 : 0.022 * (1 - (u - 0.9) / 0.1)), bevel: 0.3, bevelL: 0.85, n: 13, spread: 1.15 }),
      K.PETALS,
      '#ff8fc0',
      '#ffffff',
      { glow: 0.2 },
    )
    b.add(plate(flower(5, 0.18, 0.08, 0.11, 25), 0.045, 0), K.GLOSS, '#ffb3d6', '#ffb3d6', { glow: 0.25 })
    gem(b, 0.04, 0, 0.11, 0, '#ffe27a', '#ffb000', 0.6, 1, 1, 1.4)
    ;[
      [0.26, 0.85, 0.6],
      [-0.24, 1.4, -0.5],
      [0.2, 2.0, 1.1],
    ].forEach(([x, y, r]) => b.add(new SphereGeometry(1, 5, 3), K.PLAIN, '#ffc0e0', '#ffc0e0', { glow: 0.35, m: at(x, y, 0, 0, 0, r, 0.05, 0.028, 0.012) }))
    grip(b, 0.035, K.GRIP, '#ffffff', '#ff8fc0')
    collars(b, 0.035, K.GLOSS, '#ffb3d6', '#ffb3d6')
    b.add(plate(flower(5, 0.075, 0.035, 0, 15), 0.03, 0).applyMatrix4(at(0, -0.3, 0)), K.GLOSS, '#ffb3d6', '#ffb3d6', { glow: 0.25 })
    gem(b, 0.022, 0, -0.3, 0, '#ffe27a', '#ffb000', 0.6, 1, 1, 1.8)
    return b.build()
  },

  /** The Celestial Halo Blade: a white-gold blade with a golden core, great feathered wings and a halo ring behind it. */
  celestial() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 2.74, w: taper(0.152, 0.126, 0.13), t: 0.041, bevel: 0.42, n: 10 }), K.INLAY, '#fff8e6', '#ffcf3a')
    b.add(blade({ y0: 0.16, y1: 2.45, w: taper(0.03, 0.025, 0.12), t: 0.05, bevel: 0.5, n: 8 }), K.GLOSS, '#ffd86a', '#ffd86a', { glow: 0.5 })
    pair(b, () => wing(1.35, 0.05, 5), 0.045, 0, K.FEATHER, '#ffffff', '#ffd86a', { glow: 0.25 })
    b.add(new TorusGeometry(0.3, 0.02, 3, 20), K.NEON, '#ffe27a', '#ffe27a', { glow: 0.7, m: at(0, 2.25, -0.14) })
    bar(b, 0.14, 0.11, K.GOLD, ...GOLD, 0.1, 0.08)
    gem(b, 0.045, 0, 0.11, 0, '#fff6c4', '#ffcf3a', 0.8, 1, 1.2, 1.4)
    grip(b, 0.037, K.GRIP, '#ffffff', '#ffcf3a')
    collars(b, 0.037, K.GOLD, ...GOLD)
    ball(b, 0.072, -0.31, K.GOLD, '#ffe48a', '#ffffff', { glow: 0.2 })
    return b.build()
  },

  /** The Void Rift Edge: a jagged black glass blade cracked open with violet light, shards of the void circling it. */
  voidrift() {
    const b = new SwordBuilder()
    const chip = (u, s) => 0.85 + 0.3 * hash3(u * 17.3, s, 1.7)
    const body = (u) => (0.15 - 0.025 * u) * closeFrom(0.85)(u)
    b.add(blade({ y1: 2.78, w: (u) => body(u) * chip(u, 1), wL: (u) => body(u) * chip(u, 2), t: (u) => 0.048 * (1 - 0.5 * u), bevel: 0.34, n: 12, spread: 1.15 }), K.CRACK, '#0a0612', '#b14dff', { glow: 0.2 })
    ;[
      [0.3, 0.7, 0.4],
      [-0.31, 1.0, -0.3],
      [0.28, 1.4, 0.8],
      [-0.27, 1.8, -0.7],
      [0.24, 2.2, 0.2],
      [-0.2, 2.5, -0.2],
    ].forEach(([x, y, a]) => shard(b, 0.04, 0.2, x, y, 0, Math.sin(a), Math.cos(a), 0, K.CRACK, '#1a0a2a', '#b14dff', 0.5))
    bar(b, 0.18, 0.11, K.CRACK, '#120a1a', '#b14dff', 0.09, 0.09)
    for (const s of [-1, 1]) {
      shard(b, 0.04, 0.3, s * 0.18, 0.18, 0, s, 0.9, 0, K.CRACK, '#120a1a', '#b14dff', 0.4)
      shard(b, 0.03, 0.18, s * 0.14, 0.05, 0, s, -0.7, 0, K.CRACK, '#120a1a', '#b14dff', 0.4)
    }
    grip(b, 0.037, K.GRIP, '#120a1a', '#7a3cff')
    collars(b, 0.037, K.NEON, '#b14dff', '#b14dff', HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.6 })
    ball(b, 0.075, -0.32, K.GLOSS, '#0a0612', '#0a0612', { glow: 0 })
    b.add(new TorusGeometry(0.11, 0.011, 3, 14), K.NEON, '#b14dff', '#b14dff', { glow: 0.8, m: at(0, -0.32, 0, Math.PI / 2 - 0.5, 0, 0.4) })
    return b.build()
  },

  /** The Aurora Crystal Blade: three stepped layers of crystal shifting green, teal and violet, crystals clustered at guard and pommel. */
  aurora() {
    const b = new SwordBuilder()
    const look = ['#3fffb0', '#3fd8ff']
    b.add(blade({ y1: 2.82, w: taper(0.184, 0.152, 0.15), t: 0.03, bevel: 0.3, n: 9 }), K.AURORA, ...look, { glow: 0.4, flat: true })
    b.add(blade({ y0: 0.14, y1: 2.6, w: taper(0.12, 0.1, 0.18), t: 0.047, bevel: 0.3, n: 8 }), K.AURORA, ...look, { glow: 0.45, flat: true })
    b.add(blade({ y0: 0.18, y1: 2.35, w: taper(0.055, 0.045, 0.2), t: 0.064, bevel: 0.3, n: 7 }), K.AURORA, ...look, { glow: 0.5, flat: true })
    bar(b, 0.16, 0.1, K.AURORA, ...look, 0.08, 0.09, { glow: 0.4 })
    for (let i = 0; i < 5; i += 1) {
      const a = (i - 2) * 0.5
      shard(b, 0.042, i === 2 ? 0.26 : 0.32, Math.sin(a + (i < 2 ? -0.5 : i > 2 ? 0.5 : 0)) * 0.17, 0.12, 0, Math.sin(a * 2.2), 0.6, 0, K.AURORA, ...look, 0.5)
    }
    for (const [x, y] of [
      [0.3, 1.1],
      [-0.3, 1.7],
    ]) {
      gem(b, 0.04, x, y, 0, '#7affd8', '#a46bff', 0.7, 1, 2, 0.8, K.AURORA)
    }
    grip(b, 0.037, K.GRIP, '#1a2a3a', '#3fffb0')
    collars(b, 0.037, K.AURORA, ...look, HANDLE_BOTTOM, HANDLE_TOP, { glow: 0.4 })
    for (const a of [-0.45, 0, 0.45]) shard(b, 0.035, 0.16, Math.sin(a) * 0.04, -0.3, 0, Math.sin(a), -1, 0, K.AURORA, ...look, 0.5)
    return b.build()
  },

  /** The Tempest Greatblade: a huge storm-blue blade forking into lightning at its tip and branching bolts, a storm cloud for a guard. */
  tempest() {
    const b = new SwordBuilder()
    const storm = ['#2a5aa8', '#bff4ff']
    b.add(blade({ y1: 2.36, w: (u) => (0.205 - 0.03 * u) * (u < 0.9 ? 1 : 1 - 0.65 * ((u - 0.9) / 0.1)), t: 0.05, bevel: 0.36, n: 10, spread: 1.1 }), K.THUNDER, ...storm, { glow: 0.4 })
    const bolt = (s) =>
      zigzag([
        [0, 0],
        [0.3, s * 0.05],
        [0.6, -s * 0.035],
        [1, s * 0.03],
      ]).curve
    const { rows: boltRows } = zigzag([
      [0, 0],
      [0.3, 0],
      [0.6, 0],
      [1, 0],
    ])
    const prong = (len, width, s, m) =>
      b.add(blade({ y0: 0, y1: len, w: (u) => width * (1 - u), t: (u) => width * 0.5 * (1 - 0.6 * u), curve: bolt(s), bevel: 0.36, rows: boltRows }), K.THUNDER, ...storm, { glow: 0.5, m })
    for (const s of [-1, 1]) {
      prong(0.66, 0.065, s, at(s * 0.075, 2.22, 0, 0, 0, -s * 0.32))
      prong(0.5, 0.05, -s, at(s * 0.17, 1.25, 0, 0, 0, -s * 0.75))
    }
    for (const [x, y, r] of [
      [-0.13, 0.12, 0.085],
      [0, 0.15, 0.1],
      [0.13, 0.12, 0.085],
      [0, 0.06, 0.08],
    ]) {
      knob(b, r, x, y, 0, K.PASTEL, '#8aa0c8', '#dfe8ff', { sz: 0.7 })
    }
    for (const s of [-1, 1]) horn(b, 0.025, 0.16, s * 0.07, 0.04, 0, s * 0.3, -1, 0, K.NEON, '#bff4ff', '#bff4ff', { glow: 0.8 }, 4)
    grip(b, 0.038, K.GRIP, '#1a2a4a', '#bff4ff')
    collars(b, 0.038, K.METAL, '#2a3a66', '#bff4ff')
    orb(b, 0.075, 0, -0.32, 0, K.NEON, '#9ff4ff', '#9ff4ff', { glow: 0.8 })
    return b.build()
  },

  /** The Eternity Godblade: a massive layered white-gold blade, a star with a blazing core, great wings, a crown, two rings orbiting. */
  eternity() {
    const b = new SwordBuilder()
    b.add(blade({ y1: 2.9, w: taper(0.222, 0.186, 0.14), t: 0.047, bevel: 0.36, n: 10 }), K.GOLD, '#ffe48a', '#ffffff', { glow: 0.15 })
    b.add(blade({ y0: 0.16, y1: 2.62, w: taper(0.112, 0.092, 0.16), t: 0.058, bevel: 0.4, n: 8 }), K.RUNES, '#fff6dc', '#5fe8ff')
    b.add(blade({ y0: 0.2, y1: 2.42, w: taper(0.032, 0.026, 0.14), t: 0.068, bevel: 0.5, n: 7 }), K.PRISM, '#ffffff', '#ffffff', { glow: 0.5 })
    b.add(plate(star(6, 0.22, 0.11, 0.13), 0.06, 0.006, 3), K.GOLD, '#ffd23a', '#ffffff', { glow: 0.2 })
    b.add(new IcosahedronGeometry(0.078, 1), K.NEON, '#ffffff', '#ffffff', { glow: 1, m: at(0, 0.13, 0) })
    pair(b, () => wing(1.55, 0.05, 5), 0.05, 0, K.FEATHER, '#ffffff', '#ffd23a', { glow: 0.3 })
    for (const [y, r, tilt] of [
      [1.15, 0.36, 0.42],
      [2.0, 0.31, -0.38],
    ]) {
      b.add(new TorusGeometry(r, 0.015, 3, 18), K.NEON, '#ffe27a', '#ffe27a', { glow: 0.7, m: at(0, y, 0, Math.PI / 2 + tilt, 0, tilt * 0.6) })
    }
    for (const x of [-0.1, -0.035, 0.035, 0.1]) horn(b, 0.02, Math.abs(x) < 0.05 ? 0.13 : 0.09, x, 0.3, 0, x * 1.5, 1, 0, K.GOLD, '#ffd23a', '#ffffff', {}, 4)
    grip(b, 0.04, K.GRIP, '#ffffff', '#ffcf3a')
    collars(b, 0.04, K.GOLD, '#ffd23a', '#ffffff')
    band(b, 0.046, -0.08, 0.025, K.NEON, '#5fe8ff', '#5fe8ff', { glow: 0.8 })
    ball(b, 0.078, -0.32, K.GOLD, '#ffd23a', '#ffffff', { glow: 0.2 })
    gem(b, 0.06, 0, -0.42, 0, '#5fe8ff', '#ffffff', 0.8, 1, 1.5, 1)
    return b.build()
  },
}

const geometries = new Map()

/**
 * How much sword `id` sparkles (the shine's star glints and lit edges: SWORD_GLSL
 * swordShine): none up to Rare, then rising with its rarity to 1 for the Divine (Legend)
 * swords.
 */
function sparkleOf(id) {
  const tire = TIRES.find((t) => t.id === id)
  const order = RARITIES[tire?.rarity]?.order ?? 0
  return Math.min(1, Math.max(0, (order - 2) / 5))
}

/** Sword `id`'s geometry, built the first time it's asked for and shared from then on. */
export function getSwordGeometry(id) {
  const key = BUILDERS[id] ? id : 'bicycle'
  let geometry = geometries.get(key)
  if (!geometry) {
    geometry = BUILDERS[key]()
    // Every vertex knows its sword's sparkle and length (aSword), for the shine.
    const count = geometry.getAttribute('position').count
    const info = new Float32Array(count * 2)
    const spark = sparkleOf(key)
    const length = geometry.boundingBox.max.y
    for (let i = 0; i < count; i += 1) {
      info[i * 2] = spark
      info[i * 2 + 1] = length
    }
    geometry.setAttribute('aSword', new BufferAttribute(info, 2))
    geometries.set(key, geometry)
  }
  return geometry
}

/** Grip to tip, metres (the tip's height in the sword's frame). */
export const swordLength = (id) => getSwordGeometry(id).boundingBox.max.y

/** The middle of the sword along its length (pommel to tip): what a thrown sword spins about. */
export const swordCenterY = (id) => {
  const box = getSwordGeometry(id).boundingBox
  return (box.min.y + box.max.y) / 2
}

// --- Avatars' swords ------------------------------------------------------------------

let avatarMaterial = null

/**
 * One sword: a single mesh (an avatar's, or one in flight). `mesh.setSword(id)` dresses
 * it as sword `id` (cheap, a no-op when unchanged: it swaps in that sword's shared
 * geometry). Every sword shares one material, and so one program. Placed every frame by
 * its holder.
 */
export function createSwordMesh() {
  avatarMaterial ??= createSwordMaterial(false)
  const mesh = new Mesh(getSwordGeometry('bicycle'), avatarMaterial)
  mesh.frustumCulled = false
  let shown = 'bicycle'
  mesh.setSword = (id) => {
    if (id === shown) return
    shown = id
    mesh.geometry = getSwordGeometry(id)
  }
  return mesh
}

/**
 * Lets a sword mesh go. Its geometry and material are shared by every sword (and the
 * shop), built once and kept, so there's nothing of its own to free - and it's left where
 * it is in the scene: React owns that (taking it out here lost the sword for good whenever
 * React re-ran the effect, as StrictMode does on every mount in dev).
 */
// eslint-disable-next-line no-unused-vars
export function disposeSwordMesh(mesh) {}

// --- The sword shop's showcase ------------------------------------------------------------

/**
 * Every sword in `entries` (`{ id, x, y, z, phase, scale? }`: the sword and where it
 * floats) in one mesh and one draw call: each its own `scale` (or the shared `scale`, the
 * largest any entry uses) times its size, upright, centred on its spot, and turned and
 * bobbed on it by the vertex shader (phase staggers them). Free it with
 * disposeSwordShowcase.
 */
export function createSwordShowcase(entries, scale = 1) {
  const parts = entries.map(({ id, x, y, z, phase, scale: own }) => {
    const g = getSwordGeometry(id).clone()
    const box = g.boundingBox
    // Centred on its middle, leaning back a touch.
    g.translate(0, -(box.min.y + box.max.y) / 2, 0)
    g.applyMatrix4(at(0, 0, 0, -0.1, 0, 0, own ?? scale))
    const count = g.getAttribute('position').count
    const centres = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      centres[i * 3] = x
      centres[i * 3 + 1] = y
      centres[i * 3 + 2] = z
    }
    g.setAttribute('aCenter', new BufferAttribute(centres, 3))
    g.setAttribute('aPhase', new BufferAttribute(new Float32Array(count).fill(phase), 1))
    return g
  })
  const geometry = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  const mesh = new Mesh(geometry, createSwordMaterial(true))
  // Each sword is built round the origin and moved to its spot by the vertex shader, so
  // the geometry's own bounds are useless: the sphere is set from the spots instead
  // (padded for a sword's length and bob), and the whole shop is skipped only when it's
  // out of view.
  const centre = new Vector3()
  for (const e of entries) centre.add(new Vector3(e.x, e.y, e.z))
  centre.divideScalar(Math.max(1, entries.length))
  let radius = 0
  for (const e of entries) radius = Math.max(radius, Math.hypot(e.x - centre.x, e.y - centre.y, e.z - centre.z))
  geometry.boundingSphere = new Sphere(centre, radius + 1.6 * scale + 2)
  mesh.frustumCulled = true
  return mesh
}

export function disposeSwordShowcase(mesh) {
  mesh.geometry.dispose()
  mesh.material.dispose()
}

/** Triangles in sword `id` (for budgets and tests). */
export const swordTriangles = (id) => getSwordGeometry(id).index.count / 3
