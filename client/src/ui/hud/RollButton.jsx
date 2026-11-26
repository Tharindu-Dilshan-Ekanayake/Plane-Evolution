import { useCallback, useEffect, useRef, useState } from 'react'

import { HIT_GRADES, hitGrade } from '@shared/balance'

import { cancelPull, heldFor, launch, pressThrow, releaseThrow, slowAt } from '../../game/launch'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** A press is ignored this soon after the last (a double tap, a bouncing key). */
const PRESS_COOLDOWN_MS = 200

/**
 * The meter's grade bands, from the full end (right) back: each grade spans the meter
 * readings it covers (HIT_GRADES `min`), the fill sweeping up from empty (left).
 */
const BANDS = HIT_GRADES.filter((g) => g.min > 0).map((g, i, all) => ({ id: g.id, from: g.min, to: i === 0 ? 1 : all[i - 1].min }))
const BAND_COLORS = {
  perfect: 'linear-gradient(180deg, #fff6a3 0%, #ffd21f 55%, #ff9c00 100%)',
  great: 'linear-gradient(180deg, #d9ff9a 0%, #5fe83a 55%, #1fb52a 100%)',
  good: 'linear-gradient(180deg, #bff4ff 0%, #4fc8ff 55%, #1f8ae0 100%)',
}
/** Each grade's colour for the live label over the meter. */
const GRADE_COLORS = { perfect: '#ffd21f', great: '#7dff4a', good: '#9fe8ff', weak: '#ff6a5a' }
/** What the label says when idle on a spot. */
const IDLE_TEXT = 'HOLD THROW - let go at the top!'

/**
 * The THROW STAGE's HUD: the THROW! button and the throw meter. Step up onto the stage -
 * anywhere on it - and you're ready to throw. HOLD THROW (the button, Space, E, Enter, or press and
 * hold on the game) and you wind up: the meter fills, then wobbles at the top - let go as
 * it touches the gold PERFECT band: the higher it stands, the further your sword flies and
 * the more it pays (HIT_GRADES). A screen-edge vignette tightens as you wind up. Walk off to step away.
 *
 * The meter and the vignette move straight on the DOM every animation frame (launch.js
 * keeps the wind-up's clock); React only hears about stepping on and off.
 */
