"""Writes the stage table into shared/balance.js: 80 stages, each a little longer than the last.

Usage: python scripts/gen-stages.py
Then check the pacing with: node scripts/balance-sim.mjs

Two things are set here, separately:
- where each gate stands (what players see): stage i is FIRST_LENGTH + LENGTH_STEP * i
  yards long, so the field stretches a little every stage;
- the Health each gate needs: about RATIO_START times the last at first, rising slowly
  towards RATIO_END. Health grows by about that much per rebirth late in the game, so a
  new stage keeps coming every few minutes instead of every twenty.
How far a sword flies follows from the two (logic.rollReach interpolates between gates).
World 1 (Sunblade Valley) is eighty stages long: the first sixty pace the game as before,
the last twenty are long-term goals for players past Rebirth 30.
"""
import math
import pathlib

FIRST_LENGTH = 94
LENGTH_STEP = 6
# Health that just reaches the first gate on open ground.
FIRST_REACH = 8.5
RATIO_START = 1.9
RATIO_STEP = 0.009
# A gate's wall needs this much more than the Health that reaches it (WALL_MARGIN).
MARGIN = 1.3
# Wins: per yard in the first stage, and how they follow the stage's Health (as a
# power of it): about the pace of ball prices.
W0 = 0.006
WINS_POWER = 0.48

stages = [
    ('grassy', 'Sunny Meadow', 'grassy'),
    ('autumn', 'Maple Trail', 'autumn'),
    ('desert', 'Sandstone Pass', 'desert'),
    ('beach', 'Seashell Coast', 'beach'),
    ('jungle', 'Vine Jungle', 'jungle'),
    ('frozen', 'Frostbite Tundra', 'frozen'),
    ('cherry', 'Blossom Grove', 'cherry'),
    ('candy', 'Candy Hills', 'candy'),
    ('mushroom', 'Toadstool Woods', 'mushroom'),
    ('volcano', 'Ember Volcano', 'volcano'),
    ('swamp', 'Murky Swamp', 'swamp'),
    ('crystal', 'Crystal Caverns', 'crystal'),
    ('ocean', 'Coral Reef', 'ocean'),
    ('neon', 'Neon Bazaar', 'neon'),
    ('sky', 'Cloud Kingdom', 'sky'),
    ('rainbow', 'Rainbow Falls', 'rainbow'),
    ('moon', 'Moonstone Craters', 'moon'),
    ('aurora', 'Aurora Peaks', 'aurora'),
    ('space', 'Starfall Orbit', 'space'),
    ('cosmic', 'Cosmic Gate', 'cosmic'),
    ('plains', 'Emerald Plains', 'grassy'),
    ('harvest', 'Harvest Woods', 'autumn'),
    ('dunes', 'Dune Sea', 'desert'),
    ('island', 'Palm Island', 'beach'),
    ('temple', 'Lost Temple', 'jungle'),
    ('glacier', 'Glacier Pass', 'frozen'),
    ('petals', 'Petal Gardens', 'cherry'),
    ('gumdrop', 'Gumdrop Valley', 'candy'),
    ('fungi', 'Fungi Forest', 'mushroom'),
    ('magma', 'Magma Core', 'volcano'),
    ('bog', 'Bog of Echoes', 'swamp'),
    ('gems', 'Gem Mines', 'crystal'),
    ('ruins', 'Sunken Ruins', 'ocean'),
    ('cyber', 'Cyber City', 'neon'),
    ('citadel', 'Sky Citadel', 'sky'),
    ('prism', 'Prism Path', 'rainbow'),
    ('lunar', 'Lunar Valley', 'moon'),
    ('lights', 'Northern Lights', 'aurora'),
    ('rift', 'Galaxy Rift', 'space'),
    ('infinity', 'Infinity Gate', 'cosmic'),
    ('sunflower', 'Sunflower Fields', 'grassy'),
    ('amber', 'Amber Forest', 'autumn'),
    ('oasis', 'Golden Oasis', 'desert'),
    ('lagoon', 'Blue Lagoon', 'beach'),
    ('canopy', 'Treetop Canopy', 'jungle'),
    ('yeti', 'Yeti Mountain', 'frozen'),
    ('lantern', 'Lantern Garden', 'cherry'),
    ('cupcake', 'Cupcake Kingdom', 'candy'),
    ('glowcap', 'Glowcap Grotto', 'mushroom'),
    ('inferno', 'Inferno Peak', 'volcano'),
    ('bayou', 'Firefly Bayou', 'swamp'),
    ('geode', 'Geode Valley', 'crystal'),
    ('atlantis', 'Atlantis', 'ocean'),
    ('arcade', 'Arcade Avenue', 'neon'),
    ('isles', 'Floating Isles', 'sky'),
    ('unicorn', 'Unicorn Trail', 'rainbow'),
    ('mars', 'Red Planet', 'moon'),
    ('comet', 'Comet Ice', 'aurora'),
    ('nebula', 'Nebula', 'space'),
    ('starforge', 'Star Forge', 'cosmic'),
    ('hero', 'Hero Meadow', 'grassy'),
    ('crimson', 'Crimson Woods', 'autumn'),
    ('pharaoh', 'Pharaoh Sands', 'desert'),
    ('cove', 'Pirate Cove', 'beach'),
    ('wyvern', 'Wyvern Jungle', 'jungle'),
    ('giant', 'Frost Giant Hold', 'frozen'),
    ('spirit', 'Spirit Blossoms', 'cherry'),
    ('sugar', 'Sugar Castle', 'candy'),
    ('spores', 'Mystic Spores', 'mushroom'),
    ('phoenix', 'Phoenix Caldera', 'volcano'),
    ('witch', 'Witch Marsh', 'swamp'),
    ('spire', 'Diamond Spire', 'crystal'),
    ('leviathan', 'Leviathan Deep', 'ocean'),
    ('grid', 'Hyper Grid', 'neon'),
    ('heaven', 'Sky Bridge', 'sky'),
    ('spectrum', 'Spectrum Realm', 'rainbow'),
    ('eclipse', 'Eclipse Basin', 'moon'),
    ('veil', 'Celestial Veil', 'aurora'),
    ('blackhole', 'Black Hole Edge', 'space'),
    ('legend', 'Legend Summit', 'cosmic'),
]


