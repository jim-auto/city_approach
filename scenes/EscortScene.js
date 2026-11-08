import { aiSourceKeyFor } from "../characters.js?v=20261108-ending2";
import { createNativeButtons } from "../native-buttons.js?v=20261108-ending2";
import { drawCitySky, drawCityStreet } from "../scenery.js?v=20261108-ending2";
import { bindTouchReset } from "../mobile.js?v=20261108-ending2";
import { sfx } from "../sfx.js?v=20261108-ending2";
import { getBest, setBest } from "../storage.js?v=20261108-ending2";

const START_X = 150;
const HOTEL_X = 2900;
const WORLD_WIDTH = 3200;

const WALK_REPLIES = [
  { key: "explain", label: "行き先を話す" },
  { key: "evade", label: "まあまあまあ" },
  { key: "check", label: "やめる？と聞く" },
];
const WALK_QUESTIONS = [
  { x: 650, text: "どこ行くんですか？", explained: "ラブホテルなんだ。行くかは話してから決めたいな。",
    playerLines: { explain: "ラブホテルに行かない？嫌ならやめよう", evade: "まあまあまあ", check: "嫌ならここでやめようか？" } },
  { x: 1300, text: "まだ歩くんですか？", explained: "もう少しね。じゃあ、ゆっくり行こう。",
    playerLines: { explain: "あと少し。疲れたらここで休もう", evade: "まあまあまあ", check: "疲れた？ ここまでにする？" } },
  { x: 1950, text: "帰りの時間、大丈夫かな……", explained: "分かった。時間になったら帰るね。",
    playerLines: { explain: "帰る時間に合わせよう。無理ならやめよう", evade: "まあまあまあ", check: "無理せず、今日は帰る？" } },
  { x: 2630, text: "ここ、ラブホテルですよね？", final: true, explained: "うん、入ろう。気が変わったら帰るね。",
    playerLines: { explain: "そう。今から入る？嫌ならやめよう", evade: "まあまあまあ", check: "ここまでにする？無理はしなくていいよ" } },
];

// A separate, side-scrolling finale: the companion, not a score gate, unlocks it.
export default class EscortScene extends Phaser.Scene {
  constructor() { super("EscortScene"); }

  preload() {
    if (!this.textures.exists("goal-cg-backdrop")) {
      const loading = this.add.text(this.scale.width / 2, this.scale.height / 2, "ホテルへ向かっています…", {
        fontFamily: "system-ui, sans-serif", fontSize: "17px", color: "#ffdbbb",
      }).setOrigin(.5);
      this.load.image("goal-cg-backdrop", "assets/ai/goal-cg-backdrop.png");
      this.load.once("complete", () => loading.destroy());
    }
  }

