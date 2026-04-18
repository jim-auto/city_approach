# city-approach Handoff Plan

This file is a long-form handoff note for the next coding agent, especially Claude. It describes the current state of the project, why the implementation is shaped this way, what has already been verified, and what would be useful to improve next.

Last updated: 2026-04-19 JST (added 離れる, WebAudio SFX, difficulty, high score, history)

## 1. Project Summary

`city-approach` is a no-build browser game built with vanilla HTML/CSS/JavaScript and Phaser 3 from a CDN. It is intended to run directly on GitHub Pages.

Public URL:

https://jim-auto.github.io/city_approach/

Repository:

https://github.com/jim-auto/city_approach

Current branch:

`main`

Important commits:

- `ecafaaf Build city approach game`
- `86f1e9a Refine retro pixel art style`

The project is currently deployed and GitHub Pages status was confirmed as `built` after the last push.

## 2. User Intent

The user requested a mobile-playable 2D game where the player moves around a city, approaches NPCs, chooses an approach style, and enters a lightweight conversation battle when successful.

Later, the user asked for the pixel art to feel more like Undertale. The implementation intentionally does not copy Undertale assets or UI directly. The current direction is:

- dark background
- high contrast
- thick black outlines
- small low-color sprites
- mostly monochrome city tiles
- small neon accent colors for Kabukicho
- simple readable shapes rather than detailed anime-style characters

Keep this distinction important: "inspired by retro high-contrast RPG pixel aesthetics", not direct reproduction of a copyrighted style.

## 3. Current File Structure

```text
project-root/
+-- index.html
+-- style.css
+-- main.js
+-- sfx.js
+-- storage.js
+-- README.md
+-- PLAN.md
+-- scenes/
|   +-- MainScene.js
|   +-- TalkScene.js
+-- assets/
    +-- player.png
    +-- npc.png
    +-- tiles.png
```

There is no build system, no package.json, and no bundler. `index.html` loads Phaser via CDN and `main.js` as an ES module.

## 4. Technical Constraints

Original requirements:

- HTML / CSS / JavaScript only
- Vanilla implementation
- Phaser 3 via CDN
- No build step
- GitHub Pages compatible
- Mobile iPhone/Android support
- Touch-only playable
- Lightweight enough for 60fps

Current implementation follows this:

- Phaser CDN is loaded from jsDelivr in `index.html`.
- Canvas is full screen.
- Browser scrolling is suppressed in `style.css` and `main.js`.
- Game scale uses `Phaser.Scale.RESIZE`.
- Input uses touch pointers with a virtual joystick and large buttons.
- Rendering is simple: generated shapes, a few sprites, no heavy particle systems.

## 5. Gameplay Loop

Main flow:

1. Player starts in `MainScene`.
2. Player moves with a virtual joystick in the lower-left corner.
3. NPCs are placed in the city.
4. NPCs have profile state:
   - `interest`
   - `traits`
   - `difficulty`
   - `effective_actions`
   - `bad_actions`
   - `flags`
5. When the player is close enough to an NPC, the NPC gets a highlight ring.
6. Player chooses one of four action buttons:
   - `軽く`
   - `ストレート`
   - `状況ツッコミ`
   - `離れる` (respectful skip — scores based on defensive signals; see §19)
7. Success rate is calculated from base rate, map noise, NPC interest, traits, selected action, and distance.
8. Success transitions to `TalkScene`.
9. Failure marks that NPC as disabled/faded and shows feedback.
10. In `TalkScene`, the player reacts to timed lines with:
   - `共感`
   - `ツッコミ`
   - `提案`
11. Correct timed choices increase favor.
12. Bad choices or timeouts increase discomfort.
13. Results:
   - Favor reaches 100: `カフェ成功`
   - Discomfort reaches 100: failure
   - Lines end: intermediate result

## 6. Scene Architecture

### `main.js`

Responsibilities:

