import { useEffect, useRef, useState } from 'react'

import { RARITIES, TIRES } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { sfx } from '../../audio/sfx'
import { standState } from '../../game/labels/lobbyLabels'
import { swordTrailStyle } from '../../game/swordTrails'
import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import SwordIcon from '../SwordIcon'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

/**
 * The SWORD SHOP: every sword in balance TIRES (the template's tires) - its portrait (the
 * real 3D model: swordIcons.js), name, rarity, Power, the Legend swords' Wins bonus, its
 * trail and its price - bought one after another (shared/logic.js buyTire sells only the
 * next) and equipped from here. Opened by stepping onto the Sword Counter at the foot of
 * the Sword Wall (SwordCounterOpener), or from the counter's prompt.
 *
 * Buying is checked by the server against standing on the counter (shared/session.js
 * atCounter), so off it the Buy button says where to go; equipping a sword you own works
 * from anywhere.
 */

/** Keyframes, scoped by the `sp-` prefix; mounted with the panel. */
const CSS = `
@keyframes sp-spin { to { transform: rotate(360deg); } }
@keyframes sp-float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-4%) rotate(-2deg); } }
@keyframes sp-pop { 0% { transform: scale(1); } 35% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes sp-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%, 100% { transform: translateX(620%) skewX(-20deg); } }
@keyframes sp-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1); } }
.sp-rays { animation: sp-spin 9s linear infinite; }
.sp-float { animation: sp-float 2.8s ease-in-out infinite; }
.sp-pop { animation: sp-pop 0.5s ease-out; }
.sp-shine { animation: sp-shine 2.6s ease-in-out infinite; }
.sp-twinkle { animation: sp-twinkle 1.6s ease-in-out infinite; }
.sp-card { transition: transform 0.12s ease-out, box-shadow 0.12s ease-out; }
.sp-card:hover { transform: translateY(-2px); }
/* Phones: the HUD's reference pixel is tiny there (a 390 px tall screen makes 22 px text 8
   px), so the shop - a lot of small text and buttons - gets a bigger one of its own. */
@media (orientation: landscape) and (max-height: 600px) {
  .sp-root { --px: clamp(0.3px, min(100vw / 1250, 100vh / 760), 1.4px); }
}
@media (orientation: portrait) and (max-width: 700px) {
  .sp-root { --px: clamp(0.3px, 100vw / 760, 1.4px); }
}
`

/** How each trail kind (swordTrails.js `fx`) reads in words. */
const TRAIL_WORDS = {
  chips: 'Wood Chips',
  leaves: 'Leaves',
  dust: 'Dust',
  glint: 'Glints',
  bubbles: 'Bubbles',
  ghost: 'Ghost Wisps',
  feathers: 'Phoenix Feathers',
  petals: 'Petals',
  holy: 'Holy Light',
  aurora: 'Aurora',
  gold: 'Gold Glitter',
  fire: 'Fire',
  frost: 'Frost',
  spark: 'Lightning',
  stars: 'Stars',
  smoke: 'Smoke',
  void: 'Void',
  wind: 'Wind',
}

/** "Petals", "Rainbow Stars"...: sword `id`'s trail in words. */
function trailWords(id) {
  const t = swordTrailStyle(id)
  const words = TRAIL_WORDS[t.fx] || 'Glow'
  return t.rainbow ? `Rainbow ${words}` : words
}

const DIVINE = 'linear-gradient(90deg, #7dfcff 0%, #ffffff 45%, #ffe27a 100%)'
const winsBonus = (tire) => Math.round(((tire.wins ?? 1) - 1) * 100)

function RarityTag({ rarity, size = 20 }) {
  const r = RARITIES[rarity] || RARITIES.common
  const gradient = rarity === 'secret' ? GRADIENTS.rainbow : rarity === 'divine' ? DIVINE : undefined
  return (
    <span style={{ fontSize: u(size), lineHeight: 1 }}>
      <StrokeText stroke={u(size * 0.24)} fill={r.color} gradient={gradient}>
        {r.name.toUpperCase()}
      </StrokeText>
    </span>
  )
}

/** A stat as a small dark chip: icon and text. */
function Chip({ icon, text, fill, size = 20 }) {
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: u(4), padding: `${u(2)} ${u(10)} ${u(2)} ${u(4)}`, borderRadius: u(20), background: 'rgba(0,0,0,0.4)', fontSize: u(size), lineHeight: 1.1 }}
    >
      <Icon name={icon} size={u(size * 1.25)} />
      <StrokeText stroke={u(size * 0.22)} fill={fill}>
        {text}
      </StrokeText>
    </span>
  )
}

