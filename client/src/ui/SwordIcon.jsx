import { useEffect, useRef } from 'react'

import { SWORD_ICON_SIZE, useSwordIcon } from '../game/swordIcons'
import Icon from './Icon'

/**
 * A sword's portrait, rendered from its 3D model (see swordIcons.js) and drawn onto a small
 * canvas - no image to encode or decode. A faint sword icon stands in for the frame or two
 * before the portrait is ready.
 *
 * @param {{ id: string, size: string|number, className?: string, style?: object }} props
 */
export function SwordIcon({ id, size, className = '', style }) {
  const bitmap = useSwordIcon(id)
  const ref = useRef(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx || !bitmap) return
    ctx.clearRect(0, 0, SWORD_ICON_SIZE, SWORD_ICON_SIZE)
    ctx.drawImage(bitmap, 0, 0)
  }, [bitmap])

  if (!bitmap) return <Icon name="tire" size={size} className={className} style={{ opacity: 0.25, ...style }} />
  return (
    <canvas
      ref={ref}
      width={SWORD_ICON_SIZE}
      height={SWORD_ICON_SIZE}
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  )
}

export default SwordIcon