- Prevent mobile touch scrolling.
- Configure Phaser game.
- Set `Phaser.Scale.RESIZE`.
- Enable arcade physics.
- Use pixel-art rendering settings.
- Register scenes:
  - `MainScene`
  - `TalkScene`
- Store game instance at `window.cityApproachGame`.

The global instance is useful for quick debugging from Playwright or browser console:

```js
window.cityApproachGame.scene.start("TalkScene", { mapKey: "kabukicho" });
```

### `scenes/MainScene.js`

This is the field/exploration scene.

Important constants:

- `WORLD`: fixed world size, currently `1280 x 760`.
- `MAPS`: map definitions for `nagoya` and `kabukicho`.
- `CHARACTER_TYPES`: abstract NPC behavior archetypes.
- `MAP_TRAITS`: extra traits by city.
- `TRAIT_RATE_MODS`: success-rate modifiers per trait.
- `ACTIONS`: approach actions and trait-specific modifiers.
- `FLAG_ICONS`: compact icons shown above NPCs.

Important methods:

- `preload()`: loads `player`, `npc`, `tiles`.
- `create()`: initializes camera, world, player, HUD, map, input.
- `buildMap()`: clears and rebuilds current map.
- `drawNagoyaMap()`: draws the Nagoya Station-inspired map.
- `drawKabukichoMap()`: draws the Kabukicho-inspired map.
- `spawnNpcs()`: creates interactive NPCs.
- `makeProfile()`: generates NPC profile from archetype + map traits.
- `spawnAmbient()`: creates non-interactive crowd sprites.
- `registerJoystickInput()`: handles touch joystick.
- `updateJoystick()`: calculates joystick vector.
- `updateNpcs()`: moves NPCs.
- `updateNearestNpc()`: detects approach range.
- `tryApproach()`: runs success/failure check. Pushes an entry to `history` on both branches.
- `respectfullySkip()`: disables the near NPC and adds a small Score bonus based on how strong the defensive signals were. Bonus is multiplied by `this.difficulty.mult`. No TalkScene transition.
- `toggleDifficulty()`: cycles the difficulty, persists via `storage.js`, updates the HUD button label and info text.
- `updateBest()`: syncs `this.best` with the current score and persists to `localStorage` when it exceeds the stored value.
- `pushHistory(entry)`: keeps the last 3 outcome strings for the info HUD.
- `calculateSkipBonus()`: maps defensive traits (`イヤホン`, `友達といる`, `歩くの速い`, `外界遮断`, `夜の警戒`, `人混み`) to a bonus capped at 15. If none match but open traits are present, returns 1. If nothing matches, returns 2.
- `calculateSuccessRate()`: core approach probability logic.
- `feedbackFor()`: failure feedback text.
- `switchMap()`: toggles Nagoya/Kabukicho.

### `scenes/TalkScene.js`

This is the conversation battle scene.

Important constants:

- `CHOICES`: the three response buttons.

Important methods:

- `create()`: initializes profile, gauges, UI, lines.
- `buildLines()`: creates conversation lines based on NPC traits and map.
- `createChoiceButton()`: builds touch-friendly buttons.
- `drawBackground()`: draws the lightweight battle background.
- `drawGauges()`: draws favor and discomfort gauges.
- `nextLine()`: advances conversation.
- `choose()`: handles player response.
- `timeoutLine()`: handles missed timing.
- `showFinal()`: displays final result.
- `returnToField()`: returns to `MainScene`.

## 7. Current Visual Direction

The latest visual pass was done because the user said:

> なんかドットをもっとアンダーテイルみたいにいいかんじにしたい。

Current interpretation:

- Black/dark gray maps.
- White grid and road markings.
- NPC/player have very thick black outlines.
- Faces and clothing are readable at 32x32.
- Accent colors:
  - player cyan
  - NPC pink/gold
  - Kabukicho neon cyan/pink/gold
- Nagoya is calmer and more monochrome.
- Kabukicho has denser neon specks and brighter signage.

Do not add Undertale logos, character silhouettes, fonts, music, battle boxes, or copied UI. Keep this original.