def r2(n):
    if n < 100:
        return round(n)
    st = 10 ** (math.floor(math.log10(n)) - 1)
    return round(n / st) * st


def num(n):
    if n >= 1e6:
        e = math.floor(math.log10(n))
        return f"{n / 10 ** e:.2g}e{e}"
    return f"{n:g}"


lines = []
start = 0
reach = FIRST_REACH
for i, (sid, name, theme) in enumerate(stages):
    if i == 0:
        wall = smash = disc = 0
        wpm = W0
    else:
        if i > 1:
            start += FIRST_LENGTH + LENGTH_STEP * (i - 1)
            reach *= RATIO_START + RATIO_STEP * i
        else:
            start = FIRST_LENGTH + LENGTH_STEP
        wall = r2(MARGIN * reach)
        m = (reach / FIRST_REACH) ** WINS_POWER
        smash = max(1, r2(2 * m))
        disc = max(2, r2(5 * m))
        wpm = float(f"{W0 * 1.2 * m:.3g}")
    lines.append(f"  {{ id: '{sid}', name: '{name}', theme: '{theme}', start: {start}, wall: {num(wall)}, winsPerMeter: {num(wpm)}, smash: {num(smash)}, discover: {num(disc)} }},")

p = pathlib.Path(__file__).resolve().parent.parent / 'shared' / 'balance.js'
s = p.read_text(encoding='utf-8')
a = s.index('export const ZONES = [')
b = s.index('\n]', a) + 2
s = s[:a] + 'export const ZONES = [\n' + '\n'.join(lines) + s[b - 2:]
p.write_text(s, encoding='utf-8')
print(f'{len(stages)} stages, field {start} yd, last wall {num(r2(MARGIN * reach))}')