/** Where the Legend swords' portraits twinkle (percent of the square, and a delay). */
const TWINKLES = [
  [12, 18, 0],
  [80, 30, 0.5],
  [24, 78, 1],
  [70, 82, 0.25],
]

/**
 * A portrait on a glowing disc in its rarity's colour; the rarest get slowly turning rays,
 * the Legend swords twinkles too. `size` in reference pixels.
 */
function Portrait({ tire, size, dim = false, float = false }) {
  const color = RARITIES[tire.rarity]?.color ?? '#ffffff'
  const rays = tire.rarity === 'divine' || tire.rarity === 'secret' || tire.rarity === 'mythic'
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: u(size), height: u(size) }}>
      <span
        className="pointer-events-none absolute rounded-full"
        style={{ inset: '6%', background: `radial-gradient(circle, ${color}cc 0%, ${color}55 42%, transparent 70%)`, opacity: dim ? 0.35 : 1 }}
      />
      {rays && !dim && (
        <span
          className="sp-rays pointer-events-none absolute rounded-full"
          style={{
            inset: '-4%',
            background: `repeating-conic-gradient(from 0deg, ${color}55 0deg 8deg, transparent 8deg 22deg)`,
            maskImage: 'radial-gradient(circle, #000 25%, transparent 68%)',
            WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 68%)',
          }}
        />
      )}
      <span className={float ? 'sp-float' : ''} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <SwordIcon id={tire.id} size="100%" style={{ filter: dim ? 'grayscale(0.75) brightness(0.55)' : `drop-shadow(0 ${u(4)} ${u(3)} rgba(0,0,0,0.45))` }} />
      </span>
      {tire.rarity === 'divine' &&
        !dim &&
        TWINKLES.map(([x, y, delay]) => (
          <span
            key={`${x}-${y}`}
            className="sp-twinkle pointer-events-none absolute"
            style={{ left: `${x}%`, top: `${y}%`, width: '9%', height: '9%', animationDelay: `${delay}s`, background: 'radial-gradient(circle, #fff 0 20%, transparent 60%)' }}
          />
        ))}
    </span>
  )
}

/** Outlined text that may wrap, `size` reference pixels. */
function Words({ size, stroke = 6, children }) {
  return (
    <span style={{ fontSize: u(size), lineHeight: 1.05 }}>
      <StrokeText stroke={u(stroke)} style={{ whiteSpace: 'normal' }}>
        {children}
      </StrokeText>
    </span>
  )
}

/**
 * The action for sword `index` in state `state`, as a big button (`size` its text): Equipped,
 * Equip, Buy (the next one along: green when you can afford it, red when you can't, grey
 * off the counter) or a locked note.
 */
function Action({ index, state, wins, atCounter, size = 30, height = 64 }) {
  const tire = TIRES[index]
  const afford = wins >= tire.cost
  if (state === 'equipped') {
    return (
      <ChunkyButton gradient={GRADIENTS.greyButton} disabled className="w-full" style={{ height: u(height), gap: u(6) }}>
        <Icon name="check" size={u(size * 1.15)} />
        <Words size={size}>Equipped</Words>
      </ChunkyButton>
    )
  }
  if (state === 'owned') {
    return (
      <ChunkyButton gradient={GRADIENTS.blueButton} onClick={() => actions.equipTire(tire.id)} className="w-full" style={{ height: u(height) }}>
        <Words size={size}>Equip</Words>
      </ChunkyButton>
    )
  }
  if (state === 'buy') {
    if (!atCounter) {
      return (
        <ChunkyButton gradient={GRADIENTS.greyButton} disabled className="w-full" style={{ minHeight: u(height), padding: `${u(4)} ${u(8)}`, flexDirection: 'column' }}>
          <Price amount={tire.cost} size={size * 0.7} afford={afford} />
          <Words size={size * 0.5} stroke={4}>
            Stand on the SWORD COUNTER to buy
          </Words>
        </ChunkyButton>
      )
    }
    if (!afford) {
      return (
        <ChunkyButton gradient={GRADIENTS.redButton} onClick={() => sfx.error()} className="w-full" style={{ minHeight: u(height), padding: `${u(4)} ${u(8)}`, flexDirection: 'column' }}>
          <Price amount={tire.cost} size={size * 0.75} afford={false} />
          <Words size={size * 0.5} stroke={4}>
            Need {formatNumber(tire.cost - wins)} more Wins
          </Words>
        </ChunkyButton>
      )
    }
    return (
      <ChunkyButton gradient={GRADIENTS.greenButton} onClick={() => actions.buyTire(tire.id)} className="pp-bounce w-full" style={{ height: u(height), gap: u(10) }}>
        <Words size={size}>Buy</Words>
        <Price amount={tire.cost} size={size * 0.85} />
      </ChunkyButton>
    )
  }
  return (
    <div
      className="flex w-full flex-col items-center justify-center"
      style={{ minHeight: u(height), borderRadius: u(12), border: `${u(4)} solid #111`, background: 'rgba(0,0,0,0.38)', padding: `${u(2)} ${u(8)}`, gap: u(2) }}
    >
      <Price amount={tire.cost} size={size * 0.6} afford={false} />
      <Words size={size * 0.46} stroke={4}>
        Buy the {TIRES[index - 1].name} first
      </Words>
    </div>
  )
}

