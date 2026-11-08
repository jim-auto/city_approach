import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { GOAL_COSTUMES, GOAL_PALETTES, goalCostumeFor } from '../goal-costumes.js';
import { startTestServer } from './helpers.mjs';

const cases = Object.keys(GOAL_COSTUMES).flatMap(base =>
  (base === 'npc-prin-student' ? ['original'] : GOAL_PALETTES).map(palette =>
    `${base}${palette === 'original' ? '' : `-${palette}`}-0`));
assert.equal(cases.length, 41);
assert.equal(new Set(cases.map(key => goalCostumeFor(key).portraitKey)).size, 41);
assert.equal(new Set(cases.map(key => goalCostumeFor(key).label)).size, 11);
assert.deepEqual([...new Set(cases.map(key => goalCostumeFor(key).family))].sort(), ['bunny','gym','maid','nurse','police','sailor','swimsuit']);
assert.equal(goalCostumeFor('npc-prin-student-0').atlasPath, 'assets/ai/costumes-bunny-prin.png');
assert.equal(goalCostumeFor('unknown').base, 'npc-waiting');
assert.equal(goalCostumeFor(null).base, 'npc-waiting');
for (const key of cases) assert(goalCostumeFor(key).roomPath.startsWith('assets/ai/bedroom-'));
for (const key of cases) assert.deepEqual(goalCostumeFor(key), goalCostumeFor(key.replace(/-0$/, '-1')));

const output = 'test-results/costumes';
await mkdir(output, { recursive: true });
const server = await startTestServer();
try {
  for (const engine of (process.env.COSTUME_BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(server.url);
      await page.waitForFunction(() => window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
      await page.evaluate(() => window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
      await page.waitForFunction(() => window.cityApproachGame.scene.keys.MainScene?.player?.active);
      const hashes = new Set();
      for (const key of cases) {
        const expected = goalCostumeFor(key);
        await page.evaluate(key => {
          const game = window.cityApproachGame;
          game.scene.stop('MainScene'); game.scene.stop('EscortScene');
          game.scene.start('EscortScene', { score: 10, companion: { textureKey: key } });
        }, key);
        await page.waitForFunction(key => {
          const e = window.cityApproachGame.scene.keys.EscortScene;
          return e?.sys.isActive() && e.player?.active && !e.finished && e.runData.companion?.textureKey === key;
        }, key);
        const actual = await page.evaluate(() => {
          const e = window.cityApproachGame.scene.keys.EscortScene, s = e.goalSelection;
          const image = e.textures.get(s.portraitKey).getSourceImage(), ctx = image.getContext('2d');
          const data = ctx.getImageData(0, 0, image.width, image.height).data;
          let filled = 0, hash = 2166136261;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 16) filled++;
            hash = Math.imul(hash ^ data[i] ^ data[i + 1] << 8 ^ data[i + 2] << 16 ^ data[i + 3] << 24, 16777619) >>> 0;
          }
          e.nextQuestionIndex = e.questionCount; e.questionsAnswered = e.questionCount; e.destinationConfirmed = true;
          e.player.x = 2900; e.partner.x = 2832;
          return { selection: s, filled: filled / (image.width * image.height), hash,
            corner: ctx.getImageData(0, 0, 1, 1).data[3], square: image.width === image.height };
        });
        assert.deepEqual(actual.selection, expected);
        assert(actual.square, `${key}: distorted portrait canvas`);
        assert(actual.filled > .12 && actual.filled < .75, `${key}: empty or opaque costume (${actual.filled})`);
        assert(actual.corner <= 8, `${key}: costume has opaque backdrop or crosses cell border (${actual.corner})`);
        assert(!hashes.has(actual.hash), `${key}: repeated costume artwork`); hashes.add(actual.hash);
        await page.waitForFunction(() => window.cityApproachGame.scene.keys.EscortScene.goalTitle?.active);
        assert(await page.evaluate(expected => {
          const e = window.cityApproachGame.scene.keys.EscortScene;
          return e.goalArt.list[0].texture.key === expected.roomKey &&
            e.goalArt.list[3].texture.key === expected.portraitKey && e.goalCaption.text.includes(expected.label) &&
            e.score === 110 && e.finishText.text.includes(expected.quote.slice(0, 8)) &&
            e.goalArt.list.slice(2).every(person => {
              const b = person.texture.customData.goalBounds;
              return person.x + b.x * person.scaleX >= 10 &&
                person.y + b.y * person.scaleY >= e.goalCaption.height + 10 &&
                person.x + (b.x + b.width) * person.scaleX <= e.goalArt.width - 10 &&
                person.y + (b.y + b.height) * person.scaleY <= e.goalArt.height;
            });
        }, expected), `${key}: ending did not use the selected costume, room, or caption`);
        if (expected.palette === 'original' || expected.palette === 'prin') {
          await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
          await page.screenshot({ path: `${output}/${engine}-${expected.base}.png` });
        }
      }
      const gallery = await page.evaluate(({keys, labels}) => {
        const e = window.cityApproachGame.scene.keys.EscortScene;
        const canvas = document.createElement('canvas'); canvas.width = 880; canvas.height = 11 * 230;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e9e1ee'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const portraits = e.textures.getTextureKeys().filter(key => key.startsWith('goal-portrait-'));
        portraits.sort((a, b) => keys.indexOf(a) - keys.indexOf(b));
        portraits.forEach((key, i) => {
          const x = i % 4 * 220, y = Math.floor(i / 4) * 230;
          ctx.drawImage(e.textures.get(key).getSourceImage(), x + 15, y, 190, 190);
          ctx.fillStyle = '#21132c'; ctx.font = '13px sans-serif'; ctx.fillText(labels[key], x + 6, y + 205);
          ctx.font = '10px sans-serif'; ctx.fillText(key.replace('goal-portrait-retail-npc-', ''), x + 6, y + 222);
        });
        return canvas.toDataURL('image/png').split(',')[1];
      }, {keys: cases.map(key => goalCostumeFor(key).portraitKey), labels: Object.fromEntries(cases.map(key => {const s=goalCostumeFor(key); return [s.portraitKey,s.label];}))});
      await writeFile(`${output}/${engine}-all-41.png`, Buffer.from(gallery, 'base64'));
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine}: all 41 costume CGs, 7 costume families / 11 outfit variants, 2 rooms, transparency, palette identity, captions and score`);
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