export function RollButton() {
  const near = useGame((s) => s.zone.atPlate && !s.roll && !s.rollResult && !s.panel)
  /** Up on the throw stage right now (mirrors launch.gripping for React). */
  const [atBat, setAtBat] = useState(false)
  const lastPress = useRef(-Infinity)
  const fillRef = useRef(null)
  const markerRef = useRef(null)
  const labelRef = useRef(null)
  const meterRef = useRef(null)
  const vignetteRef = useRef(null)
  const buttonRef = useRef(null)
  const visible = near || atBat

  const press = useCallback(() => {
    const now = performance.now()
    if (now - lastPress.current < PRESS_COOLDOWN_MS) return
    lastPress.current = now
    pressThrow(now)
  }, [])
  const release = useCallback(() => releaseThrow(performance.now()), [])

  // Stepping on and off happens in the player (walking on and off the stage): keep up.
  useEffect(() => {
    if (!visible) return undefined
    const id = setInterval(() => setAtBat(launch.gripping || launch.released), 80)
    return () => clearInterval(id)
  }, [visible])

  // A panel opened or the throw started: step off (a throw steps you back on after).
  const panel = useGame((s) => s.panel)
  const rolling = useGame((s) => Boolean(s.roll))
  const [blocked, setBlocked] = useState(false)
  if (Boolean(panel || rolling) !== blocked) {
    setBlocked(Boolean(panel || rolling))
    if (panel || rolling) setAtBat(false)
  }
  useEffect(() => {
    if (blocked && panel && launch.gripping && !launch.released) cancelPull()
  }, [blocked, panel])

  // E / Enter / F: hold to wind up, let go to throw. (Space is the player's: Player.jsx.)
  useEffect(() => {
    if (!visible) return undefined
    const keys = new Set(['KeyE', 'Enter', 'KeyF'])
    const onDown = (e) => {
      if (keys.has(e.code) && !e.repeat) press()
    }
    const onUp = (e) => {
      if (keys.has(e.code)) release()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [visible, press, release])

  // The meter, every frame, while on the stage: the fill, the marker riding its edge, the grade
  // letting go right now would get, the button glowing gold at full charge.
  useEffect(() => {
    if (!atBat) return undefined
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const winding = launch.stage === 'charge'
      const shown = winding || launch.released
      const value = launch.released ? launch.accuracy : winding ? launch.charge : 0
      if (fillRef.current) fillRef.current.style.width = `${value * 100}%`
      if (markerRef.current) markerRef.current.style.left = `${value * 100}%`
      if (meterRef.current) meterRef.current.style.opacity = shown ? '1' : '0.55'
      const coil = slowAt(now)
      const full = winding && heldFor(now) > 0.85
      if (vignetteRef.current) vignetteRef.current.style.opacity = String(Math.min(1, coil * 0.9 + (full ? 0.1 : 0)))
      if (buttonRef.current) buttonRef.current.style.filter = full ? `drop-shadow(0 0 ${u(18)} #ffd21f) brightness(1.15)` : 'none'
      let text = IDLE_TEXT
      let color = '#ffffff'
      if (launch.released) {
        const grade = hitGrade(launch.accuracy)
        text = grade.label
        color = GRADE_COLORS[grade.id]
      } else if (winding) {
        const grade = hitGrade(launch.charge)
        text = grade.id === 'perfect' ? 'LET GO NOW!' : grade.label.replace(/ THROW|[!.]+$/g, '')
        color = GRADE_COLORS[grade.id]
      }
      for (const layer of labelRef.current?.querySelectorAll('.pp-text-stroke, .pp-text-fill') ?? []) layer.textContent = text
      const fill = labelRef.current?.querySelector('.pp-text-fill')
      if (fill) fill.style.color = color
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [atBat])

  if (!visible) return null
  const manual = atBat
  return (
    <>
      {/* Winding up: the screen's edges closing in, gold and dark, the throw building. */}
      {atBat && (
        <div
          ref={vignetteRef}
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0,
            transition: 'opacity 0.12s linear',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(60,30,0,0.35) 78%, rgba(30,12,0,0.7) 100%)',
          }}
        />
      )}
      {/* The throw meter, up under the top bar. */}
      {manual && (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(150) }}>
          <span ref={labelRef} className="whitespace-nowrap" style={{ fontSize: u(52), color: '#ffffff' }}>
            <StrokeText stroke={u(11)}>{IDLE_TEXT}</StrokeText>
          </span>
          <div ref={meterRef} className="flex flex-col items-center" style={{ opacity: 0.55, transition: 'opacity 0.15s' }}>
            <div
              className="relative overflow-hidden"
              style={{
                width: u(620),
                height: u(54),
                borderRadius: u(27),
                border: `${u(6)} solid #1b1b1f`,
                background: 'linear-gradient(180deg, #5a4a6a 0%, #2c2438 100%)',
                boxShadow: `0 ${u(6)} 0 rgba(0,0,0,0.35)`,
              }}
            >
              {/* The grade bands at the full end: GOOD, then GREAT, then PERFECT at the top. */}
              {BANDS.map((b) => (
                <div key={b.id} className="absolute top-0 bottom-0" style={{ left: `${b.from * 100}%`, width: `${(b.to - b.from) * 100}%`, background: BAND_COLORS[b.id], opacity: 0.45 }} />
              ))}
              {/* The charge itself, sweeping up. */}
              <div
                ref={fillRef}
                className="absolute top-0 bottom-0 left-0"
                style={{ width: '0%', background: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,226,140,0.75) 50%, rgba(255,160,40,0.7) 100%)', mixBlendMode: 'screen' }}
              />
            </div>
            {/* The marker riding the fill's edge: a glowing sword-tip diamond. */}
            <div className="relative" style={{ width: u(620), height: 0 }}>
              <div
                ref={markerRef}
                className="absolute"
                style={{
                  left: '0%',
                  top: u(-58),
                  width: u(30),
                  height: u(62),
                  marginLeft: u(-15),
                  background: 'linear-gradient(180deg, #ffffff 0%, #ffe27a 60%, #ff9c00 100%)',
                  clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
                  filter: `drop-shadow(0 0 ${u(6)} #ffd21f)`,
                }}
              />
            </div>
            <span className="flex items-center" style={{ fontSize: u(28), marginTop: u(10), gap: u(8) }}>
              <StrokeText stroke={u(7)}>Let go in the gold for a PERFECT throw!</StrokeText>
            </span>
          </div>
        </div>
      )}
      {/* THROW! in the middle, near the bottom (the level bar and the other buttons step
          aside while it's up - HUD.jsx). Hold it to wind up, let go to throw. */}
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(90) }}>
        {!atBat && (
          <span className="pointer-events-none flex items-center" style={{ fontSize: u(34), gap: u(8), marginBottom: u(14) }}>
            <Icon name="arrowDown" size={u(40)} />
            <StrokeText stroke={u(7)}>Step up onto the THROW STAGE to throw your sword!</StrokeText>
          </span>
        )}
        {(manual || !atBat) && (
          <div ref={buttonRef}>
            <ChunkyButton
              className="pp-hit pp-hit-idle"
              gradient={GRADIENTS.goldButton}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                press()
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              title="Hold to wind up, let go to throw (Space / E)"
              radius={30}
              border={6}
              style={{ height: u(124), padding: `0 ${u(56)}`, minWidth: u(380), touchAction: 'none' }}
            >
              <span className="flex items-center" style={{ fontSize: u(64), gap: u(16) }}>
                <Icon name="bat" size={u(68)} />
                <StrokeText stroke={u(12)}>THROW!</StrokeText>
              </span>
            </ChunkyButton>
          </div>
        )}
      </div>
    </>
  )
}

export default RollButton
