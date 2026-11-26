import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import { attachSwordIconRenderer, processSwordIconQueue } from './swordIcons'

/**
 * Makes the Sword Shop's portraits (swordIcons.js), one a frame while any are queued, on
 * the game's own renderer: re-attached to a new one after a lost context. Nothing queued
 * (normally: all thirty-six are made within a second of being asked for), it does nothing.
 * Renders nothing.
 */
export function SwordIconBaker() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    attachSwordIconRenderer(gl)
  }, [gl])

  useFrame(() => {
    processSwordIconQueue()
  })

  return null
}

export default SwordIconBaker