## 8. Assets

Current assets:

- `assets/player.png`
- `assets/npc.png`
- `assets/tiles.png`

They were generated locally as simple 32x32 / 64x64 PNGs using PowerShell + `System.Drawing`. The generation script is not saved in the repo. If Claude wants to regenerate them, either:

- write a temporary local script again,
- use a small pixel editor,
- or replace with hand-authored PNGs.

Important:

- Keep file names the same unless updating preload keys in `MainScene.js`.
- Keep sprites small to preserve the lightweight 60fps target.
- Keep `image-rendering: pixelated` in CSS.
- Avoid large external image dependencies.

## 9. City Research Reflected In Game

The research summary is in `README.md`, but the important game design mapping is:

### Nagoya Station

Observed/abstracted features:

- wide station concourse
- central movement between exits
- waiting around clocks
- people stopping near gates
- direct, rule-like pedestrian flow

Game reflection:

- long horizontal concourse
- Gold Clock / Silver Clock areas
- gate stop point
- mostly linear NPC movement
- lower map noise than Kabukicho
- waiting traits can slightly improve approach odds

### Kabukicho

Observed/abstracted features:

- nightlife district
- neon
- denser pedestrian environment
- tourists and groups
- more street approaches, more guarded reactions
- less predictable movement

Game reflection:

- dark map with neon signage
- random NPC/crowd movement
- higher ambient density
- extra noise penalty
- conversation line about being cautious because many people call out nearby

## 10. NPC Profile System

The NPC system is intentionally abstract. It does not identify real people or stereotype protected groups. It uses visible behavioral signals only.

Examples currently represented:

```js
{
  type: "忙しい系",
  traits: ["スマホ", "歩くの速い", "外界遮断"],
  difficulty: "高",
  effective_actions: ["短く要点", "邪魔しない"],
  bad_actions: ["長話", "距離詰め"]
}
```

Other archetypes:

- `待ち合わせ系`
- `忙しい系`
- `友達同伴系`
- `目線あり系`
- `イヤホン系`
- `観光・迷い中系`

The strongest negative traits include:

- `イヤホン`
- `友達といる`
- `歩くの速い`
- `外界遮断`
- `夜の警戒`

Positive or contextually useful traits include:

- `目が合う`
- `立ち止まり`
- `待ち合わせ`
- `周囲を見る`
- `観光中`

Approach actions:

- `soft`: safer when there is eye contact or someone is stopped.
- `straight`: can work with eye contact but penalized for busy/fast/group/earphones.
- `situational`: works better for phone, looking around, tourist/context clues.

## 11. Success Formula

In `calculateSuccessRate(profile, actionKey)`:

```js
rate = 0.3 + map.baseBonus - map.noisePenalty + (profile.interest - 50) / 190;
```

Then:

- add trait modifiers from `TRAIT_RATE_MODS`
- add action-specific trait modifiers
- add action default modifier
- penalize too-close distance
- penalize too-far distance
- clamp between `0.04` and `0.86`

This is intentionally simple and easy to tune.

Potential next improvement:

- show estimated odds indirectly through NPC icons or body language, not raw percentage.
- add difficulty mode that adjusts base rate/noise.
- add "respectful exit" scoring when player chooses not to approach high-defense NPCs.

## 12. TalkScene Battle Logic

The line data shape:

```js
{
  text: "でもちょっと時間あるし",
  weak: true,
  correct: ["proposal", "empathy"],
  cue: "時間の余白"
}
```

Current behavior:

- Weak lines require correct choice while displayed.
- Correct choice increases favor by 24 and reduces discomfort by 6.
- Wrong choice on weak line increases discomfort by 22.
- Timeout on weak line increases discomfort by 10.
- Non-weak line is observation phase and should not be played aggressively.

Potential next improvement:

- stronger visual timing indicator
- floating words with motion, but keep performance light
- more varied line pools
- line generation based on map + traits + previous action
- add small "read the cue" teaching feedback after the result

## 13. UI Notes

