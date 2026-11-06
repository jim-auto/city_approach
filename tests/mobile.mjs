import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { startTestServer } from "./helpers.mjs";

const output = process.env.MOBILE_OUTPUT || "test-results/mobile";
await mkdir(output, { recursive: true });
const server = await startTestServer();
const report = [];
let checks = 0;
const sizes = [
  { name: "small-portrait", width: 320, height: 568 },
  { name: "android-portrait", width: 360, height: 640 },
  { name: "notch-portrait", width: 390, height: 844, safe: [47, 0, 34, 0] },
  { name: "large-portrait", width: 412, height: 915 },
  { name: "small-landscape", width: 568, height: 320 },
  { name: "notch-landscape", width: 844, height: 390, safe: [0, 47, 21, 47] },
];
function check(value, message) { assert(value, message); checks += 1; }

async function state(page, key) {
  await page.waitForFunction((key) => {
    const s = window.cityApproachGame?.scene.keys[key];
    if (!s?.sys.isActive()) return false;
    // A restarted scene can be active while preload still holds destroyed objects
    // from its previous run. Wait for newly-created, live controls.
    if (key === "MainScene") return s.player?.active && s.actionButtons?.every((b) => b.active);
    if (key === "EscortScene") return s.player?.active && s.rightButton?.active;
    if (key === "TalkScene") return s.lineText?.active && s.choiceButtons?.every((b) => b.active);
    return s.startText?.active;
  }, key);
}
async function point(page, key, property, index) {
  return page.evaluate(({ key, property, index }) => {
    const s = window.cityApproachGame.scene.keys[key];
    const o = index === undefined ? s[property] : s[property][index];
    const canvas = s.game.canvas.getBoundingClientRect();
    const b = o.getBounds();
    const x = o.buttonWidth ? o.x + o.buttonWidth / 2 : b.centerX;
    const y = o.buttonHeight ? o.y + o.buttonHeight / 2 : b.centerY;
    return { x: canvas.x + x, y: canvas.y + y };
  }, { key, property, index });
}
async function tap(page, key, property, index, edge = false) {
  const p = await point(page, key, property, index);
  if (edge) {
    const size = await page.evaluate(({key, property, index}) => {
      const s = window.cityApproachGame.scene.keys[key];
      const b = index === undefined ? s[property] : s[property][index];
      return { width: b.buttonWidth, height: b.buttonHeight };
    }, {key, property, index});
    p.x += size.width / 2 - 6;
    p.y += size.height / 2 - 6;
  }
  await page.touchscreen.tap(p.x, p.y);
}
async function audit(page, key, propertyNames, buttons = []) {
  const result = await page.evaluate(({ key, propertyNames, buttons }) => {
    const s = window.cityApproachGame.scene.keys[key];
    const bounds = (o) => {
      if (o.buttonWidth) return { x: o.x, y: o.y, width: o.buttonWidth, height: o.buttonHeight };
      const b = o.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    const items = propertyNames.map((name) => ({ name, object: s[name] }))
      .concat(buttons.flatMap((name) => (Array.isArray(s[name]) ? s[name] : [s[name]])
        .map((object, index) => ({ name: `${name}[${index}]`, object, button: true }))));
    return { width: s.scale.width, height: s.scale.height,
      items: items.filter(({ object }) => object?.visible && object.text !== "")
        .map(({ object, ...item }) => ({ ...item, ...bounds(object) })) };
  }, { key, propertyNames, buttons });
  for (const b of result.items) {
    check(b.x >= -1 && b.y >= -1 && b.x + b.width <= result.width + 1 && b.y + b.height <= result.height + 1,
      `${key} ${b.name} outside ${result.width}x${result.height}: ${JSON.stringify(b)}`);
    if (b.button) check(b.width >= 44 && b.height >= 44, `${key} ${b.name} touch target too small`);
  }
  for (let i = 0; i < result.items.length; i++) for (let j = i + 1; j < result.items.length; j++) {
    const a = result.items[i], b = result.items[j];
    const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 2 &&
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 2;
    check(!overlap, `${key} overlap: ${a.name} / ${b.name}`);
  }
}
async function shot(page, name) {
  // WebKit can expose the cleared canvas for one frame immediately after a resize.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await page.screenshot({ path: `${output}/${name}.png` });
}

async function replyWhileWalking(page, name, choice = 0) {
  await page.waitForFunction(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    return e.finished || e.dialogState === "asking";
  });
  if (await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.finished)) return;
  const index = await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.currentQuestion.index);
  await audit(page, "EscortScene", ["hud", "dialogSpeaker", "dialogText"], ["replyButtons"]);
  if (index === 0 || index === 3) await shot(page, `${name}-walk-question-${index + 1}`);
  await tap(page, "EscortScene", "replyButtons", choice, index === 0);
  await page.waitForFunction((index) => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    return e.finished || !e.currentQuestion || e.currentQuestion.index !== index;
  }, index);
}

