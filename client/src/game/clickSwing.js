import { CLICK_INTERVAL } from '@shared/balance'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'
import { getGame } from '../store/game'
import { isPulling } from './launch'
import { CLICK_SLASH_CONTACT, CLICK_SLASH_S } from './playerPose'
import { roll } from './roll/rollControl'
import { runtime } from './runtime'

/** Seconds from the click to the blade cutting through (the Power gain lands then). */
export const CLICK_CONTACT = CLICK_SLASH_CONTACT
/** Seconds a click slash keeps you planted, and how long its pose plays in all. */
export const CLICK_PLANT_S = CLICK_SLASH_S * 0.8
export const CLICK_POSE_S = CLICK_SLASH_S
/** The template's name for the wind-up before the cut (other players' avatars use it). */
export const TOSS_S = CLICK_CONTACT * 0.6

/**
 * The click slashes (shared/balance CLICK_INTERVAL): click or tap anywhere in the lobby -
 * not on the HUD, not on a throw spot - and you take your sword in both hands and cut
 * through the air in front of you, for one Power gain. The last two slashes, newest
 * first: when each started (performance.now(), 0 never), where you stood and which way
 * you faced. Read every frame by the player (the pose) and the slash effects; written
 * only by tapSwing.
 */
export const clicks = [
  { at: 0, x: 0, y: 0, z: 0, yaw: 0 },
  { at: 0, x: 0, y: 0, z: 0, yaw: 0 },
]

/**
 * A click or tap on the 3D view. On a throw spot it does nothing here (pressing and
 * holding there winds up a throw: Player.jsx); at a dummy, mid-throw or in the air it does
 * nothing (the dummy slashes for you); otherwise, once CLICK_INTERVAL has passed since the
 * last, a click slash - the server pays it as the blade cuts. Returns whether it slashed.
 */
export function tapSwing(now = performance.now()) {
  const player = runtime.player
  if (roll.active || player.frozen || getGame().panel || isPulling()) return false
  if (player.cage >= 0 || !player.grounded) return false
  if (now - clicks[0].at < CLICK_INTERVAL * 1000) return false
  // The older slash makes way for this one.
  const [newest, older] = clicks
  Object.assign(older, newest)
  newest.at = now
  newest.x = player.position.x
  newest.y = player.position.y
  newest.z = player.position.z
  newest.yaw = player.yaw
  sfx.swordWhoosh()
  setTimeout(() => {
    sfx.slashAir()
    actions.clickSwing()
  }, CLICK_CONTACT * 1000)
  return true
}

/** Seconds since your latest click slash started (Infinity if none). */
export const sinceClick = (now = performance.now()) => (clicks[0].at ? (now - clicks[0].at) / 1000 : Infinity)
