// Regression smoke test. Run with:
//   python -m http.server 8000 --bind 127.0.0.1  (separate shell)
//   node smoke.mjs
// Exit code 0 on pass, 1 on any failure.

import { chromium } from "playwright";
import { startTestServer } from "./tests/helpers.mjs";

const server = await startTestServer();
const URL = server.url;
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
  check("four scenes registered",
    title.keys?.includes("TitleScene") && title.keys.includes("MainScene") && title.keys.includes("TalkScene") && title.keys.includes("EscortScene"),
    `keys=${title.keys?.join(",")}`);
  check("title scene active on load", title.active === "TitleScene", `active=${title.active}`);
  check("title text set", title.titleText === "CITY APPROACH");
  check("best shown", (title.bestText || "").startsWith("Best "));
  check("difficulty label loaded", Boolean(title.diffLabel));

  // Start the game
  await page.mouse.click(640, 780);
  await page.waitForFunction(() => window.cityApproachGame?.scene?.keys?.MainScene?.actionButtons, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  const main = await page.evaluate(() => {
    const g = window.cityApproachGame;
    const m = g.scene.keys.MainScene;
    return {
      active: g.scene.scenes.find((s) => s.sys.isActive())?.scene.key,
      buttonLabels: m.actionButtons.map((b) => b.list.find((c) => c.text)?.text),
      hasSkipFn: typeof m.respectfullySkip === "function",
      npcCount: m.npcs?.length ?? 0,
      hasStyleLabels: m.npcs?.every((n) => typeof n.profile.styleLabel === "string" && n.profile.styleLabel.length > 0),
      historyIsArray: Array.isArray(m.history),
      hasIcons: m.npcs?.every((n) => n.icons?.type === "Graphics"),
      diffMult: m.difficulty?.mult,
      hintText: m.hintText?.text,
      spriteMode: m.spriteMode,
      fieldFxReady:
        typeof m.showConnectionBurst === "function" &&
        typeof m.showRespectCue === "function" &&
        typeof m.showClearOverlay === "function" &&
        typeof m.showBestUpdate === "function" &&
        typeof m.showRankSOverlay === "function",
    };
  });
  check("transitioned to MainScene", main.active === "MainScene");
  check("five action buttons", main.buttonLabels?.length === 5,
    `labels=${main.buttonLabels?.join(",")}`);
  check("empathy opener present", main.buttonLabels?.includes("共感する"));
  check("situation opener present", main.buttonLabels?.includes("状況いじり"));
  check("item opener present", main.buttonLabels?.includes("持ち物に触れる"));
  check("humor opener present", main.buttonLabels?.includes("ユーモア賭け"));
  check("skip button present", main.buttonLabels?.includes("離れる"));
  check("respectfullySkip defined", main.hasSkipFn);
  check("NPCs spawned", main.npcCount > 0);
  check("NPC identities have style labels", main.hasStyleLabels);
  check("history initialised", main.historyIsArray);
  check("pixel icon Graphics attached", main.hasIcons);
  check("difficulty multiplier loaded", typeof main.diffMult === "number");
  check("AI character mode is default", main.spriteMode === "icon", `mode=${main.spriteMode}`);
  check("action hint shown", typeof main.hintText === "string" && main.hintText.length > 0);
  check("field effects available", main.fieldFxReady);

  const beforeMove = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    return { x: m.player.x, y: m.player.y };
  });
  await page.mouse.move(90, 710);
  await page.mouse.down();
  await page.mouse.move(190, 710, { steps: 6 });
  await page.waitForTimeout(420);
  await page.mouse.up();
  const afterMove = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    return { x: m.player.x, y: m.player.y, stick: m.joystickVector.length() };
  });
  check("drag movement works", afterMove.x > beforeMove.x + 12,
    `before=${Math.round(beforeMove.x)}, after=${Math.round(afterMove.x)}`);
  check("joystick releases after drag", afterMove.stick === 0, `stick=${afterMove.stick}`);

  const beforeTap = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    m.player.setPosition(380, 640);
    m.tapTarget = null;
    return { x: m.player.x, y: m.player.y };
  });
  await page.mouse.click(210, 430);
  // Wait for observable movement, rather than assuming a headless render speed.
  await page.waitForFunction(({ x, y }) => {
    const p = window.cityApproachGame.scene.keys.MainScene.player;
    return Math.abs(p.x - x) > 8 || Math.abs(p.y - y) > 8;
  }, beforeTap, { timeout: 5000 });
  const afterTap = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    return {
      x: m.player.x,
      y: m.player.y,
      target: Boolean(m.tapTarget),
      message: m.messageText?.text || "",
    };
  });
  check("field tap sets move target", afterTap.target, JSON.stringify(afterTap));
  check("field tap moves player", Math.abs(afterTap.x - beforeTap.x) > 8 || Math.abs(afterTap.y - beforeTap.y) > 8,
    `before=${JSON.stringify(beforeTap)} after=${JSON.stringify(afterTap)}`);

  const noShortcut = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    m.score = 500;
    m.player.setPosition(585, 1088);
    m.updateHotelState();
    return !m.hotelEntered;
  });
  check("field score alone does not complete hotel goal", noShortcut);

  const anims = await page.evaluate(() => {
    const g = window.cityApproachGame;
    const m = g.scene.keys.MainScene;
    const firstNpcKey = m.npcs[0]?.sprite.texture.key.replace(/-[01]$/, "");
    return {
      textures: ["player-0", "player-1", `${firstNpcKey}-0`, `${firstNpcKey}-1`].filter((k) => g.textures.exists(k)),
      playerAnim: m.anims.exists("player-walk"),
      npcAnim: m.anims.exists(`${firstNpcKey}-walk`),
      playerTex: m.player.texture.key,
      npcAnimating: m.npcs[0]?.sprite.anims.isPlaying,
    };
  });
  check("player and NPC character textures registered", anims.textures.length === 4, anims.textures.join(","));
  check("player-walk animation exists", anims.playerAnim);
  check("NPC walk animation exists", anims.npcAnim);
  check("player uses walk texture", ["player-0", "player-1"].includes(anims.playerTex), `texture=${anims.playerTex}`);
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
      choiceLabels: t.choiceButtons.map((b) => b.list.find((c) => c.text !== undefined)?.text),
      linesCount: t?.lines?.length ?? 0,
      allHaveCue: (t?.lines || []).every((l) => typeof l.cue === "string" && l.cue.length > 0),
      hasAnyWeak: (t?.lines || []).some((l) => l.weak === true),
      resultScoreTextExists: Boolean(t?.resultScoreText),
      talkFxReady: typeof t?.pulseFeedback === "function" && typeof t?.drawResultPanel === "function",
    };
  });
  check("four concrete reply flips", talk.choiceLabels.length === 4 && talk.choiceLabels.every(label => label.length > 6));
  check("TalkScene produced at least 3 lines", talk.linesCount >= 3, `got ${talk.linesCount}`);
  check("every line has a cue", talk.allHaveCue);
  check("at least one weak line exists", talk.hasAnyWeak);
  check("TalkScene result score text exists", talk.resultScoreTextExists);
  check("TalkScene effects available", talk.talkFxReady);

  const flipChecks = await page.evaluate(() => {
    const t = window.cityApproachGame.scene.keys.TalkScene;
    const lines = t.buildLines(t.profile, "kabukicho");
    const validHands = lines.length === 5 && lines.every(l => l.cards.length === 4 && l.correct.length === 1 && l.cards.some(c => c.key === l.correct[0]));
    const uniqueConcerns = new Set(lines.slice(0, 4).map(l => l.concern)).size === 4;
    const reset = (line, resolved = []) => {
      t.time.removeAllEvents(); t.lines = [line]; t.lineIndex = 0; t.choiceLocked = false; t.resultShown = false;
      t.favor = 85; t.discomfort = 20; t.responseChain = 0; t.invitationAccepted = false; t.resolvedConcerns = new Set(resolved);
    };
    const concern = lines[0];
    const wrongListen = { ...concern, correct: ["empathy"] };
    reset(wrongListen); t.choose("listen");
    const wrongCardCostsTrust = t.favor === 80 && t.discomfort === 20 + t.encounter.mistake && t.resolvedConcerns.size === 0;
    reset({ ...concern, correct: ["proposal"] }); t.choose("proposal");
    const noEarlyInvite = !t.resultShown && !t.invitationAccepted && t.resolvedConcerns.size === 1;
    reset(lines.at(-1), ["safety", "time"]); t.choose("proposal");
    const unresolvedBlocksInvite = !t.invitationAccepted;
    reset(lines.at(-1), ["safety", "time", "friend"]); t.choose("proposal");
    const earnedInvite = t.invitationAccepted && t.resultBonus === 120;
    t.time.removeAllEvents();
    return { validHands, uniqueConcerns, wrongCardCostsTrust, noEarlyInvite, unresolvedBlocksInvite, earnedInvite };
  });
  for (const [name, passed] of Object.entries(flipChecks)) check(`reply flips: ${name}`, passed);

  const decisions = await page.evaluate(() => {
    const t = window.cityApproachGame.scene.keys.TalkScene;
    const reset = (line, favor = 50, discomfort = 20) => {
      t.time.removeAllEvents();
      t.lines = [line];
      t.lineIndex = 0;
      t.favor = favor;
      t.discomfort = discomfort;
      t.choiceLocked = false;
      t.resultShown = false;
      t.invitationAccepted = false;
      t.responseChain = 0;
      t.bestResponseChain = 0;
    };
    const observe = { text: "今ちょっと手短になら", weak: false, correct: [], cue: "時間制約" };
    const reply = { text: "時間あるし", weak: true, correct: ["empathy"], cue: "余白" };
    const invite = { text: "このあとどうしよう", weak: true, correct: ["proposal"], cue: "次の予定" };
    reset(observe);
    t.choose("listen");
    const listeningBuildsTrust = t.favor === 60 && t.discomfort === 14;
    t.choose("listen");
    const doubleTapIgnored = t.favor === 60;
    reset(reply);
    t.choose("empathy");
    t.choiceLocked = false;
    t.choose("empathy");
    const chainBonus = t.favor === 93 && t.responseChain === 2;
    t.choiceLocked = false;
    t.choose("empathy");
    const noAutomaticWin = t.favor === 100 && !t.resultShown;
    reset(reply);
    t.choose("listen");
    const recovery = t.favor === 50 && t.discomfort === 16;
    reset(invite, 67);
    t.choose("proposal");
    const earlyProposalDoesNotWin = !t.resultShown;
    reset(invite, 80, 60);
    t.choose("proposal");
    const highDiscomfortBlocksProposal = !t.resultShown;
    reset(invite, 68, 59);
    t.choose("proposal");
    const contextualProposalWins = t.resultShown && t.resultBonus === 120;
    reset(reply, 50, 95);
    t.timeoutLine();
    const timeoutEndsFailure = t.resultShown && t.resultBonus === 0;
    const profiles = [[], ["スマホ"], ["イヤホン", "スマホ", "目が合う", "友達といる", "歩くの速い", "観光中"]];
    const closingGuaranteed = profiles.every((traits) => ["nagoya", "kabukicho"].every((map) => {
      const lines = t.buildLines({ traits }, map);
      return lines.length <= 6 && lines.at(-1).correct.includes("proposal") && lines.filter((l) => l.weak).length >= 2;
    }));
    t.time.removeAllEvents();
    return { listeningBuildsTrust, doubleTapIgnored, chainBonus, noAutomaticWin, recovery,
      earlyProposalDoesNotWin, highDiscomfortBlocksProposal, contextualProposalWins,
      timeoutEndsFailure, closingGuaranteed };
  });
  for (const [name, passed] of Object.entries(decisions)) check(`conversation: ${name}`, passed);

  // Exercise the real result button path, including run data transfer.
  await page.evaluate(() => {
    const t = window.cityApproachGame.scene.keys.TalkScene;
    t.time.removeAllEvents();
    t.favor = 80;
    t.discomfort = 10;
    t.showFinal(true);
    t.returnToField();
  });
  await page.waitForFunction(() => window.cityApproachGame.scene.isActive("EscortScene"));
  const escort = await page.evaluate(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    return { partner: e.partner.active, score: e.score, finished: e.finished,
      atlas: e.textures.exists("character-atlas-v4"),
      cellWidth: e.textures.get("character-atlas-v4").getSourceImage().width / 4,
      sourceWidth: e.textures.get("ai_player_raw").getSourceImage().width };
  });
  check("successful conversation starts escort", escort.partner && !escort.finished);
  check("generated atlas supplies character portraits", escort.atlas && escort.sourceWidth > 0 && escort.sourceWidth === escort.cellWidth);
  const walkDialogue = await page.evaluate(async () => {
    const g = window.cityApproachGame;
    const e = g.scene.keys.EscortScene;
    const score = e.score;
    e.finish();
    const unansweredCannotWin = !e.finished;
    e.beginConversation();
    const firstQuestion = e.dialogText.text.includes("どこ行くんですか");
    const x = e.player.x;
    e.direction = 1;
    e.update(e.time.now, 50);
    const stopsForReply = e.player.x === x;
    const loveHotelExplained = e.currentQuestion.playerLines.explain.includes("ラブホテル");
    const loveHotelSign = e.decorations.list.some(item => item.text === "LOVE HOTEL");
    e.chooseWalkReply("evade");
    const firstEvade = e.doubt === 20 && !e.finished;
    e.chooseWalkReply("evade");
    const doubleTapIgnored = e.doubt === 20 && e.totalEvasions === 1;
    e.closeConversation();
    e.beginConversation();
    e.chooseWalkReply("evade");
    const escalating = e.doubt === 55;
    e.closeConversation();
    e.beginConversation();
    e.chooseWalkReply("evade");
    const breaksAfterThree = e.finished && e.outcome === "breakdown" && e.score === score;
    e.finish();
    const noGoalAfterFailure = e.score === score;
    const data = e.runData;
    e.scene.restart(data);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const fresh = g.scene.keys.EscortScene;
    fresh.beginConversation();
    fresh.chooseWalkReply("evade");
    fresh.closeConversation();
    fresh.beginConversation();
    fresh.chooseWalkReply("explain");
    const repairWorks = fresh.doubt === 0 && fresh.evasionStreak === 0;
    fresh.closeConversation();
    fresh.beginConversation();
    fresh.chooseWalkReply("explain");
    fresh.closeConversation();
    fresh.beginConversation();
    fresh.chooseWalkReply("evade");
    const finalNotBypassed = !fresh.destinationConfirmed && fresh.questionsAnswered === 3;
    fresh.closeConversation();
    fresh.beginConversation();
    fresh.chooseWalkReply("explain");
    fresh.closeConversation();
    return { unansweredCannotWin, firstQuestion, stopsForReply, loveHotelExplained, loveHotelSign, firstEvade, doubleTapIgnored,
      escalating, breaksAfterThree, noGoalAfterFailure, repairWorks, finalNotBypassed,
      consentConfirmed: fresh.destinationConfirmed && fresh.questionsAnswered === 4 };
  });
  for (const [name, passed] of Object.entries(walkDialogue)) check(`walk dialogue: ${name}`, passed);

  const startX = await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.player.x);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction((x) => window.cityApproachGame.scene.keys.EscortScene.player.x > x + 110, startX);
  await page.keyboard.up("ArrowRight");
  const walked = await page.evaluate(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    return { x: e.player.x, companionX: e.partner.x };
  });
  check("escort keyboard moves right", walked.x > startX + 100);
  check("escort partner follows", walked.companionX > startX - 40 && walked.companionX < walked.x);
  await page.evaluate(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    e.player.x = 1500;
    e.partner.x = 1432;
  });
  await page.waitForTimeout(500);
  check("escort camera scrolls horizontally", await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.cameras.main.scrollX > 100));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const beforeTouch = await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.player.x);
  await page.mouse.move(325, 782);
  await page.mouse.down();
  await page.waitForFunction((x) => window.cityApproachGame.scene.keys.EscortScene.player.x > x + 50, beforeTouch);
  await page.mouse.up();
  const touch = await page.evaluate(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    return { x: e.player.x, direction: e.direction, ground: e.groundY };
  });
  check("mobile right button moves and releases", touch.x > beforeTouch + 40 && touch.direction === 0);
  check("escort resizes to mobile ground", touch.ground === Math.round(844 * 0.69));
  const tapStart = await page.evaluate(() => window.cityApproachGame.scene.keys.EscortScene.player.x);
  await page.mouse.click(365, 400);
  await page.waitForFunction((x) => Math.abs(window.cityApproachGame.scene.keys.EscortScene.player.x - x) > 5, tapStart);
  check("escort field tap moves", true);
  const goal = await page.evaluate(() => {
    const e = window.cityApproachGame.scene.keys.EscortScene;
    e.releaseAll();
    const before = e.score;
    e.player.x = 2890;
    e.partner.x = 2822;
    e.update(e.time.now, 16);
    e.finish();
    return { finished: e.finished, bonus: e.score - before, button: e.returnButton.visible,
      best: Number(localStorage.getItem("city_approach_best")) >= e.score };
  });
  check("hotel goal awards bonus exactly once", goal.finished && goal.bonus === 100 && goal.button);
  check("hotel goal saves best", goal.best);
  const returnPoint = await page.evaluate(() => {
    const b = window.cityApproachGame.scene.keys.EscortScene.returnButton;
    return { x: b.x, y: b.y };
  });
  await page.mouse.click(returnPoint.x, returnPoint.y);
  await page.waitForFunction(() => window.cityApproachGame.scene.isActive("MainScene"));
  const returned = await page.evaluate(() => {
    const m = window.cityApproachGame.scene.keys.MainScene;
    return m.companion === null && m.history.includes("HOTEL GOAL");
  });
  check("goal returns to city with history", returned);

  await browser.close();
  await server.close();

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