const engines = (process.env.MOBILE_BROWSERS || "chromium,webkit").split(",");
try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      for (const size of sizes.filter((size) => !process.env.MOBILE_SIZE || size.name === process.env.MOBILE_SIZE)) {
        const name = `${engine}-${size.name}`;
        const context = await browser.newContext({ viewport: { width: size.width, height: size.height },
          deviceScaleFactor: 2, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); if (process.env.MOBILE_DEBUG) console.error(m.text()); } });
        const started = Date.now();
        try {
          await page.goto(server.url, { waitUntil: "networkidle" });
          await state(page, "TitleScene");
          if (size.safe) {
            await page.evaluate((safe) => {
              const host = document.getElementById("game");
              ["top", "right", "bottom", "left"].forEach((edge, i) => host.style.setProperty(`--safe-${edge}`, `${safe[i]}px`));
            }, size.safe);
            await page.waitForFunction(() => {
              const g = window.cityApproachGame;
              return g.scale.width === document.getElementById("game").clientWidth && g.scale.height === document.getElementById("game").clientHeight;
            });
          }
          await audit(page, "TitleScene", ["iconImage", "titleText", "subText", "tutorialText", "bestText", "diffText", "startText"]);
          await shot(page, `${name}-title`);
          const beforeDiff = await page.evaluate(() => window.cityApproachGame.scene.keys.TitleScene.difficulty.key);
          await tap(page, "TitleScene", "diffButton");
          check(await page.evaluate(() => window.cityApproachGame.scene.isActive("TitleScene")), "difficulty tap started game");
          check(beforeDiff !== await page.evaluate(() => window.cityApproachGame.scene.keys.TitleScene.difficulty.key), "difficulty tap ignored");
          await tap(page, "TitleScene", "startText");
          await state(page, "MainScene");
          await page.waitForTimeout(150);
          await audit(page, "MainScene", ["infoText", "hintText"], ["mapButton", "difficultyButton", "actionButtons"]);
          await shot(page, `${name}-field`);
          // Reusing the same touch pointer after a HUD tap used to block movement.
          await tap(page, "MainScene", "difficultyButton");
          const field = await page.evaluate(() => {
            const s = window.cityApproachGame.scene.keys.MainScene;
            const r = s.game.canvas.getBoundingClientRect();
            return { x: s.player.x, y: s.player.y, tapX: r.x + 50, tapY: r.y + Math.min(220, s.scale.height / 2) };
          });
          await page.touchscreen.tap(field.tapX, field.tapY);
          await page.waitForFunction((before) => {
            const s = window.cityApproachGame.scene.keys.MainScene;
            return Math.hypot(s.player.x - before.x, s.player.y - before.y) > 5;
          }, field);
          checks += 1;
          const cdp = engine === "chromium" ? await context.newCDPSession(page) : null;
          if (cdp) {
            const p = await page.evaluate(() => {
              const s = window.cityApproachGame.scene.keys.MainScene, r = s.game.canvas.getBoundingClientRect();
              s.resetMovement();
              return { x: r.x + 70, y: r.y + s.scale.height - 82 };
            });
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, ...p }] });
            await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: p.x + 40, y: p.y }] });
            check(await page.evaluate(() => window.cityApproachGame.scene.keys.MainScene.joystickVector.x > 0.5), "native drag did not engage joystick");
            await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
            check(await page.evaluate(() => window.cityApproachGame.scene.keys.MainScene.joystickVector.length() === 0), "cancel left joystick moving");
          }
          // Deterministic encounter fixture; all subsequent choices use real touch input.
          await page.evaluate(() => {
            const g = window.cityApproachGame, s = g.scene.keys.MainScene;
            s.resetMovement();
            g.registry.set("testOriginalRate", s.calculateSuccessRate);
            s.calculateSuccessRate = () => 1;
            const n = s.npcs[0];
            s.npcs.slice(1).forEach((other) => { other.disabled = true; });
            n.disabled = false;
            n.profile = { type: "待ち合わせ系", styleLabel: n.profile.styleLabel, traits: ["目が合う", "待ち合わせ"], interest: 80,
              flags: ["waiting"], situation: { label: "待ち合わせ", room: 3, caution: 0, hook: "スマホ", actions: {} } };
            n.sprite.setPosition(380, 640);
            s.player.setPosition(330, 640);
            s.updateNearestNpc();
          });
          await tap(page, "MainScene", "actionButtons", 0);
          await state(page, "TalkScene");
          await page.evaluate(() => {
            const g = window.cityApproachGame;
            g.scene.keys.MainScene.calculateSuccessRate = g.registry.get("testOriginalRate");
          });
          await audit(page, "TalkScene", ["topicText", "lineText", "feedbackText"], ["choiceButtons"]);
          await shot(page, `${name}-talk`);
          await page.setViewportSize({ width: size.height, height: size.width });
          await page.waitForFunction(() => window.cityApproachGame.scale.width === document.getElementById("game").clientWidth);
          await audit(page, "TalkScene", ["topicText", "lineText", "feedbackText"], ["choiceButtons"]);
          await shot(page, `${name}-talk-rotated`);
          await page.setViewportSize({ width: size.width, height: size.height });
          await page.waitForFunction(() => window.cityApproachGame.scale.width === document.getElementById("game").clientWidth);
          for (let turn = 0; turn < 8; turn++) {
            const decision = await page.evaluate(() => {
              const t = window.cityApproachGame.scene.keys.TalkScene;
              if (t.resultShown) return { done: true };
              const l = t.lines[t.lineIndex];
              const key = !l.weak ? "listen" : l.correct.includes("proposal") && t.favor >= 68 && t.discomfort < 60 ? "proposal" : l.correct[0];
              return { index: ["listen", "empathy", "tsukkomi", "proposal"].indexOf(key), line: t.lineIndex };
            });
            if (decision.done) break;
            await tap(page, "TalkScene", "choiceButtons", decision.index, turn === 0);
            if (turn === 0) {
              await audit(page, "TalkScene", ["topicText", "lineText", "feedbackText"], ["choiceButtons"]);
              await shot(page, `${name}-talk-feedback`);
            }
            await page.waitForFunction((line) => {
              const t = window.cityApproachGame.scene.keys.TalkScene;
              return t.resultShown || t.lineIndex > line;
            }, decision.line);
          }
          check(await page.evaluate(() => window.cityApproachGame.scene.keys.TalkScene.resultBonus === 120), "touch conversation did not succeed");
          await audit(page, "TalkScene", ["topicText", "lineText", "feedbackText", "resultScoreText"], ["resultButton"]);
          await shot(page, `${name}-talk-result`);
          await tap(page, "TalkScene", "resultButton");
          await state(page, "EscortScene");
          await audit(page, "EscortScene", ["hud", "caption"], ["leftButton", "rightButton"]);
          await shot(page, `${name}-escort`);
          if (cdp) {
            const left = await point(page, "EscortScene", "leftButton"), right = await point(page, "EscortScene", "rightButton");
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, ...left }] });
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, ...left }, { id: 2, ...right }] });
            check(await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.direction === 1), "second finger not steering right");
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ id: 2, ...right }] });
            check(await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.direction === -1), "remaining finger not restored");
            await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
            check(await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.direction === 0), "cancel did not release escort controls");
          }
          const fullWalk = engine === "chromium" && size.name === "notch-portrait";
          if (!fullWalk) await page.evaluate(() => {
            const e = window.cityApproachGame.scene.keys.EscortScene;
            e.player.x = 2750; e.partner.x = 2682;
            e.cameras.main.centerOn(e.player.x, e.groundY);
          });
          const beforeGoal = await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.score);
          for (let segment = 0; segment < 12; segment++) {
            if (await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.finished)) break;
            if (await page.evaluate(() => Boolean(window.cityApproachGame.scene.keys.EscortScene.currentQuestion))) {
              await replyWhileWalking(page, name);
              continue;
            }
            if (cdp) {
              const right = await point(page, "EscortScene", "rightButton");
              await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 3, ...right }] });
              await page.waitForFunction(() => {
                const e = window.cityApproachGame.scene.keys.EscortScene;
                return e.finished || e.currentQuestion;
              }, null, { timeout: 60000 });
              await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            } else {
              const dest = await page.evaluate(() => {
                const e = window.cityApproachGame.scene.keys.EscortScene, r = e.game.canvas.getBoundingClientRect();
                return { x: r.x + e.scale.width - 3, y: r.y + e.groundY - 20 };
              });
              await page.touchscreen.tap(dest.x, dest.y);
              await page.waitForFunction(() => {
                const e = window.cityApproachGame.scene.keys.EscortScene;
                return e.finished || e.currentQuestion || e.tapX === null;
              });
            }
            if (await page.evaluate(() => Boolean(window.cityApproachGame.scene.keys.EscortScene.currentQuestion))) await replyWhileWalking(page, name);
          }
          check(await page.evaluate(() => {
            const e = window.cityApproachGame.scene.keys.EscortScene;
            return e.finished && e.outcome === "goal" && e.questionsAnswered === 4 && e.destinationConfirmed;
          }), "walking conversation did not reach confirmed goal");
          check(await page.evaluate((score) => window.cityApproachGame.scene.keys.EscortScene.score === score + 100, beforeGoal), "goal bonus incorrect");
          await audit(page, "EscortScene", ["finishText"], ["returnButton"]);
          await shot(page, `${name}-goal`);
          // Rotate while the goal screen is open; its action must stay reachable.
          await page.setViewportSize({ width: size.height, height: size.width });
          await page.waitForFunction(() => window.cityApproachGame.scale.width === document.getElementById("game").clientWidth);
          await audit(page, "EscortScene", ["finishText"], ["returnButton"]);
          await tap(page, "EscortScene", "returnButton");
          await state(page, "MainScene");
          await page.waitForTimeout(150);
          check(await page.evaluate(() => window.cityApproachGame.scene.keys.MainScene.history.includes("HOTEL GOAL")), "goal history lost");
          check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), "document scroll overflow");
          await page.evaluate(() => {
            const g = window.cityApproachGame;
            g.scene.keys.MainScene.scene.start("EscortScene", { ...g.scene.keys.EscortScene.runData, score: 200, streak: 3 });
          });
          await state(page, "EscortScene");
          await page.evaluate(() => {
            const e = window.cityApproachGame.scene.keys.EscortScene;
            e.player.x = 2750; e.partner.x = 2682;
          });
          for (let reply = 0; reply < 3; reply++) await replyWhileWalking(page, `${name}-evade`, 1);
          check(await page.evaluate(() => {
            const e = window.cityApproachGame.scene.keys.EscortScene;
            return e.finished && e.outcome === "breakdown" && e.doubt === 100 && e.score === 200;
          }), "repeated evasion did not break escort without reward");
          await audit(page, "EscortScene", ["finishText"], ["returnButton"]);
          await shot(page, `${name}-breakdown`);
          await tap(page, "EscortScene", "returnButton");
          await state(page, "MainScene");
          const breakdownReturn = await page.evaluate(() => {
            const m = window.cityApproachGame.scene.keys.MainScene;
            return { score: m.score, streak: m.streak, companion: Boolean(m.companion), history: m.history };
          });
          check(breakdownReturn.score === 200 && breakdownReturn.streak === 0 && !breakdownReturn.companion && breakdownReturn.history.includes("同行終了"),
            `breakdown did not return to city cleanly: ${JSON.stringify(breakdownReturn)}`);
          check(errors.length === 0, `browser errors: ${errors.join("; ")}`);
          report.push({ name, status: "PASS", seconds: ((Date.now() - started) / 1000).toFixed(1), fullWalk });
          console.log(`PASS ${name}${fullWalk ? " (full route, real held touch)" : ""}`);
        } catch (error) {
          await shot(page, `${name}-failure`).catch(() => {});
          report.push({ name, status: "FAIL", error: error.stack, seconds: ((Date.now() - started) / 1000).toFixed(1) });
          console.error(`FAIL ${name}: ${error.stack}`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} catch (error) {
  report.push({ name: "browser setup", status: "FAIL", error: error.stack });
  console.error(error.message);
} finally {
  await server.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, report }, null, 2));
  await writeFile(`${output}/report.md`, `# Mobile Playwright results\n\n${checks} assertions passed.\n\n` +
    report.map((r) => `- ${r.status} ${r.name}${r.seconds ? ` (${r.seconds}s)` : ""}${r.fullWalk ? " — full route using native held touch" : ""}${r.error ? `\n\n\`\`\`\n${r.error}\n\`\`\`` : ""}`).join("\n") +
    "\n\nScreenshots are saved beside this report. These are browser-emulation tests, not physical-device tests. Notch insets are simulated with CSS overrides. Non-full-route cases use a near-goal position fixture. Native multi-touch and cancellation are tested in Chromium; WebKit uses touchscreen taps. Both success with four walking replies and failure after three consecutive evasions are tested through touch input.\n");
}
if (report.some((r) => r.status === "FAIL")) process.exitCode = 1;
else console.log(`All ${report.length} mobile cases passed (${checks} assertions).`);
