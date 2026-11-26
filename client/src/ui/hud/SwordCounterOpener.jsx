import { useEffect, useRef } from 'react'

import { getGame, useGame } from '../../store/game'

/**
 * Opens the Sword Shop panel when you step onto the Sword Counter (zone.swordCounter, from
 * the game ticker) - unless another panel is open or your sword's still flying (then as
 * soon as it sticks) - and closes it again if you step off with it still open. Once a
 * visit: close it while standing there and it stays closed until you step off and back on
 * (the counter's prompt opens it again meanwhile). Renders nothing. (As BallShopOpener
 * does for the Enchant Altar.)
 */
export function SwordCounterOpener() {
  const atCounter = useGame((s) => s.zone.swordCounter)
  const busy = useGame((s) => Boolean(s.roll || s.rollResult))
  /** Whether the panel now open was opened by stepping on (so stepping off closes it). */
  const opened = useRef(false)
  /** Opened once already this visit (closing it keeps it closed till you come back). */
  const visited = useRef(false)

  useEffect(() => {
    const game = getGame()
    if (atCounter) {
      if (!visited.current && !game.panel && !busy) {
        game.openPanel('swords')
        opened.current = true
        visited.current = true
      }
    } else {
      visited.current = false
      if (opened.current) {
        opened.current = false
        if (game.panel === 'swords') game.closePanel()
      }
    }
  }, [atCounter, busy])

  return null
}

export default SwordCounterOpener
