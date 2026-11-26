---
canDie: false
hasScore: true
---

# Sword Toss Legends: Boxity integration

The player cannot die: there is no death or game-over screen. You slash training dummies
for Power (nine dummies, x1 to x130), step onto a throw spot in the THROW ZONE, hold THROW
to wind up and let go at the top of the meter (PERFECT for up to x1.5 distance and x1.6
Wins): your sword spins end over end down a long valley road - Sunblade Valley's eighty
themed stages, nearly 26 km - and sticks point-first into the road. More Power throws it
further, every metre pays Wins, and a stage reached for the first time pays a prize. You
always get another throw. Swords (36 kinds, each its own shape and its own trail - wood, bamboo, stone,
bone, copper, iron, steel... gold, lava, gems, galaxy, dragon, cyber, infinity, then 12 Legend swords that also pay +10% to +200% Wins - bought
with Wins at the SWORD SHOP) set how much Power each gain is worth; enchantments (12
auras from the ENCHANT ALTAR) throw further, pay more and trail fire, frost or lightning.
Rebirth 8 times and hold 1M Wins to open the portal to Dragonfire Peaks (World 2, x3
Wins).

Built on the Phone Plunge template (networking, saves, identity) with the +1 Baseball
Launch gameplay layer: inside the code the old names stay (`health` is Power, a `tire`
is a sword, a `ball` is an enchantment, a `pad` is a training dummy, a `roll` is a throw
and a `zone` is a stage of the road), so the server protocol is unchanged.

## Leaderboards

Scores are reported by the **game server**, never by the client
(`server/src/bloxityLeaderboards.js`, `BLOXITY_LEADERBOARDS`). Every ~20 s and when a
player leaves, each pod sends the changed scores of its verified players to
`POST {api}/v1/leaderboards/hosted/{BLOXITY_GAME_ID}/report` as `legion_<userId>`.

| Board      | Label            | Score                                | Format  |
|------------|------------------|--------------------------------------|---------|
| `rebirths` | Rebirths         | `profile.rebirths`                   | number  |
| `wins`     | Total Wins       | `profile.stats.totalWins`            | compact |
| `distance` | Longest Throw (m)| `floor(profile.stats.bestDistance)`  | compact |
| `playtime` | Minutes Played   | `floor(profile.stats.playtime / 60)` | number  |

All four are `order: desc`, `mode: best`, `reset: none`.

## Identity and saves

- Signed in: the client sends the SDK's game token (only while `getUser()` is non-null);
  the server verifies it with `POST {api}/v1/auth/game-token/verify` and saves under the
  returned `user._id` only. Ids in the join options are ignored.
- Guests (no token, a refused/expired token, or Boxity unreachable): the server makes the
  id (`guest-<uuid>`) and sends the browser a **save ticket** - that id signed with a
  per-database secret (`server/src/saveTickets.js`). The browser keeps its last 5 tickets
  (`pp.saveTickets`) and shows them on every join, so a guest gets back into their own
  save whatever the SDK's guest identity does. Forged or edited tickets are ignored.
- Carry-over: an id with no save yet gets the first unused save among Boxity's
  `carriedFrom` guest ids and the browser's ticketed guest saves, copied once.

## Screen ads

`ads.declareScreens({ panel: {}, gameplay: {} })` once after init; the client then calls
`ads.screen('panel')` while a modal panel is open and `ads.screen('gameplay')` otherwise.
Gameplay banners are **off** (no `show: true`); turning them on is the developer's call.

## Gems purchases

Boxity's purchase webhook goes to `POST /api/gems/webhook` on the game server. It is
recorded in the database by `transactionId` (idempotent) and applied exactly once by
the pod the buyer plays on. Unknown skus are answered 400 so Boxity refunds them.

## Rewarded ads

The client sends `adReward { placement, rewardToken }`; the server verifies the token
with `POST {api}/v1/ads/reward/verify` before granting anything.

## Open Rooms

Each pod reports its rooms every 2 s to `POST {MATCHMAKER_REPORT_URL}/{BLOXITY_GAME_ID}/rooms`
(`server/src/legionRoomReporter.js`, installed after `listen()`), so they show under
"Open Rooms" on the game page. The client joins `?roomId=` at launch and falls back to
normal matchmaking if that room is gone or full.

## Avatars

`client/src/game/PlayerAvatar.jsx` + `avatarRig.js` draw every slot: skin (with face,
shirt and pants), body parts, hat + hair + mask on `Neck1`, back on `Spine2`, neck/chest
on `Spine2` and waist on `Spine1` (rest-inverse placement), hands and shoes as mirrored
pairs following the leaf bones' position and rotation only. A player wearing an uploaded
character (`characterId`) gets its GLB via `avatar.getCharacter()` / `getCharacterFor()`,
with accessories fitted by `characterAccessoryMatrix`; on any failure the regular avatar
shows. Body proportions are applied by moving bones, so accessories follow them.

## Server environment

| Variable                | Purpose                                                       |
|-------------------------|---------------------------------------------------------------|
| `BLOXITY_REPORT_TOKEN`  | Token for leaderboard and room reports (none set = no reports) |
| `MATCHMAKER_REPORT_URL` | Where the Open Rooms reporter posts (injected by Boxity hosting) |
| `BLOXITY_GAME_ID`       | Hosted game id for reports (default `1-sword-throwing`)          |
| `LEGION_WEBHOOK_SECRET` | Must match the webhook's `x-legion-webhook-secret` header     |
| `MONGODB_URI`           | Shared database for profiles, Gems grants and the save-ticket secret. Required when hosted: without it saves go to a file inside the pod and are lost on every redeploy (the server logs an error and `/api/health` shows `db: "sqlite"`) |
| `BLOXITY_API_URL` etc.  | Platform URLs, injected by Boxity hosting; no defaults are written in code (`server/src/bloxityEnv.js`) |
