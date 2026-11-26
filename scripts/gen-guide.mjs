/**
 * Writes docs/game-guide-si.html: the game guide in Sinhala, its tables read straight from
 * shared/balance.js so they always match the game. Run after changing the balance:
 *
 *   node scripts/gen-guide.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BALLS, EGGS, HIT_GRADES, PADS, PETS, RARITIES, SHOP, TIRES, TUTORIAL, WORLD_PORTALS, WORLD_ZONES, WORLDS } from '../shared/balance.js'
import { formatDistance, formatNumber } from '../shared/format.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const rarity = (r) => `<span class="tag" style="background:${RARITIES[r]?.color ?? '#ccc'}">${RARITIES[r]?.name ?? r}</span>`

const swords = TIRES.map((t, i) => `<tr><td>${i + 1}</td><td><b>${esc(t.name)}</b></td><td>+${formatNumber(t.power)}</td><td>${t.wins > 1 ? `+${Math.round((t.wins - 1) * 100)}%` : '—'}</td><td>${t.cost ? formatNumber(t.cost) : 'නොමිලේ'}</td><td>${rarity(t.rarity)}</td></tr>`).join('\n')
const pads = PADS.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>x${p.mult}</td><td>${p.product ? `${esc(SHOP[p.product].name)} (${formatNumber(SHOP[p.product].price)} Wins)` : p.rebirths ? `Rebirth ${p.rebirths}` : 'නොමිලේ'}${p.world === 1 ? ' · Dragonfire Peaks පමණයි' : ''}</td></tr>`).join('\n')
const enchants = BALLS.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td>+${Math.round((b.reach - 1) * 100)}%</td><td>x${b.wins}</td><td>${b.cost ? formatNumber(b.cost) : 'නොමිලේ'}</td><td>${rarity(b.rarity)}</td></tr>`).join('\n')
const grades = HIT_GRADES.map((g) => `<tr><td><b>${esc(g.label)}</b></td><td>${Math.round(g.min * 100)}%+</td><td>x${g.reach[0]}–x${g.reach[1]}</td><td>x${g.bonus}</td></tr>`).join('\n')
const eggs = Object.entries(EGGS).map(([, e]) => `<tr><td><b>${esc(e.name)} Egg</b></td><td>${formatNumber(e.cost.wins)}</td><td>${e.pets.map(([id, w]) => `${esc(PETS[id].name)} (x${PETS[id].mult}, ${w}%)`).join(', ')}${e.world === 1 ? ' · Dragonfire Peaks පමණයි' : ''}</td></tr>`).join('\n')
const stages = (w) =>
  WORLD_ZONES[w]
    .map((z, i) => `<li><b>${i + 1}. ${esc(z.name)}</b> <span class="dim">${formatDistance(z.start)} · ${z.theme}${z.discover ? ` · පළමු වරට +${formatNumber(z.discover)} Wins` : ''}</span></li>`)
    .join('\n')
const tutorial = TUTORIAL.map((t) => `<li>${esc(t.text)}</li>`).join('\n')

const html = `<!doctype html>
<html lang="si">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sword Toss Legends – ගේම් මාර්ගෝපදේශය</title>
<style>
  :root { --bg: #f6f3ec; --card: #fff; --ink: #1d1b16; --dim: #6a6458; --accent: #2f5fd0; --gold: #c98a00; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.65 "Noto Sans Sinhala", "Iskoola Pota", system-ui, sans-serif; background: var(--bg); color: var(--ink); }
  main { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 30px; margin: 8px 0 4px; } h2 { margin-top: 36px; border-bottom: 3px solid var(--accent); padding-bottom: 4px; }
  .lead { color: var(--dim); }
  .card { background: var(--card); border-radius: 12px; padding: 16px 18px; margin: 14px 0; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  table { width: 100%; border-collapse: collapse; font-size: 15px; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e8e2d6; vertical-align: top; }
  th { background: #efe9dc; } .tag { color: #111; border-radius: 6px; padding: 1px 8px; font-size: 13px; }
  .dim { color: var(--dim); font-size: 14px; } ol.stages { columns: 2; column-gap: 28px; padding-left: 18px; } ol.stages li { list-style: none; break-inside: avoid; }
  code { background: #efe9dc; padding: 1px 5px; border-radius: 4px; font-size: 14px; }
  .scroll { overflow-x: auto; }
  @media (max-width: 640px) { ol.stages { columns: 1; } }
</style>
</head>
<body>
<main>
<h1>⚔️ Sword Toss Legends</h1>
<p class="lead">කඩුව විසි කරන ගේම් එකේ සම්පූර්ණ විස්තරය — මේ පිටුවේ වගු <code>shared/balance.js</code> එකෙන් ස්වයංක්‍රීයව හැදෙනවා (<code>node scripts/gen-guide.mjs</code>).</p>

<h2>ගේම් එක මොකක්ද?</h2>
<div class="card">
<p><b>Training dummy</b> එකකට කඩුවෙන් කපලා <b>Power</b> එකතු කරගන්න → <b>THROW STAGE</b> එක උඩට නැගලා (stage එකේ ඕනම තැනක) <b>THROW</b> එක තදකරගෙන ඉඳලා, මීටරය රන් පාට (PERFECT) කොටසට ආවම අත අරින්න → ඔයාගේ කඩුව කැරකි කැරකි දිගු නිම්නයේ පාර දිගේ පියාඹලා ගිහින් බිමේ ඇනෙනවා. Power වැඩි වෙන්න කඩුව දුර යනවා, යන හැම මීටරයකටම <b>Wins</b> ලැබෙනවා → Wins වලින් ලොකු කඩු, enchantments, pets eggs, dummies ගන්න → max level එකට ආවම <b>Rebirth</b> කරලා තවත් ශක්තිමත් වෙන්න → Rebirth 8ක් සහ Wins 1M ක් තියෙනකොට <b>${esc(WORLD_PORTALS.world2.name)}</b> (World 2) එකට යන්න.</p>
<p>ප්ලේයර්ලා කවදාවත් මරෙන්නේ නැහැ — හැම වෙලාවෙම තව විසි කිරීමක් තියෙනවා.</p>
</div>

<h2>පාලනය (Controls)</h2>
<div class="card">
<ul>
<li><b>PC:</b> WASD / ඊතල — ඇවිදින්න, Space — පනින්න, මවුස් එක ඇදලා කැමරාව කරකවන්න, wheel — zoom.</li>
<li><b>Lobby එකේ click/tap කරන්න</b> — කඩුවෙන් හුළඟට කපලා Power ගන්න (dummy එකක් ළඟ ඉන්නකොට එයාම කපනවා).</li>
<li><b>විසි කරන්න:</b> THROW STAGE එක උඩ ඕනම තැනක හිටගන්න (හිටගන්න තැන අනුව කඩුව යන පාර වෙනස් වෙනවා) → <b>THROW</b> බොත්තම / Space / E / Enter <b>තදකරගෙන ඉන්න</b> (කඩුව පිටිපස්සට අදිනවා, මීටරය පිරෙනවා) → රන් පාට කොටසේදී <b>අත අරින්න</b>.</li>
<li><b>ෆෝන් එකේ:</b> වම් පැත්තේ joystick, jump බොත්තම, SLASH බොත්තම; THROW බොත්තම තදකරගෙන ඉඳලා අරින්න.</li>
</ul>
<p>මුල් ගුරු මාර්ගය (Tutorial):</p><ol>${tutorial}</ol>
</div>

<h2>විසි කිරීමේ මීටරය</h2>
<div class="card scroll"><table><tr><th>ශ්‍රේණිය</th><th>මීටරය</th><th>දුර</th><th>Wins</th></tr>
${grades}</table>
<p class="dim">PERFECT දිගටම ගහනකොට <b>combo</b> එකක් හැදෙනවා (+10% … +50% Wins). Auto Throw pass එකෙන් ගේම් එකම විසි කරනවා (සාමාන්‍ය x1 විසි කිරීමක්).</p></div>

<h2>Training Dummies (${PADS.length})</h2>
<div class="card scroll"><table><tr><th>Dummy</th><th>Power ගුණකය</th><th>අගුළු හැරෙන්නේ</th></tr>
${pads}</table></div>

<h2>කඩු (${TIRES.length}) — Sword Wall</h2>
<div class="card scroll"><p class="dim">සියලුම කඩු නැගෙනහිර <b>Sword Wall</b> එකේ එල්ලලා — පේළි 3ක්, හැම කඩුවක් යටම නම් පුවරුවක් (දුර ඉඳන් කියවන්න පුළුවන්). එකින් එක පිළිවෙලට ගන්න ඕනේ: බිත්තිය ළඟ තියෙන <b>SWORD COUNTER</b> එකට නැග්ගාම ඊළඟ කඩුව ගන්න පුළුවන් (ගත්ත ගමන් අතට එනවා). හැම කඩුවකටම වෙනම හැඩයක් — ලී, උණ, ගල්, ඇටකටු, තඹ, යකඩ … රත්තරන්, ලාවා, මැණික්, galaxy, මකර, cyber, infinity. ඉහළ කඩු ලොකුයි, දිලිසෙනවා. හැම කඩුවකටම වෙනම <b>trail</b> එකක් (පාට, අංශු — කොළ, මල් පෙති, ගිනි, අකුණු, තරු…). අන්තිම කඩු 12 <b>Legend</b> කඩු — Power එකට අමතරව හැම විසි කිරීමකටම Wins +10% සිට +200% දක්වා.</p>
<table><tr><th>#</th><th>කඩුව</th><th>එක් ලාභයකට Power</th><th>අමතර Wins</th><th>මිල (Wins)</th><th>දුර්ලභතාව</th></tr>
${swords}</table></div>

<h2>Enchantments (${BALLS.length}) — Enchant Altar</h2>
<div class="card scroll"><p class="dim">කඩුවට aura එකක් — වැඩි දුරක්, වැඩි Wins, ලස්සන trail එකක් (ගිනි, අයිස්, අකුණු, තරු…).</p>
<table><tr><th>Enchant</th><th>දුර</th><th>Wins</th><th>මිල</th><th>දුර්ලභතාව</th></tr>
${enchants}</table></div>

<h2>Pets සහ Eggs</h2>
<div class="card scroll"><table><tr><th>Egg</th><th>මිල (Wins)</th><th>Pets (ගුණකය, අවස්ථාව)</th></tr>
${eggs}</table><p class="dim">එකවර pets 3ක් equip කරන්න පුළුවන් — ගුණක එකතු වෙනවා.</p></div>

<h2>ලෝක සහ අදියර (Stages)</h2>
<div class="card">
<p><b>${esc(WORLDS[0].name)}</b> (World 1) — අදියර <b>${WORLD_ZONES[0].length}</b>ක්, පාර දිගට ${formatDistance(WORLD_ZONES[0][WORLD_ZONES[0].length - 1].start)}+ . අදියර 60න් පස්සේ තියෙන 20 Rebirth 30+ ප්ලේයර්ලාට දිගු ඉලක්ක.</p>
<ol class="stages">${stages(0)}</ol>
<p><b>${esc(WORLDS[1].name)}</b> (World 2) — x${WORLDS[1].wins} Wins, අදියර ${WORLD_ZONES[1].length}ක්, තමන්ගේම Lava Egg, fiery dummies 2ක් සහ සැඟවුණු <b>Secret Star</b> එකක් (හම්බවුණොත් Power x2 සදහටම).</p>
<ol class="stages">${stages(1)}</ol>
</div>

<h2>කම්මැලි නොවෙන්න තියෙන දේවල්</h2>
<div class="card"><ul>
<li><b>Daily quests 3ක්</b> (EASY / MEDIUM / HARD) සහ bonus chest එකක් — හැමදාම අලුත්.</li>
<li><b>Login streak</b> — දිගටම දවස් ගාණක් සෙල්ලම් කළොත් Wins x2 දක්වා.</li>
<li><b>Daily rewards</b> (දවස් 7), <b>playtime gifts</b>, lobby එකේ <b>free reward</b>.</li>
<li><b>Lucky gifts</b> — විසි කිරීම් වලින් 8%ක අවස්ථාවක් පුදුම තෑග්ගකට.</li>
<li><b>අලුත් අදියරකට</b> පළමු වරට යනකොට Wins ත්‍යාගයක්; <b>PERFECT combo</b>; යාළුවෝ server එකේ ඉන්නකොට <b>friends bonus</b> (+30% දක්වා).</li>
<li><b>Rebirth gifts</b> (Rebirth 15 සිට සෑම 5කටම eggs), badges, leaderboards 4ක් (Rebirths, Total Wins, Longest Throw, Minutes Played).</li>
</ul></div>

<h2>Developer සටහන් — කොහෙද මොනවද</h2>
<div class="card"><ul>
<li><code>shared/balance.js</code> — හැම අංකයක්ම (කඩු, dummies, enchants, stages, මිල). <code>scripts/gen-stages.py</code> stage වගුව හදනවා, <code>node scripts/balance-sim.mjs</code> වේගය පරීක්ෂා කරනවා.</li>
<li><code>client/src/game/swords.js</code> — කඩු 24ේ හැඩ සහ shader එක. <code>enchants.js</code> — aura පාට.</li>
<li><code>client/src/game/launch.js</code> — THROW තදකරලා අරින logic එක. <code>playerPose.js</code> — කපන / විසි කරන animations.</li>
<li><code>client/src/game/roll/path.js</code> — කඩුවේ පියාසැරිය, කැරකීම, බිමේ ඇනීම. <code>rollControl.js</code>, <code>Roll.jsx</code> — කැමරාව, effects. <code>Lane.jsx</code> + <code>themes.js</code> — නිම්නයේ පාර සහ අදියර පෙනුම.</li>
<li><code>client/src/game/TrainingDummies.jsx</code> — dummies සහ කපන ආලෝක චාප. <code>client/src/game/world/</code> — lobby එක: මැද විවෘත plaza එකක් (spawn සිට THROW STAGE එකට කෙලින් මාවතක්, බාධා නැහැ), spawn ළඟ මාවත දෙපැත්තේ eggs පේළි දෙකක්, බටහිරින් training circle එක, නැගෙනහිරින් Sword Wall එක සහ Sword Counter එක, උතුරින් THROW STAGE එක. පිහිටීම් <code>shared/world.js</code>.</li>
<li>කේතයේ ඇතුළේ template නම් තියෙනවා: <code>health</code> = Power, <code>tire</code> = කඩුව, <code>ball</code> = enchantment, <code>pad</code> = dummy, <code>roll</code> = විසි කිරීම.</li>
</ul></div>
</main>
</body>
</html>
`

fs.writeFileSync(path.join(root, 'docs', 'game-guide-si.html'), html)
console.log(`docs/game-guide-si.html: ${(html.length / 1024).toFixed(1)} KB`)