Mobile controls:

- joystick lower left
- approach buttons lower right
- map switch button upper right
- status text upper left
- message box near top center on mobile to avoid covering the buttons

Known detail:

- Japanese text wrapping is done by simple character count in `wrapText`.
- This works acceptably for current short text but is not a full Japanese line-breaking algorithm.
- If text becomes longer, improve wrapping.

Button sizes are intentionally large for touch.

## 14. Verification Already Performed

Commands previously run successfully:

```powershell
node --check main.js
node --check scenes/MainScene.js
node --check scenes/TalkScene.js
```

Playwright screenshots were used to verify:

- local desktop view
- local mobile portrait view
- Kabukicho map view
- deployed mobile portrait view

GitHub Pages was checked through:

```powershell
gh api repos/jim-auto/city_approach/pages --jq '{status:.status, html_url:.html_url, source:.source}'
```

Last observed Pages status:

```json
{
  "html_url": "https://jim-auto.github.io/city_approach/",
  "source": {
    "branch": "main",
    "path": "/"
  },
  "status": "built"
}
```

## 15. Useful Local Commands

Start local static server:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8000/
```

Run syntax checks:

```powershell
node --check main.js
node --check scenes/MainScene.js
node --check scenes/TalkScene.js
```

Take a quick mobile screenshot if Playwright is available:

```powershell
npx playwright screenshot --viewport-size=390,844 --wait-for-timeout=3000 http://127.0.0.1:8000/ check-mobile.png
```

Deploy after commit:

```powershell
git push
```

Pages is already configured to publish `main` branch root.

## 16. Known Gaps And Risks

### No automated gameplay tests

There is no persistent test suite. Browser checks were manual/temporary. If the project grows, add a tiny smoke script or Playwright setup.

### Audio (implemented 2026-04-19)

`sfx.js` is a tiny WebAudio module. It creates one `AudioContext` on the first `pointerdown`/`keydown`/`touchstart` (required for mobile autoplay policies) and exposes `sfx.play(name)` with these presets:

- `success` / `fail` — approach outcome in `MainScene.tryApproach()`
- `skip` — `MainScene.respectfullySkip()` and TalkScene's "intermediate" result
- `tick` — TalkScene `nextLine()` and non-weak choices
- `hit` / `miss` — TalkScene `choose()` correct / wrong on weak lines
- `win` / `lose` — TalkScene `showFinal()`

Each preset is a short oscillator tone (50–340ms) with a frequency sweep and an envelope. Chord presets (`win`, `lose`) layer three staggered tones. No external audio files — keeps the no-build / GitHub Pages constraint.

If audio ever needs to be disabled, set `sfx.enabled = false` from the console; all `play()` calls become no-ops.

### No animation frames

Player/NPC sprites are static. Movement still works, but walking would feel better with 2-frame or 4-frame animation.

Recommendation:

- create a small spritesheet later
- keep it 32x32 frames
- use Phaser animations

### NPC signs are currently text-like icons

Icons above NPCs use text:

- `◎`
- `!`
- `>>`
- `2`
- `□`
- `E`
- `W`
- `?`

They are functional but visually plain. A good next polish pass would replace these with tiny pixel glyphs drawn in Phaser or a small icon sheet.

### Conversation battle is simple

The current TalkScene is MVP-level. It has timing and gauges, but the "battle" could be more expressive.

Safe improvements:

- staggered text reveal
- screen shake on wrong answer
- color pulse on weak lines
- small bullet/choice animation
- better result screen

Avoid:

- copying Danganronpa UI too closely
- copying Undertale battle UI
- adding too much motion that hurts mobile readability

### GitHub Pages cache

If a visual change appears stale, use a query string:

```text
https://jim-auto.github.io/city_approach/?v=<commit-sha>
```

## 17. Suggested Next Tasks

Priority order if Claude continues:

1. Improve player/NPC animation.
2. Replace text status icons with pixel icon sheet.
3. ~~Add lightweight sound effects.~~ **Done** (2026-04-19): `sfx.js` + wiring in both scenes. Next polish: gauge-change tick, volume slider.
4. Add a title or start overlay only if it does not block direct play.
5. ~~Add simple "respectful skip" mechanic where not approaching a busy/high-defense NPC gives a small score.~~ **Done** (2026-04-19): `離れる` button in `MainScene.respectfullySkip()`. Tuning the bonus table in `calculateSkipBonus()` is the natural next polish.
6. Add more conversation lines per trait.
7. ~~Add a small result log so the player learns why an approach worked or failed.~~ **Done** (2026-04-19): last 3 entries tracked in `MainScene.history` and the most recent is shown as the third line of the info HUD. Entries survive map switches and TalkScene round-trips via scene data.
8. ~~Add a difficulty selector.~~ **Done** (2026-04-19): three levels (`やさしい`/`ふつう`/`きびしい`) in `storage.js`. A HUD button cycles them and persists the choice in `localStorage`. `baseMod`/`noiseMod` shift the success formula; `mult` scales both skip and TalkScene bonuses so the leaderboard reflects actual difficulty.
9. ~~Add local persistent high score with `localStorage`.~~ **Done** (2026-04-19): `getBest`/`setBest` in `storage.js`. `MainScene.updateBest()` persists on any new high. Displayed in the info HUD as `Best <n>`.
10. Add a tiny smoke test script to prevent scene-init regressions.

## 18. Recommended Art Improvements

The user's latest visual request was about the pixel style. If continuing visual polish, focus here:

- Make the player silhouette more readable from top-down/three-quarter view.
- Create separate NPC variants:
  - fast walker
  - phone user
  - group/friend pair
  - earphones
  - tourist/looking around
- Use 2-frame idle animation:
  - slight head/body bob
  - no smooth tweening needed
- For Nagoya:
  - add brighter clock silhouettes
  - add gate stripes
  - add more station signage blocks
- For Kabukicho:
  - add small flickering neon rectangles
  - add darker alley edges
  - add tiny crowd clusters

Keep the palette restrained. Current palette idea:

```text
black:   #050509
dark:    #11131a
mid:     #242832
white:   #f5f1df
cyan:    #57f5ff
pink:    #ff4d6d
gold:    #ffd24f
gray:    #8c8c86
```

## 19. Behavioral Design Guardrails

The game should teach "read the situation and back off when appropriate", not just "maximize pickup success".

Maintain these guardrails:

- Do not represent real people.
- Do not target protected classes or physical attributes.
- Base NPC logic on abstract behavioral signals.
- Failure feedback should encourage respecting boundaries.
- Avoid language that frames persistence after rejection as positive.
- Keep "do not approach" as a valid implied lesson.

Implemented (2026-04-19):

- `離れる` button added as the 4th action button in `MainScene.createHud()`.
- `respectfullySkip()` reads the near NPC's traits and calls `calculateSkipBonus()`.
- Score goes up more when defensive signals (`イヤホン`, `友達といる`, `歩くの速い`, `外界遮断`, `夜の警戒`, `人混み`) are present. Capped at +15 to avoid farming.
- Open-signal NPCs (`目が合う`, `立ち止まり`, `待ち合わせ`) only give +1 for skipping — the game still rewards engaging when signals are clearly open, just doesn't punish backing off.
- After skip, the NPC fades (same as approach failure) so the player can't skip the same target twice.

## 20. Deployment State

Pages is already configured:

- branch: `main`
- path: `/`
- URL: `https://jim-auto.github.io/city_approach/`

After future changes:

```powershell
git status --short --branch
git add <changed files>
git commit -m "<message>"
git push
```

Then wait for Pages:

```powershell
gh api repos/jim-auto/city_approach/pages --jq '.status'
```

Expected:

```text
built
```

## 21. Current Cleanliness

Before this `PLAN.md` update, the worktree was clean and synced with `origin/main`.

After editing this file, commit and push if the handoff needs to be visible on GitHub.
