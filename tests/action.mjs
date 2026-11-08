import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { startTestServer } from './helpers.mjs';

const server = await startTestServer();
await mkdir('test-results/action', { recursive: true });
async function snapshot(page) {
  return page.evaluate(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene, a = e.walkAction;
    return { x: e.player.x, y: e.player.y, ground: e.groundY, jump: a.jumpOffset, jumps: a.jumps,
      held: a.held.size, assists: a.assists, fever: a.fever, fevers: a.fevers, slow: a.slow,
      collected: a.collected, cleared: a.cleared, splashes: a.splashes, bonus: a.bonus, score: e.score,
      doubt: e.doubt, question: Boolean(e.currentQuestion), finished: e.finished };
  });
}
try {
  for (const [engine, width, height] of [['chromium', 390, 844], ['webkit', 568, 320]].filter(([name]) => !process.env.ACTION_BROWSERS || process.env.ACTION_BROWSERS.split(',').includes(name))) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(server.url);
      await page.waitForFunction(() => window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
      await page.evaluate(() => window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
      await page.waitForFunction(() => window.cityApproachGame.scene.keys.MainScene?.player?.active);
      await page.evaluate(() => window.cityApproachGame.scene.keys.MainScene.scene.start('EscortScene', { score: 10 }));
      await page.waitForFunction(() => window.cityApproachGame.scene.keys.EscortScene?.jumpButton?.active);
      const point = property => page.evaluate(property => {
        const e = window.cityApproachGame.scene.keys.EscortScene, b = e[property].getBounds(), r = e.game.canvas.getBoundingClientRect();
        return { x: r.x + b.centerX, y: r.y + b.centerY, width: b.width, height: b.height };
      }, property);
      const jump = await point('jumpButton'); assert(jump.width >= 44 && jump.height >= 44);
      assert(await page.evaluate(()=>{ const e=window.cityApproachGame.scene.keys.EscortScene;
        const hud=e.hud.getBounds(), status=e.walkAction.status.getBounds();
        return status.y>=hud.bottom+1 && status.bottom<(e.compact?66:82) && status.right<=e.scale.width-10;
      }), 'action status must fit below the distance without overlapping the progress bar');
      await page.touchscreen.tap(jump.x, jump.y);
      await page.waitForFunction(() => window.cityApproachGame.scene.keys.EscortScene.walkAction.jumpOffset > 12);
      assert.equal((await snapshot(page)).x, 150, 'jump tap must not also set a walk destination');
      await page.waitForFunction(() => window.cityApproachGame.scene.keys.EscortScene.walkAction.jumpTime === null);
      assert.equal((await snapshot(page)).held, 0, 'tap release must not leave auto-jump stuck');
      const cdp = engine === 'chromium' ? await context.newCDPSession(page) : null;
      for (let segment = 0; segment < 5; segment++) {
        const right = await point('rightButton'), jump = await point('jumpButton');
        if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: right.x, y: right.y }, { id: 2, x: jump.x, y: jump.y }] });
        else { await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space'); }
        if (segment === 0) {
          await page.waitForFunction(() => { const e=window.cityApproachGame.scene.keys.EscortScene; return e.walkAction.fever > 0 && e.walkAction.jumpOffset > 15 && !e.currentQuestion; });
          await page.screenshot({ path: `test-results/action/${engine}-jump-fever.png` });
        }
        await page.waitForFunction(() => {
          const e = window.cityApproachGame.scene.keys.EscortScene;
          return e.finished || e.currentQuestion;
        }, null, { timeout: 30000 }).catch(async error => { throw new Error(`${error.message}: ${JSON.stringify(await snapshot(page))}`); });
        if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else { await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space'); }
        if ((await snapshot(page)).finished) break;
        const paused = await snapshot(page);
        assert.equal(paused.jump, 0); assert.equal(paused.held, 0);
        await page.waitForTimeout(220);
        const still = await snapshot(page);
        assert.equal(still.score, paused.score); assert.equal(still.fever, paused.fever); assert.equal(still.x, paused.x);
        if (segment === 0) {
          assert(paused.collected >= 4 && paused.fevers >= 1 && paused.jumps >= 2, 'holding jump should produce rewards and a fever');
          await page.screenshot({ path: `test-results/action/${engine}-first-checkpoint.png` });
        }
        await page.getByRole('button', { name: '行き先を話す', exact: true }).click();
        await page.waitForFunction(() => !window.cityApproachGame.scene.keys.EscortScene.currentQuestion);
      }
      const goal = await snapshot(page);
      assert(goal.finished && goal.collected >= 16 && goal.fevers >= 2 && goal.jumps >= 6);
      assert.equal(goal.bonus, goal.collected * 5 + goal.fevers * 10);
      assert.equal(goal.score, 110 + goal.bonus, 'goal bonus and action rewards must each be awarded once');
      assert.equal(goal.doubt, 0, 'action misses must never add distrust');
      await page.screenshot({ path: `test-results/action/${engine}-goal.png` });
      // Walking without the action button remains easy and can clear the road.
      await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.scene.restart({ score: 10 }));
      await page.waitForFunction(() => { const e = window.cityApproachGame.scene.keys.EscortScene; return !e.finished && e.player?.active; });
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => Boolean(window.cityApproachGame.scene.keys.EscortScene.currentQuestion));
      await page.keyboard.up('ArrowRight');
      const assisted = await snapshot(page);
      assert(assisted.assists >= 2 && assisted.cleared >= 2 && assisted.collected >= 4, JSON.stringify(assisted));
      assert.equal(assisted.doubt, 0); assert.equal(assisted.splashes, 0);
      // A late collision is a short slowdown, never a game over or score loss.
      const collision = await page.evaluate(() => {
        const e = window.cityApproachGame.scene.keys.EscortScene, a = e.walkAction;
        e.currentQuestion = null; e.dialogState = null; e.layoutConversation();
        e.releaseAll(); e.player.x = a.puddles[2].x; const score = e.score;
        a.resolve(1); const after = { slow: a.slow, score: e.score, doubt: e.doubt, finished: e.finished, splashes: a.splashes };
        a.update(.5, 0);
        return { before: score, after, recovered: a.slow === 0 };
      });
      assert(collision.after.slow > 0 && collision.recovered && !collision.after.finished);
      // Ground-heart collection on this frame is allowed; a collision cannot subtract points.
      assert(collision.after.score >= collision.before); assert.equal(collision.after.doubt, 0);
      // Cancel interrupted touch gestures so jumping cannot continue after a blur or rotation.
      const previousJumps = await page.evaluate(() => { const a=window.cityApproachGame.scene.keys.EscortScene.walkAction; a.jump(true); a.update(.1, 0); return a.jumps; });
      const jumpAgain = await point('jumpButton');
      await page.mouse.move(jumpAgain.x, jumpAgain.y); await page.mouse.down();
      assert.equal((await snapshot(page)).held, 1);
      assert.equal((await snapshot(page)).jumps, previousJumps + 1, 'manual input must upgrade an automatic hop immediately');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal((await snapshot(page)).held, 0); await page.mouse.up();
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => { const e = window.cityApproachGame.scene.keys.EscortScene; return e.scale.width === document.getElementById('game').clientWidth; });
      const rotated = await point('jumpButton'); assert(rotated.width >= 44 && rotated.height >= 44);
      await page.screenshot({ path: `test-results/action/${engine}-rotated.png` });
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine}: full route, ${cdp ? 'real two-finger' : 'touch tap + keyboard hold'} jump, combo/fever, paused dialogue, score, easy assist, gentle collision, blur and rotation`);
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