  create(data = {}) {
    this.runData = data;
    this.mapKey = data.mapKey || "nagoya";
    this.score = data.score || 0;
    this.finished = false;
    this.outcome = null;
    this.goalTitle = null;
    this.goalArt = null;
    this.goalArtFrame = null;
    this.goalArtCompanionKey = null;
    this.goalConfetti = [];
    this.doubt = 0;
    this.evasionStreak = 0;
    this.totalEvasions = 0;
    this.nextQuestionIndex = 0;
    this.questionsAnswered = 0;
    this.destinationExplained = false;
    this.destinationConfirmed = false;
    this.currentQuestion = null;
    this.dialogState = null;
    this.direction = 0;
    this.heldPointer = null;
    this.heldDirections = new Map();
    this.tapX = null;
    this.checkpoint = 0;
    this.sky = this.add.graphics().setScrollFactor(0).setDepth(-10);
    this.street = this.add.graphics().setDepth(-5);
    this.decorations = this.add.container(0, 0);
    this.player = this.add.sprite(START_X, 0, "player-0").setOrigin(0.5, 1).setScale(2.6).setDepth(10);
    const texture = data.companion?.textureKey;
    this.partner = this.add.sprite(START_X - 68, 0,
      texture && this.textures.exists(texture) ? texture : "npc-waiting-0")
      .setOrigin(0.5, 1).setScale(2.5).setDepth(9);
    this.partnerBase = this.partner.texture.key.replace(/-[01]$/, "");
    this.hud = this.add.text(20, 22, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "18px", color: "#f5f1df", lineSpacing: 7,
    }).setScrollFactor(0).setDepth(40);
    this.hudBackdrop = this.add.graphics().setScrollFactor(0).setDepth(39);
    this.progress = this.add.graphics().setScrollFactor(0).setDepth(40);
    this.caption = this.add.text(0, 0, "二人でラブホテルへ。右へ進もう →", {
      fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#ffd24f", align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(40);
    this.leftButton = this.control("←", -1);
    this.rightButton = this.control("→", 1);
    this.createConversationUi();
    this.nativeButtons = createNativeButtons(this, this.replyButtons.map((object, index) => ({
      object, label: () => WALK_REPLIES[index].label,
      enabled: () => !this.finished && this.dialogState === "asking",
      activate: () => this.chooseWalkReply(WALK_REPLIES[index].key),
    })));
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("A,D");
    this.input.on("pointerdown", (pointer, objects) => {
      if (this.finished || this.currentQuestion || objects.length) return;
      this.tapX = Phaser.Math.Clamp(pointer.x + this.cameras.main.scrollX, START_X, HOTEL_X);
    });
    this.input.on("pointerup", (pointer) => this.release(pointer));
    this.input.on("pointerupoutside", (pointer) => this.release(pointer));
    bindTouchReset(this, this.releaseAll);
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.layout, this);
    });
    this.cameras.main.startFollow(this.player, true, 0.12, 1, -this.scale.width * 0.16, 0);
    this.layout();
    this.cameras.main.fadeIn(350, 8, 10, 18);
  }

  control(label, direction) {
    const button = this.add.text(0, 0, label, {
      fontFamily: "system-ui, sans-serif", fontSize: "34px", color: "#ffffff",
      backgroundColor: "#253b4e", padding: { left: 30, right: 30, top: 10, bottom: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(45).setInteractive();
    button.on("pointerdown", (pointer, _x, _y, event) => {
      event?.stopPropagation();
      if (this.finished || this.currentQuestion) return;
      this.heldPointer = pointer.id;
      this.heldDirections.set(pointer.id, direction);
      this.direction = direction;
      this.tapX = null;
    });
    return button;
  }

  release(pointer) {
    if (!this.heldDirections.delete(pointer.id)) return;
    const remaining = [...this.heldDirections.entries()].at(-1);
    this.heldPointer = remaining?.[0] ?? null;
    this.direction = remaining?.[1] ?? 0;
  }

  releaseAll() {
    this.direction = 0;
    this.heldPointer = null;
    this.heldDirections.clear();
    this.tapX = null;
  }

  label(x, y, text, color = "#c3d5e4", size = 18) {
    const label = this.add.text(x, y, text, {
      fontFamily: "system-ui, sans-serif", fontSize: `${size}px`, color, align: "center",
      stroke: "#10111b", strokeThickness: 4,
    }).setOrigin(0.5);
    this.decorations.add(label);
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.releaseAll();
    this.compact = w > h && h < 600;
    this.groundY = Math.round(this.compact ? h - 92 : h * 0.69);
    const spriteScale = Math.min(2.6, (h * 0.25) / 48);
    this.player.setScale(spriteScale);
    this.partner.setScale(spriteScale * 0.96);
    this.player.y = this.groundY;
    this.partner.y = this.groundY;
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, h);
    this.cameras.main.followOffset.set(-w * 0.16, 0);
    this.leftButton.setPosition(65, h - 48);
    this.rightButton.setPosition(w - 65, h - 48);
    this.hud.setPosition(16, 16).setFontSize(this.compact ? 14 : 17);
    this.caption.setPosition(w / 2, this.compact ? 98 : h - 124).setFontSize(this.compact ? 14 : 15).setWordWrapWidth(w - 40);
    this.hudBackdrop.clear().fillStyle(0x0b1526, 0.83).fillRoundedRect(8, 8, w - 16, this.compact ? 78 : 96, 9);
    this.decorations.removeAll(true);
    drawCityStreet(this, WORLD_WIDTH, HOTEL_X);
    this.drawSky();
    this.updateHud();
    this.layoutConversation();
    if (this.finished) this.layoutFinish();
  }

  drawSky() {
    drawCitySky(this);
  }

  updateHud() {
    const progress = Phaser.Math.Clamp((this.player.x - START_X) / (HOTEL_X - START_X), 0, 1);
    const distance = Math.max(0, Math.ceil((HOTEL_X - this.player.x) / 10));
    const hudText = `LOVE HOTEL WALK / ${this.mapKey === "kabukicho" ? "歌舞伎町" : "名古屋"}\nあと ${distance}m / 不信感 ${this.doubt}/100`;
    if (this.hud.text !== hudText) this.hud.setText(hudText);
    const w = this.scale.width - 40;
    this.progress.clear().fillStyle(0x354457).fillRect(20, this.compact ? 66 : 82, w, 5)
      .fillStyle(0x78e7d9).fillRect(20, this.compact ? 66 : 82, w * progress, 5)
      .fillStyle(0x354457).fillRect(20, this.compact ? 76 : 94, w, 4)
      .fillStyle(this.doubt >= 50 ? 0xff887b : 0xffcf83).fillRect(20, this.compact ? 76 : 94, w * this.doubt / 100, 4);
  }

  update(_time, delta) {
    const skyX = Math.round(this.cameras.main.scrollX);
    if (skyX !== this.lastSkyX) {
      this.drawSky();
      this.lastSkyX = skyX;
    }
    if (this.finished) return;
    if (this.currentQuestion) {
      this.player.anims.stop();
      this.partner.anims.stop();
      return;
    }
    const next = WALK_QUESTIONS[this.nextQuestionIndex];
    if (next && this.player.x >= next.x) {
      this.beginConversation();
      return;
    }
    let move = this.direction;
    if (this.cursors?.left.isDown || this.keys?.A.isDown) move = -1;
    else if (this.cursors?.right.isDown || this.keys?.D.isDown) move = 1;
    else if (!move && this.tapX !== null) {
      const distance = this.tapX - this.player.x;
      move = Math.abs(distance) > 5 ? Math.sign(distance) : 0;
      if (!move) this.tapX = null;
    }
    const dt = Math.min(delta, 50) / 1000;
    this.player.x = Phaser.Math.Clamp(this.player.x + move * 230 * dt, START_X, HOTEL_X);
    this.player.y = this.groundY + (move ? Math.sin(this.time.now / 95) * 2 : 0);
    if (move) { this.player.setFlipX(move < 0); this.player.play("player-walk", true); }
    else this.player.anims.stop();
    const target = Math.max(START_X - 68, this.player.x - 68);
    this.partner.x += (target - this.partner.x) * (1 - Math.exp(-8 * dt));
    const walking = Math.abs(target - this.partner.x) > 2;
    this.partner.y = this.groundY + (walking ? Math.sin(this.time.now / 105) * 2 : 0);
    if (walking) {
      this.partner.setFlipX(target < this.partner.x);
      if (this.anims.exists(`${this.partnerBase}-walk`)) this.partner.play(`${this.partnerBase}-walk`, true);
    } else this.partner.anims.stop();
    const checkpoint = Math.min(3, Math.floor((this.player.x - START_X) / 800));
    if (checkpoint > this.checkpoint) {
      this.checkpoint = checkpoint;
      this.caption.setText(["", "少し歩くと、街の景色が変わってきた。", "二人のペースで、もう少し先へ。", "ラブホテルが見えてきた！ →"][checkpoint]);
      sfx.play("tick");
    }
    this.updateHud();
    if (this.player.x >= HOTEL_X - 12 && Math.abs(this.player.x - this.partner.x) < 84) this.finish();
  }

  createConversationUi() {
    this.dialogBox = this.add.graphics().setScrollFactor(0).setDepth(46).setVisible(false);
    this.dialogSpeaker = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#8fe7de",
    }).setScrollFactor(0).setDepth(47).setVisible(false);
    this.dialogText = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "17px", color: "#ffffff", lineSpacing: 4,
    }).setScrollFactor(0).setDepth(47).setVisible(false);
    this.replyButtons = WALK_REPLIES.map((choice) => {
      const button = this.add.container(0, 0).setScrollFactor(0).setDepth(48).setVisible(false);
      const bg = this.add.graphics();
      const text = this.add.text(0, 0, choice.label, {
        fontFamily: "system-ui, sans-serif", fontSize: "15px", color: "#ffffff",
      }).setOrigin(0.5);
      button.add([bg, text]);
      button.choiceKey = choice.key;
      button.setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 46), Phaser.Geom.Rectangle.Contains);
      button.on("pointerdown", (_pointer, _x, _y, event) => {
        event?.stopPropagation();
        this.chooseWalkReply(choice.key);
      });
      button.resize = (width, height) => {
        button.buttonWidth = width;
        button.buttonHeight = height;
        button.setSize(width, height);
        // Containers add displayOrigin during input hit testing; match the top-left artwork.
        button.input.hitArea.setTo(width / 2, height / 2, width, height);
        text.setPosition(width / 2, height / 2).setFontSize(width < 160 ? 13 : 15);
        bg.clear().fillStyle(choice.key === "evade" ? 0x60442d : 0x254b48, 0.96)
          .fillRoundedRect(0, 0, width, height, 7)
          .lineStyle(1, 0xffffff, 0.4).strokeRoundedRect(0, 0, width, height, 7);
      };
      return button;
    });
  }

  layoutConversation() {
    const active = Boolean(this.currentQuestion) && !this.finished;
    this.dialogBox.setVisible(active);
    this.dialogSpeaker.setVisible(active);
    this.dialogText.setVisible(active);
    this.leftButton.setVisible(!active && !this.finished);
    this.rightButton.setVisible(!active && !this.finished);
    this.caption.setVisible(!active && !this.finished);
    this.replyButtons.forEach((button) => button.setVisible(active && this.dialogState === "asking"));
    if (!active) { this.nativeButtons?.sync(); return; }
    const w = this.scale.width;
    const x = 12;
    const top = this.compact ? 86 : 112;
    const width = w - 24;
    const height = this.compact ? 148 : 252;
    this.dialogBox.clear().fillStyle(0x0c1522, 0.96).fillRoundedRect(x, top, width, height, 10)
      .lineStyle(2, this.doubt >= 50 ? 0xff9a86 : 0x79d7d3, 0.9).strokeRoundedRect(x, top, width, height, 10);
    this.dialogSpeaker.setPosition(x + 12, top + 12).setFontSize(13);
    const fontSize = this.compact ? 16 : 17;
    const chars = Math.floor((width - 24) / fontSize);
    this.dialogText.setPosition(x + 12, top + 36).setFontSize(fontSize)
      .setText(this.wrapDialogue(this.dialogueBody, chars));
    const gap = 6;
    const buttonWidth = this.compact ? (width - 24 - gap * 2) / 3 : width - 24;
    this.replyButtons.forEach((button, index) => {
      button.resize(buttonWidth, 46);
      button.setPosition(x + 12 + (this.compact ? index * (buttonWidth + gap) : 0),
        top + 92 + (this.compact ? 0 : index * 52));
    });
    this.nativeButtons?.sync();
  }

  wrapDialogue(text, chars) {
    return text.split("\n").map((line) => {
      const parts = [];
      for (let i = 0; i < line.length; i += chars) parts.push(line.slice(i, i + chars));
      return parts.join("\n");
    }).join("\n");
  }

  beginConversation() {
    if (this.finished || this.currentQuestion || this.nextQuestionIndex >= WALK_QUESTIONS.length) return;
    const index = this.nextQuestionIndex++;
    this.currentQuestion = { ...WALK_QUESTIONS[index], index };
    this.dialogState = "asking";
    this.releaseAll();
    this.player.anims.stop();
    this.partner.anims.stop();
    const label = this.runData.companion?.profile?.styleLabel || "相手";
    this.dialogSpeaker.setText(`${label} / 同行会話 ${index + 1}/${WALK_QUESTIONS.length}`);
    this.dialogueBody = index === 2 && this.totalEvasions > 0
      ? "さっきから、話そらしてません？"
      : this.currentQuestion.text;
    this.layoutConversation();
    this.updateHud();
    sfx.play("tick");
  }

  chooseWalkReply(key) {
    if (this.finished || !this.currentQuestion || this.dialogState !== "asking") return;
    const choice = WALK_REPLIES.find((item) => item.key === key);
    if (!choice) return;
    this.dialogState = "reply";
    const question = this.currentQuestion;
    let response;
    let failure = null;
    const previousDoubt = this.doubt;
    if (key === "evade") {
      this.doubt = Math.min(100, this.doubt + 20 + this.evasionStreak * 15);
      this.evasionStreak += 1;
      this.totalEvasions += 1;
      response = this.evasionStreak === 1 ? "えー、気になるんだけど（笑）" : "さっきもそれ言ってたよね？";
      if (question.final) {
        response = "ここはちゃんと教えてほしいな。";
        // The arrival question stays unresolved until a clear answer or a decision to stop.
        this.nextQuestionIndex = question.index;
      }
      if (this.doubt >= 100) failure = "ちゃんと答えてくれないなら、もう帰るね。";
    } else if (key === "explain") {
      this.doubt = Math.max(0, this.doubt - 25);
      this.evasionStreak = 0;
      this.destinationExplained = true;
      response = question.explained;
      if (question.final) {
        if (this.doubt >= 65) failure = "ごめん、やっぱり今日はやめておく。";
        else this.destinationConfirmed = true;
      }
    } else {
      this.evasionStreak = 0;
      if (this.doubt >= 55 || (question.final && !this.destinationExplained)) {
        failure = "うん、今日はここまでにするね。";
      } else {
        this.doubt = Math.max(0, this.doubt - 10);
        response = question.final ? "うん、入ってみよう。嫌になったら帰るね。" : "大丈夫。でも行き先は教えてね。";
        if (question.final) this.destinationConfirmed = true;
      }
    }
    if (failure) {
      this.finishBreakdown(failure);
      return;
    }
    if (!question.final || this.destinationConfirmed) this.questionsAnswered += 1;
    this.dialogSpeaker.setText(`あなた / ${choice.label}`);
    const delta = this.doubt - previousDoubt;
    const sign = delta >= 0 ? "+" : "";
    this.dialogueBody = `あなた「${question.playerLines[key]}」\n相手「${response}」\n不信感 ${sign}${delta} / ${this.doubt}`;
    this.layoutConversation();
    this.updateHud();
    sfx.play(key === "evade" ? "miss" : "hit");
    this.replyTimer = this.time.delayedCall(1600, () => this.closeConversation());
  }

  closeConversation() {
    if (this.finished || this.dialogState !== "reply") return;
    this.replyTimer?.remove(false);
    this.currentQuestion = null;
    this.dialogState = null;
    this.layoutConversation();
    this.caption.setText(this.destinationConfirmed ? "行き先の確認OK。二人で入口へ →" : "会話しながら、右へ進もう →");
  }

  finishBreakdown(reason) {
    if (this.finished) return;
    this.finished = true;
    this.outcome = "breakdown";
    this.replyTimer?.remove(false);
    this.releaseAll();
    this.player.anims.stop();
    this.partner.anims.stop();
    this.layoutConversation();
    this.partner.setFlipX(true);
    this.updateHud();
    this.tweens.add({ targets: this.partner, x: this.partner.x - 140, alpha: 0, duration: 700 });
    sfx.play("lose");
    this.showWalkResult(false, reason);
  }

  finish() {
    if (this.finished || this.currentQuestion || !this.destinationConfirmed ||
        this.questionsAnswered < WALK_QUESTIONS.length || this.doubt >= 100) return;
    this.finished = true;
    this.outcome = "goal";
    this.releaseAll();
    this.player.anims.stop();
    this.partner.anims.stop();
    this.score += 100;
    setBest(Math.max(getBest(), this.score));
    sfx.play("win");
    this.showWalkResult(true);
  }

  showWalkResult(success, reason = "") {
    this.layoutConversation();
    this.finishShade = this.add.graphics().setScrollFactor(0).setDepth(60);
    this.resultBody = success
      ? `二人でラブホテルに到着\n到着ボーナス +100\nScore ${this.score}`
      : `同行終了\n${reason}\n\n到着ボーナスなし\nScore ${this.score}`;
    this.finishText = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "26px", color: success ? "#ffe0a0" : "#ffb4a6", align: "center", lineSpacing: 14,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    this.returnButton = this.add.text(0, 0, "街へ戻る", {
      fontFamily: "system-ui, sans-serif", fontSize: "20px", color: "#ffffff", backgroundColor: "#28514d",
      padding: { left: 30, right: 30, top: 16, bottom: 16 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(62).setInteractive();
    // Finish the touch before changing scenes so the same tap cannot also
    // activate a field action underneath this button on small landscape screens.
    this.returnButton.on("pointerdown", (_pointer, _x, _y, event) => event?.stopPropagation());
    this.returnButton.once("pointerup", (_pointer, _x, _y, event) => {
      event?.stopPropagation();
      this.scene.start("MainScene", {
        ...this.runData, score: this.score, companion: null, hotelEntered: false, hotelReadyNotified: false,
        streak: success ? this.runData.streak : 0,
        lastOutcome: success ? "HOTEL GOAL +100" : "同行終了 / 到着せず",
        history: [...(this.runData.history || []), success ? "HOTEL GOAL" : "同行終了"].slice(-3),
      });
    });
    if (success) {
      this.goalArt = this.add.container(0, 0).setScrollFactor(0).setDepth(60.1);
      this.goalArtFrame = this.add.graphics().setScrollFactor(0).setDepth(60.2);
      const portrait = this.runData.companion?.portraitTextureKey;
      this.goalArtCompanionKey = portrait && this.textures.exists(portrait) ? portrait : aiSourceKeyFor(this.partnerBase);
      this.goalTitle = this.add.text(0, 0, "ゴール！", {
        fontFamily: "system-ui, sans-serif", fontSize: "64px", color: "#ffe584", fontStyle: "bold",
        stroke: "#723e29", strokeThickness: 7,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(63);
    }
    this.layoutFinish();
    if (success) this.playGoalCelebration();
  }

  playGoalCelebration() {
    this.goalConfetti = [];
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    this.goalArt?.setAlpha(0);
    if (this.goalArt) this.tweens.add({ targets: this.goalArt, alpha: 1, duration: 600, ease: "Sine.easeOut" });
    this.goalTitle.setScale(0.25).setAlpha(0);
    this.tweens.add({ targets: this.goalTitle, scale: 1, alpha: 1, duration: 650, ease: "Back.easeOut" });
    this.cameras.main.flash(180, 255, 223, 157);
    const w = this.scale.width, h = this.scale.height;
    const colors = [0xffd766, 0xff8fbb, 0x7be6dd, 0xfff5ce];
    for (let i = 0; i < 40; i++) {
      const fromLeft = i % 2 === 0;
      const piece = this.add.rectangle(fromLeft ? 0 : w, h * .24,
        4 + i % 4, 3 + i % 3, colors[i % colors.length])
        .setScrollFactor(0).setDepth(60.5).setRotation(i);
      this.goalConfetti.push(piece);
      this.tweens.add({ targets: piece, x: w * (.08 + (i * .137 % .84)), y: h * (.55 + i % 7 * .055),
        angle: 180 + i * 37, alpha: 0, duration: 1200 + i % 6 * 140, ease: "Quad.easeOut",
        onComplete: () => piece.destroy() });
    }
  }

  drawGoalArt(x, y, width, height) {
    this.goalArt.removeAll(true).setPosition(x, y).setSize(width, height);
    this.textures.get("goal-cg-backdrop").setFilter(Phaser.Textures.FilterMode.LINEAR);
    const backdrop = this.add.image(width / 2, height / 2, "goal-cg-backdrop");
    // Crop the square illustration to the card without stretching it.
    const cover = Math.max(width / backdrop.width, height / backdrop.height);
    const cropWidth = width / cover, cropHeight = height / cover;
    backdrop.setCrop((backdrop.width - cropWidth) / 2, (backdrop.height - cropHeight) / 2, cropWidth, cropHeight)
      .setScale(cover);
    const box = Math.min(height * .82, width * .94);
    const positions = [width * .32, width * .69];
    const shadows = this.add.graphics();
    shadows.fillStyle(0x141326, .32);
    positions.forEach(px => shadows.fillEllipse(px, height - 12, box * .4, 12));
    const people = ["ai_player_raw", this.goalArtCompanionKey].map((key, index) =>
      this.add.image(positions[index], height - 6, key)
        .setOrigin(.5, 1).setDisplaySize(box, box));
    this.goalArt.add([backdrop, shadows, ...people]);
    this.goalArtFrame.clear().lineStyle(2, 0xf6c98e, .8).strokeRect(x - 1, y - 1, width + 2, height + 2);
  }

  layoutFinish() {
    const w = this.scale.width, h = this.scale.height;
    this.finishShade.clear().fillStyle(0x080e18, this.goalTitle ? 1 : .9).fillRect(0, 0, w, h);
    if (this.goalTitle) {
      const landscape = w > h && h < 600;
      const artX = 12, artY = landscape ? 12 : 102;
      const artWidth = landscape ? Math.round(w * .57) : w - 24;
      const artHeight = landscape ? h - 24 : Math.min(h * .62, h - 278);
      this.drawGoalArt(artX, artY, artWidth, artHeight);
      const panelLeft = landscape ? artX + artWidth + 12 : 16;
      const panelWidth = w - panelLeft - 16;
      const center = panelLeft + panelWidth / 2;
      const titleSize = Math.min(58, panelWidth * .16, h * .17);
      const titleY = landscape ? 53 : 49;
      this.goalTitle.setPosition(center, titleY).setFontSize(titleSize);
      this.finishShade.lineStyle(1, 0xffd477, .6)
        .lineBetween(panelLeft + 12, titleY + titleSize * .8, w - 28, titleY + titleSize * .8);
      const fontSize = landscape ? (panelWidth < 220 ? 14 : 17) : w < 360 ? 16 : 18;
      this.finishText.setPosition(center, landscape ? h * .5 : artY + artHeight + 53)
        .setFontSize(fontSize).setLineSpacing(6)
        .setText(this.wrapDialogue(this.resultBody, Math.floor(panelWidth / fontSize)));
      this.returnButton.setFontSize(landscape ? 17 : 18).setPadding(22, 14, 22, 14)
        .setPosition(center, h - (landscape ? 43 : 39));
    } else {
      const fontSize = h < 450 ? 18 : w < 360 ? 22 : 25;
      this.finishText.setPosition(w / 2, h * .38).setFontSize(fontSize).setLineSpacing(h < 450 ? 3 : 12)
        .setText(this.wrapDialogue(this.resultBody, Math.floor((w - 36) / fontSize)));
      this.returnButton.setPosition(w / 2, h - 60);
    }
  }
}