/** The selected sword, big: portrait, name, rarity, numbers, trail, and what you can do with it. */
function Detail({ index, state, wins, atCounter, collected }) {
  const tire = TIRES[index]
  const color = RARITIES[tire.rarity]?.color ?? '#ffffff'
  const bonus = winsBonus(tire)
  const [headline, headlineColor] =
    state === 'equipped' ? ['EQUIPPED', '#7dff4a'] : state === 'owned' ? ['OWNED', '#8fe0ff'] : state === 'buy' ? ['NEXT SWORD', '#ffe066'] : ['LOCKED', '#ff8a7a']
  return (
    <div
      className="relative flex flex-wrap items-center justify-center overflow-hidden"
      style={{
        gap: u(22),
        padding: `${u(14)} ${u(22)}`,
        borderRadius: u(12),
        border: `${u(5)} solid #111`,
        background: `radial-gradient(ellipse at 22% 50%, ${color}66 0%, #23305e 45%, #121838 100%)`,
        boxShadow: `inset 0 ${u(4)} 0 rgba(255,255,255,0.12)`,
      }}
    >
      <span className="sp-shine pointer-events-none absolute" style={{ top: 0, bottom: 0, left: 0, width: '18%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
      <Portrait tire={tire} size={210} dim={state === 'locked'} float />
      <div className="flex flex-col items-center text-center" style={{ gap: u(8), minWidth: 0, flex: '1 1 320px', maxWidth: u(560) }}>
        <span style={{ fontSize: u(22) }}>
          <StrokeText stroke={u(5)} fill={headlineColor}>
            {headline}
          </StrokeText>
        </span>
        <Words size={tire.name.length > 16 ? 44 : 54} stroke={10}>
          {tire.name}
        </Words>
        <RarityTag rarity={tire.rarity} size={26} />
        <span className="flex flex-wrap items-center justify-center" style={{ gap: u(6) }}>
          <Chip icon="heart" text={`+${formatNumber(tire.power)} Power`} fill="#ff9ad5" size={22} />
          {bonus > 0 && <Chip icon="trophy" text={`+${bonus}% Wins`} fill="#7dff4a" size={22} />}
          <Chip icon="starGold" text={`Trail: ${trailWords(tire.id)}`} fill="#9fe8ff" size={22} />
        </span>
        <span style={{ fontSize: u(18) }}>
          <StrokeText stroke={u(4)} fill="#c9d3ff">
            Sword {index + 1} of {TIRES.length} · Collected {collected}/{TIRES.length}
          </StrokeText>
        </span>
        <div className="w-full" style={{ maxWidth: u(420), paddingTop: u(4) }}>
          <Action index={index} state={state} wins={wins} atCounter={atCounter} size={32} height={70} />
        </div>
      </div>
    </div>
  )
}

/** One sword's card in the grid: tap it to see it big above; its own button acts straight away. */
function SwordCard({ index, state, wins, atCounter, selected, popped, onSelect }) {
  const tire = TIRES[index]
  const color = RARITIES[tire.rarity]?.color ?? '#ffffff'
  const locked = state === 'locked'
  const bonus = winsBonus(tire)
  const frame = state === 'equipped' ? '#7dff4a' : selected ? '#ffffff' : '#111'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      className={`sp-card pointer-events-auto flex cursor-pointer flex-col items-center text-center ${popped ? 'sp-pop' : ''}`}
      style={{
        gap: u(4),
        padding: `${u(8)} ${u(8)} ${u(10)}`,
        borderRadius: u(10),
        border: `${u(5)} solid ${frame}`,
        background: locked ? 'linear-gradient(180deg, #3a3f4c 0%, #23262f 100%)' : state === 'buy' ? GRADIENTS.rewardCard : `linear-gradient(180deg, ${color}55 0%, #2c344d 55%, #1d2335 100%)`,
        boxShadow: selected ? `0 0 ${u(16)} ${u(3)} rgba(255,255,255,0.55)` : state === 'equipped' ? `0 0 ${u(14)} ${u(2)} #7dff4a88` : 'none',
        opacity: locked ? 0.86 : 1,
      }}
    >
      <Portrait tire={tire} size={104} dim={locked} />
      <span style={{ fontSize: u(tire.name.length > 15 ? 19 : 22), lineHeight: 1.05, minHeight: u(44), display: 'flex', alignItems: 'center' }}>
        <StrokeText stroke={u(5)} style={{ whiteSpace: 'normal' }}>
          {tire.name}
        </StrokeText>
      </span>
      <RarityTag rarity={tire.rarity} size={16} />
      <span className="flex flex-col items-center" style={{ gap: u(2) }}>
        <Chip icon="heart" text={`+${formatNumber(tire.power)}`} fill="#ff9ad5" size={16} />
        {bonus > 0 && <Chip icon="trophy" text={`+${bonus}% Wins`} fill="#7dff4a" size={16} />}
      </span>
      {/* Its button acts on its own, without also picking the card. */}
      <div className="mt-auto w-full" style={{ paddingTop: u(6) }} onClick={(e) => e.stopPropagation()}>
        <Action index={index} state={state} wins={wins} atCounter={atCounter} size={22} height={50} />
      </div>
    </div>
  )
}

const GRID = { gridTemplateColumns: `repeat(auto-fill, minmax(${u(182)}, 1fr))`, gap: u(12) }

export function SwordsPanel() {
  // As strings: the profile is a fresh object after every update (a slash, a throw...).
  const ownedKey = useGame((s) => s.profile.ownedTires.join(','))
  const equipped = useGame((s) => s.profile.equippedTire)
  const wins = useGame((s) => s.profile.wins)
  const atCounter = useGame((s) => s.zone.swordCounter)
  const owned = ownedKey.split(',')
  const profile = { ownedTires: owned, equippedTire: equipped }
  const nextIndex = TIRES.findIndex((t) => !owned.includes(t.id))
  const equippedIndex = Math.max(0, TIRES.findIndex((t) => t.id === equipped))

  /** The sword shown big: one you tapped, or (null) the next one to buy - which moves on as you buy. */
  const [picked, setPicked] = useState(null)
  const shown = picked ?? (nextIndex >= 0 ? nextIndex : equippedIndex)

  // A sword just bought: its card pops, and if it was the one shown, the next one shows.
  const [popped, setPopped] = useState(null)
  const count = useRef(owned.length)
  useEffect(() => {
    const now = ownedKey.split(',')
    if (now.length > count.current) {
      const bought = now[now.length - 1]
      setPopped(bought)
      setPicked((p) => (p !== null && TIRES[p]?.id === bought ? null : p))
    }
    count.current = now.length
  }, [ownedKey])
  useEffect(() => {
    if (!popped) return undefined
    const id = setTimeout(() => setPopped(null), 600)
    return () => clearTimeout(id)
  }, [popped])

  return (
    // display: contents - no box of its own, but the panel inside inherits its --px.
    <div className="sp-root" style={{ display: 'contents' }}>
      <style>{CSS}</style>
      <Panel title="SWORD SHOP" icon="tire" width={1180}>
        <div className="flex flex-col" style={{ gap: u(14) }}>
          <Detail index={shown} state={standState(profile, shown)} wins={wins} atCounter={atCounter} collected={owned.length} />
          <p className="m-0 text-center" style={{ fontSize: u(22) }}>
            <StrokeText stroke={u(5)} style={{ whiteSpace: 'normal' }}>
              {atCounter
                ? 'Buy them one after another - every sword hits harder, and the Legend swords pay extra Wins on every throw!'
                : 'Stand on the SWORD COUNTER to buy swords. You can equip any sword you own from anywhere.'}
            </StrokeText>
          </p>
          <div className="grid" style={GRID}>
            {TIRES.map((tire, i) => (
              <SwordCard
                key={tire.id}
                index={i}
                state={standState(profile, i)}
                wins={wins}
                atCounter={atCounter}
                selected={i === shown}
                popped={popped === tire.id}
                onSelect={() => setPicked(i)}
              />
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}

export default SwordsPanel
