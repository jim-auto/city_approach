// Regression smoke test. Run with:
//   python -m http.server 8000 --bind 127.0.0.1  (separate shell)
//   node smoke.mjs
// Exit code 0 on pass, 1 on any failure.

import { chromium } from "playwright";

const URL = process.env.SMOKE_URL || "http://127.0.0.1:8000/";
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    console.log(`FAIL pageerror — ${e.message}`);
    failures.push("pageerror");
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      console.log(`FAIL console — ${m.text()}`);
      failures.push("console-error");
    }
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const title = await page.evaluate(() => {
    const g = window.cityApproachGame;
    if (!g) return { ok: false };
    const keys = Object.keys(g.scene.keys);
    const active = g.scene.scenes.find((s) => s.sys.isActive())?.scene.key;
    const t = g.scene.getScene("TitleScene");
    return {
      ok: true,
      keys,
      active,
      titleText: t?.titleText?.text,
      bestText: t?.bestText?.text,
      diffLabel: t?.difficulty?.label,
    };
  });
  check("game instance exists", title.ok);
  check("three scenes registered",
    title.keys?.includes("TitleScene") && title.keys.includes("MainScene") && title.keys.includes("TalkScene"),
    `keys=${title.keys?.join(",")}`);
  check("title scene active on load", title.active === "TitleScene", `active=${title.active}`);
  check("title text set", title.titleText === "CITY APPROACH");
  check("best shown", (title.bestText || "").startsWith("Best "));
  check("difficulty label loaded", Boolean(title.diffLabel));

  // Start the game
  await page.mouse.click(640, 780);
  await page.waitForTimeout(700);

  const main = await page.evaluate(() => {
    const g = window.cityApproachGame;
    const m = g.scene.keys.MainScene;
    return {
      active: g.scene.scenes.find((s) => s.sys.isActive())?.scene.key,
      buttonLabels: m.actionButtons.map((b) => b.list.find((c) => c.text)?.text),
      hasSkipFn: typeof m.respectfullySkip === "function",
      npcCount: m.npcs?.length ?? 0,
      historyIsArray: Array.isArray(m.history),
      hasIcons: m.npcs?.every((n) => n.icons?.type === "Graphics"),
      diffMult: m.difficulty?.mult,
    };
  });
  check("transitioned to MainScene", main.active === "MainScene");
  check("five action buttons", main.buttonLabels?.length === 5,
    `labels=${main.buttonLabels?.join(",")}`);
  check("weather opener present", main.buttonLabels?.includes("お天気op"));
  check("outfit opener present", main.buttonLabels?.includes("服装op"));
  check("item opener present", main.buttonLabels?.includes("小物op"));
  check("joke opener present", main.buttonLabels?.includes("ネタop"));
  check("skip button present", main.buttonLabels?.includes("離れる"));
  check("respectfullySkip defined", main.hasSkipFn);
  check("NPCs spawned", main.npcCount > 0);
  check("history initialised", main.historyIsArray);
  check("pixel icon Graphics attached", main.hasIcons);
  check("difficulty multiplier loaded", typeof main.diffMult === "number");

  const anims = await page.evaluate(() => {
    const g = window.cityApproachGame;
    const m = g.scene.keys.MainScene;
    return {
      textures: ["player-0", "player-1", "npc-0", "npc-1"].filter((k) => g.textures.exists(k)),
      playerAnim: m.anims.exists("player-walk"),
      npcAnim: m.anims.exists("npc-walk"),
      playerTex: m.player.texture.key,
      npcAnimating: m.npcs[0]?.sprite.anims.isPlaying,
    };
  });
  check("four character textures registered", anims.textures.length === 4, anims.textures.join(","));
  check("player-walk animation exists", anims.playerAnim);
  check("npc-walk animation exists", anims.npcAnim);
  check("player initial texture is player-0", anims.playerTex === "player-0");
  check("NPCs playing npc-walk", anims.npcAnimating);

  // Exercise the skip path
  const skip = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    const target = m.npcs.find((n) => !n.disabled);
    m.player.x = target.sprite.x;
    m.player.y = target.sprite.y;
    m.updateNearestNpc();
    const before = m.score;
    m.respectfullySkip();
    return {
      ok: true,
      scored: m.score >= before,
      disabled: target.disabled,
      historyGrew: m.history.length >= 1,
    };
  });
  check("skip awards non-negative score", skip.scored);
  check("skipped NPC disabled", skip.disabled);
  check("history gets entry after skip", skip.historyGrew);

  // Start a talk scene directly to verify dialogue pool
  const talk = await page.evaluate(async () => {
    const g = window.cityApproachGame;
    const main = g.scene.keys.MainScene;
    const target = main.npcs.find((n) => !n.disabled) || main.npcs[0];
    g.scene.start("TalkScene", {
      profile: target.profile,
      mapKey: "nagoya",
      difficulty: "normal",
      history: [],
    });
    await new Promise((r) => setTimeout(r, 900));
    const t = g.scene.getScene("TalkScene");
    return {
      linesCount: t?.lines?.length ?? 0,
      allHaveCue: (t?.lines || []).every((l) => typeof l.cue === "string" && l.cue.length > 0),
      hasAnyWeak: (t?.lines || []).some((l) => l.weak === true),
    };
  });
  check("TalkScene produced at least 3 lines", talk.linesCount >= 3, `got ${talk.linesCount}`);
  check("every line has a cue", talk.allHaveCue);
  check("at least one weak line exists", talk.hasAnyWeak);

  await browser.close();

  if (failures.length) {
    console.log(`\n${failures.length} failure(s)`);
    process.exit(1);
  } else {
    console.log("\nall checks passed");
  }
})().catch((err) => {
  console.log(`FAIL smoke harness — ${err.message}`);
  process.exit(1);
});
