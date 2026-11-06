import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { startTestServer } from './helpers.mjs';

const server = await startTestServer();
const output = 'test-results/colorways';
await mkdir(output, { recursive: true });
try {
  for (const engine of (process.env.COLOR_BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(server.url);
      await page.waitForFunction(() => window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
      await page.evaluate(() => window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
      await page.waitForFunction(() => window.cityApproachGame.scene.keys.MainScene?.npcs?.length >= 5);
      const inventory = await page.evaluate(async () => {
        const { NPC_COLORWAYS, CHARACTER_STYLE_LABELS, npcColorKey, aiSourceKeyFor } = await import('/characters.js');
        const s = window.cityApproachGame.scene.keys.MainScene;
        const items = [];
        for (const base of Object.keys(CHARACTER_STYLE_LABELS)) for (const color of NPC_COLORWAYS) {
          const key = npcColorKey(base, color.key), raw = aiSourceKeyFor(key);
          const image = s.textures.get(raw).getSourceImage();
          const ctx = image.getContext('2d');
          const data = ctx.getImageData(0, 0, image.width, image.height).data;
          let opaque = 0, hash = 2166136261;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3]) opaque++;
            hash = Math.imul(hash ^ data[i] ^ (data[i + 1] << 8) ^ (data[i + 2] << 16) ^ (data[i + 3] << 24), 16777619) >>> 0;
          }
          items.push({ key, base, raw, hash, filled: opaque / (image.width * image.height),
            corner: ctx.getImageData(0, 0, 1, 1).data[3],
            icon: [0, 1].every(frame => s.textures.exists(`${key}-${frame}`) && s.textures.get(`${key}-${frame}`)._modeKey === 'icon'),
            animation: s.anims.exists(`${key}-walk`) });
        }
        return { items, spawned: [...new Set(s.npcs.map(n => n.profile.colorway))],
          player: s.player.texture.key, colorways: NPC_COLORWAYS.map(c => c.key) };
      });
      assert.equal(inventory.items.length, 40);
      assert.equal(inventory.spawned.length, 4, 'all palettes should appear in the initial street');
      assert.match(inventory.player, /^player-[01]$/);
      for (const item of inventory.items) {
        assert(item.icon && item.animation, `${item.key}: missing illustrated texture or animation`);
        assert(item.filled > .1 && item.filled < .62, `${item.key}: empty art or background haze (${item.filled})`);
        assert.equal(item.corner, 0, `${item.key}: transparent cell corner`);
      }
      for (const base of new Set(inventory.items.map(item => item.base))) {
        assert.equal(new Set(inventory.items.filter(item => item.base === base).map(item => item.hash)).size, 4, `${base}: repeated artwork`);
      }
      await page.screenshot({ path: `${output}/${engine}-street.png` });
      for (const color of inventory.colorways) {
        const expected = color === 'original' ? 'npc-friends' : `npc-friends-${color}`;
        await page.evaluate(async (color) => {
          const { npcColorKey, aiSourceKeyFor } = await import('/characters.js');
          const game = window.cityApproachGame, key = npcColorKey('npc-friends', color);
          game.scene.stop('MainScene'); game.scene.stop('EscortScene'); game.scene.stop('TalkScene');
          game.scene.start('TalkScene', { profile: { type: '友達同伴系', styleLabel: '地雷系', traits: ['友達といる'], interest: 70, flags: [] },
            mapKey: 'kabukicho', npcTextureKey: `${key}-0`, portraitTextureKey: aiSourceKeyFor(key) });
        }, color);
        await page.waitForFunction(expected => {
          const t = window.cityApproachGame.scene.keys.TalkScene;
          return t?.sys.isActive() && t.fieldTextureKey === `${expected}-0` && t.portraitImage?.active;
        }, expected);
        assert(await page.evaluate(() => {
          const t = window.cityApproachGame.scene.keys.TalkScene;
          return t.portraitImage.texture.key === t.portraitTextureKey;
        }), 'talk portrait must match the selected palette');
        await page.screenshot({ path: `${output}/${engine}-${color}-talk.png` });
        await page.evaluate(() => { const t = window.cityApproachGame.scene.keys.TalkScene; t.showFinal(true); t.returnToField(); });
        await page.waitForFunction(expected => {
          const e = window.cityApproachGame.scene.keys.EscortScene;
          return e?.sys.isActive() && e.partner?.active && e.partnerBase === expected;
        }, expected);
        await page.screenshot({ path: `${output}/${engine}-${color}-escort.png` });
      }
      assert.deepEqual(errors, []);
      if (engine === 'chromium') {
        await page.setViewportSize({ width: 640, height: 1680 });
        await page.evaluate(async () => {
          const { NPC_COLORWAYS, CHARACTER_STYLE_LABELS, npcColorKey, aiSourceKeyFor } = await import('/characters.js');
          const textures = window.cityApproachGame.textures;
          const sheet = document.createElement('div');
          sheet.style.cssText = 'position:absolute;inset:0;z-index:9999;background:#142031;color:#eee;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px;font:12px sans-serif;text-align:center';
          for (const color of NPC_COLORWAYS) { const h = document.createElement('div'); h.textContent = color.label; sheet.append(h); }
          for (const base of Object.keys(CHARACTER_STYLE_LABELS)) for (const color of NPC_COLORWAYS) {
            const item = document.createElement('div');
            const art = textures.get(aiSourceKeyFor(npcColorKey(base, color.key))).getSourceImage();
            art.style.cssText = 'display:block;width:140px;height:136px;object-fit:contain;margin:auto';
            item.append(art, document.createTextNode(CHARACTER_STYLE_LABELS[base])); sheet.append(item);
          }
          document.body.append(sheet);
        });
        await page.screenshot({ path: `${output}/all-40.png` });
      }
      console.log(`PASS ${engine}: 40 transparent appearances, 40 walk animations, four palettes on street, matching talk portraits and escort sprites`);
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
