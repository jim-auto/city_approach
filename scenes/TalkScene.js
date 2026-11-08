import { compatibilityFor } from '../attraction.js?v=20261108-types1';
import { encounterFor, replyEffect } from "../encounter-rules.js?v=20261108-types1";
import { createNativeButtons } from "../native-buttons.js?v=20261108-types1";
import { buildFlipLines } from "../conversation-flips.js?v=20261108-types1";
import { sfx } from "../sfx.js?v=20261108-types1";
import { DIFFICULTIES, getDifficulty, getHeight, heightFor } from "../storage.js?v=20261108-types1";

const CHOICES = [
  { key: "listen", label: "聞く", color: 0x3b4652 },
  { key: "empathy", label: "共感", color: 0x24544f },
  { key: "tsukkomi", label: "ツッコミ", color: 0x5d3340 },
  { key: "proposal", label: "提案", color: 0x38496a },
];

export default class TalkScene extends Phaser.Scene {
  constructor() {
    super("TalkScene");
  }

  create(data = {}) {
    this.profile = data.profile || {
      type: "目線あり系",
      traits: ["目が合う", "歩くの遅い"],
      interest: 55,
      flags: ["eye_contact"],
    };
    this.mapKey = data.mapKey || "nagoya";
    this.score = data.score || 0;
    this.best = data.best || 0;
    this.fieldTextureKey = data.npcTextureKey || null;
    this.portraitTextureKey = data.portraitTextureKey || this.fieldTextureKey;
    this.npcTextureKey = this.portraitTextureKey || null;
    this.history = Array.isArray(data.history) ? data.history.slice(-3) : [];
    this.streak = data.streak || 0;
    this.cleared = Boolean(data.cleared);
    this.hotelEntered = Boolean(data.hotelEntered);
    this.hotelReadyNotified = Boolean(data.hotelReadyNotified);
    this.difficulty =
      DIFFICULTIES.find((d) => d.key === data.difficulty) || getDifficulty();
    this.encounter = encounterFor(this.profile);
    this.height = data.height ? heightFor(data.height) : getHeight();
    this.compatibility = compatibilityFor(this.profile, {difficulty: this.difficulty.key, height:this.height.key});
    // Four calm replies can still earn an invitation when there is no explicit exclusion.
    this.favor = Phaser.Math.Clamp(42 + Math.round(((this.profile.interest ?? 50) - 50) * 0.35) + this.encounter.startFavor + this.compatibility.favorMod, 17, 100);
    this.discomfort = Phaser.Math.Clamp((this.mapKey === "kabukicho" ? 24 : 14) + this.encounter.startGuard, 0, 100);
    this.responseChain = 0;
    this.bestResponseChain = 0;
    this.invitationAccepted = false;
    this.resolvedConcerns = new Set();
    this.lineIndex = -1;
    this.choiceLocked = false;
    this.resultShown = false;

    this.lines = this.buildLines(this.profile, this.mapKey);

    this.bg = this.add.graphics().setDepth(-20);
    this.portraitHalo = this.add.graphics().setDepth(1);
    this.portraitImage = this.npcTextureKey && this.textures.exists(this.npcTextureKey)
      ? this.add.image(0, 0, this.npcTextureKey).setDepth(2)
      : null;
    this.gaugeGraphics = this.add.graphics().setDepth(12);
    this.timerGraphics = this.add.graphics().setDepth(14);
    this.favorGaugeLabel = this.createGaugeLabel("安心感");
    this.discomfortGaugeLabel = this.createGaugeLabel("違和感");
    this.feedbackText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: "#f4f6f8",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.resultScoreText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: "#ffd24f",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.resultPanel = this.add.graphics().setDepth(19).setVisible(false);
    this.topicText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#f7d66b",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.lineText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "38px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 860, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.choiceButtons = CHOICES.map((choice) =>
      this.createChoiceButton(choice.label, choice.color, () => this.choose(choice.key))
    );
    this.resultButton = this.createChoiceButton("フィールドへ", 0x253543, () => this.returnToField());
    this.resultButton.setVisible(false);
    this.resultButton.disableInteractive();
    this.nativeButtons = createNativeButtons(this, [
      ...this.choiceButtons.map((object, i) => ({
        object, label: () => object.rawLabel || CHOICES[i].label,
        enabled: () => !this.resultShown && !this.choiceLocked && this.lineIndex >= 0,
        activate: () => this.choose(CHOICES[i].key),
      })),
      { object: this.resultButton,
        label: () => this.resultButton.cardText.text,
        enabled: () => this.resultShown,
        activate: () => this.returnToField() },
    ]);

    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));
    this.layout();
    this.nextLine();
  }

  buildLines(profile, mapKey) {
    return buildFlipLines(profile, mapKey, items => Phaser.Utils.Array.Shuffle([...items]));
  }

  createChoiceButton(label, fillColor, onClick) {
    const width = 132;
    const height = 54;
    const container = this.add.container(0, 0).setDepth(30);
    const bg = this.add.graphics();
    const text = this.add
      .text(width / 2, height / 2, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#ffffff", align: "center",
      })
      .setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(width, height);
    container.setInteractive(new Phaser.Geom.Rectangle(width / 2, height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    container.on("pointerdown", (pointer) => {
      onClick();
    });
    container.bg = bg;
    container.cardText = text;
    container.fillColor = fillColor;
    container.buttonWidth = width;
    container.buttonHeight = height;
    container.redraw = () => {
      bg.clear();
      bg.fillStyle(0xf4eedf, 1);
      bg.fillRoundedRect(0, 0, container.buttonWidth, container.buttonHeight, 8);
      bg.lineStyle(2, fillColor, 1);
      bg.strokeRoundedRect(0, 0, container.buttonWidth, container.buttonHeight, 8);
    };
    container.resize = (newWidth, newHeight) => {
      container.buttonWidth = newWidth;
      container.buttonHeight = newHeight;
      container.setSize(newWidth, newHeight);
      container.input.hitArea.setTo(newWidth / 2, newHeight / 2, newWidth, newHeight);
      text.setPosition(newWidth / 2, newHeight / 2).setFontSize(newWidth < 160 ? 12 : 14).setColor("#1b2b40");
      if (container.rawLabel) text.setText(this.wrapText(container.rawLabel, Math.max(8, Math.floor((newWidth - 14) / (newWidth < 160 ? 12 : 14)))));
      container.redraw();
    };
    container.redraw();
    return container;
  }

  createGaugeLabel(label) {
    return this.add
      .text(0, 0, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setDepth(13);
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const landscape = width > height && height < 600;
    this.drawBackground(width, height);
    const contentLeft = landscape ? Math.round(width * 0.36) : 16;
    const contentWidth = width - contentLeft - 16;
    const centerX = contentLeft + contentWidth / 2;
    this.contentLeft = contentLeft;
    this.contentWidth = contentWidth;
    const buttonY = height - 72;
    this.buttonY = buttonY;
    let contentTop = 76;
    this.portraitHalo.clear();
    if (this.portraitImage) {
      const size = landscape ? Math.min(width * 0.28, height * 0.53) : Math.min(width * 0.46, height * 0.20);
      const portraitX = landscape ? width * 0.18 : width / 2;
      const centerY = landscape ? 75 + (height - 100) / 2 : 72 + size / 2;
      this.portraitImage.setPosition(portraitX, centerY).setScale(size / this.portraitImage.width);
      this.portraitHalo.fillStyle(0xffc8d8, 0.22).fillCircle(portraitX, centerY, size * 0.53);
      if (!landscape) contentTop = 72 + size + 12;
    }
    const feedbackY = height - (this.resultShown ? (landscape ? 132 : 168) : (landscape ? 150 : 196));
    this.topicText.setOrigin(0.5, 0).setPosition(centerX, contentTop).setFontSize(Math.min(14, contentWidth / 23));
    this.feedbackText.setPosition(centerX, feedbackY).setFontSize(contentWidth < 330 ? 13 : 15);
    this.feedbackText.setWordWrapWidth(contentWidth);
    this.resultScoreText.setPosition(centerX, height - 100).setFontSize(contentWidth < 330 ? 14 : 17);
    const gap = 8;
    const buttonWidth = (contentWidth - gap) / 2;
    const cardHeight = landscape ? 50 : 66;
    const cardsY = height - (landscape ? 116 : 156);
    this.choiceButtons.forEach((button, index) => {
      button.resize(buttonWidth, cardHeight);
      button.setPosition(contentLeft + (index % 2) * (buttonWidth + gap), cardsY + Math.floor(index / 2) * (cardHeight + gap));
    });
    this.buttonY = this.resultShown ? buttonY : cardsY;
    this.resultButton.resize(Math.min(220, contentWidth), 54);
    this.resultButton.setPosition(centerX - this.resultButton.buttonWidth / 2, buttonY);
    const rawText = this.resultShown ? this.resultBody : this.lines[this.lineIndex]?.text;
    if (rawText) {
      let fontSize = this.resultShown ? (landscape ? 22 : 26) : (landscape ? 25 : 29);
      const lineTop = contentTop + (this.resultShown ? 30 : 38);
      const maxHeight = Math.max(36, feedbackY - 24 - lineTop);
      do {
        this.lineText.setFontSize(fontSize).setWordWrapWidth(contentWidth);
        this.lineText.setText(this.wrapText(rawText, Math.max(8, Math.floor(contentWidth / fontSize))));
        if (this.lineText.height <= maxHeight || fontSize <= 16) break;
        fontSize -= 1;
      } while (true);
      this.lineText.setPosition(centerX, lineTop + this.lineText.height / 2);
    }
    this.drawGauges();
    if (this.resultShown) this.drawResultPanel(this.resultBonus === 120, this.resultBonus === 0);
    this.nativeButtons?.sync();
  }

  drawBackground(width, height) {
    const g = this.bg;
    g.clear();
    g.fillStyle(0x101116, 1).fillRect(0, 0, width, height);
    g.fillStyle(0x1f252b, 1).fillRect(0, height * 0.18, width, height * 0.64);
    const colors = [0x2bd9d0, 0xf45b69, 0xffc857, 0xf7f7ff];
    for (let i = -2; i < 9; i += 1) {
      const x = i * 170 + ((this.time.now || 0) / 35) % 170;
      g.lineStyle(4, colors[i % colors.length < 0 ? 0 : i % colors.length], 0.24);
      g.lineBetween(x, height * 0.18, x - 210, height * 0.82);
    }
    g.fillStyle(0x07080c, 0.76).fillRect(0, height * 0.77, width, height * 0.23);
    g.lineStyle(2, 0xffffff, 0.2).lineBetween(0, height * 0.77, width, height * 0.77);
  }

  drawGauges() {
    const width = this.scale.width;
    const gaugeWidth = Math.min(250, width * 0.42);
    const favorX = 16;
    const discomfortX = width - gaugeWidth - 16;
    this.gaugeGraphics.clear();
    this.drawGauge(favorX, 18, gaugeWidth, 18, this.favor, 0x2bd9d0);
    this.drawGauge(discomfortX, 18, gaugeWidth, 18, this.discomfort, 0xf45b69);
    this.favorGaugeLabel.setPosition(favorX + 10, 23);
    this.discomfortGaugeLabel.setPosition(discomfortX + 10, 23);
  }

  drawGauge(x, y, width, height, value, color) {
    const g = this.gaugeGraphics;
    g.fillStyle(0x090b10, 0.84).fillRoundedRect(x, y, width, height + 24, 8);
    g.fillStyle(0x262b34, 1).fillRoundedRect(x + 8, y + 20, width - 16, height, 6);
    g.fillStyle(color, 0.92).fillRoundedRect(x + 8, y + 20, (width - 16) * (value / 100), height, 6);
  }

  update() {
    if (this.resultShown || this.choiceLocked || this.lineIndex < 0) return;
    this.drawBackground(this.scale.width, this.scale.height);
    this.drawGauges();
    const elapsed = this.time.now - this.lineStartedAt;
    const progress = Phaser.Math.Clamp(elapsed / this.lineDuration, 0, 1);
    this.drawTimer(progress);
    if (progress >= 1) {
      this.timeoutLine();
    }
  }

  drawTimer(progress) {
    const width = this.scale.width;
    const y = (this.buttonY || this.scale.height - 72) - 16;
    this.timerGraphics.clear();
    this.timerGraphics.fillStyle(0xffc857, 0.92).fillRect(20, y, (width - 40) * (1 - progress), 5);
  }

  nextLine() {
    this.lineIndex += 1;
    this.choiceLocked = false;
    this.feedbackText.setText("");
    if (this.lineIndex >= this.lines.length) {
      this.showFinal(false);
      return;
    }

    const line = this.lines[this.lineIndex];
    if (line.isClosing && !this.compatibility.eligible) line.text = this.compatibility.reaction;
    else if (line.isClosing && this.resolvedConcerns.size < 3) line.text = "まだちょっと不安かも。今日はどうしよう……。";
    const baseSize = this.scale.width < 430 ? 29 : 40;
    this.lineText.setFontSize(line.text.length > 16 ? baseSize - 6 : baseSize);
    this.lineText.setText(this.wrapText(line.text, this.scale.width < 430 ? 12 : 22));
    const phase = line.concern ? (line.isClosing ? `LAST / ${this.encounter.label}` : `不安 ${this.lineIndex + 1}/4 / ${this.encounter.label}`) : `返答: ${line.cue}`;
    this.topicText.setText(`${phase}\n${line.concern ? `好み：${this.compatibility.preference.label}` : "相手の気持ちを読もう"}`);
    this.topicText.setAlign("center");
    this.choiceButtons.forEach((button, i) => {
      button.rawLabel = line.cards?.[i]?.text || CHOICES[i].label;
      button.setAlpha(1).setScale(1);
    });
    this.lineStartedAt = this.time.now;
    this.lineDuration = line.concern ? (this.encounter.key === "casual" ? 16000 : this.encounter.key === "rushed" ? 12000 : 14000) : (line.weak ? 5000 : 4000);
    this.layout();
    sfx.play("tick");
  }

  choose(choiceKey) {
    if (this.resultShown || this.choiceLocked) return;
    this.choiceLocked = true;
    const line = this.lines[this.lineIndex];
    if (!CHOICES.some((choice) => choice.key === choiceKey)) {
      this.choiceLocked = false;
      return;
    }
    this.encounter = encounterFor(this.profile);
    const effect = line.concern ? replyEffect(this.profile, line, choiceKey, this.responseChain) : null;
    this.lastReplyEffect = effect;
    const readyToInvite = this.compatibility.eligible && this.favor >= (line.concern ? this.encounter.inviteAt + this.compatibility.inviteMod : 68) && this.discomfort < 60;
    const correct = effect ? ["match", "safe"].includes(effect.quality) : line.weak ? line.correct.includes(choiceKey) : choiceKey === "listen";
    if (correct) {
      this.responseChain += 1;
      this.bestResponseChain = Math.max(this.bestResponseChain, this.responseChain);
      const gain = effect ? effect.favor : (line.weak ? 20 : 10) + Math.min(9, (this.responseChain - 1) * 3);
      this.favor = Phaser.Math.Clamp(this.favor + gain, 0, 100);
      this.discomfort = Phaser.Math.Clamp(this.discomfort + (effect?.guard ?? -6), 0, 100);
      this.invitationAccepted = choiceKey === "proposal" && readyToInvite && (!line.concern || (line.isClosing && this.resolvedConcerns.size >= 3));
      if (line.concern && !line.isClosing) this.resolvedConcerns.add(line.concern);
      this.feedbackText.setText(this.wrapText(
        `${line.weak ? "文脈に合った返答" : "相手の話を聞けた"}！ 好感+${gain} / ${this.responseChain}連続` +
        (choiceKey === "proposal" && !readyToInvite ? "。まずは信頼を深めよう。" : ""),
        this.scale.width < 430 ? 20 : 42));
      this.pulseFeedback(effect?.quality === "safe" ? "safe" : "hit");
      sfx.play(effect?.quality === "safe" ? "tick" : "hit");
    } else if (choiceKey === "listen" && !line.concern) {
      this.responseChain = 0;
      this.discomfort = Phaser.Math.Clamp(this.discomfort - 4, 0, 100);
      this.feedbackText.setText(this.wrapText("ひと呼吸。違和感-4 / 好感は変わらない", this.scale.width < 430 ? 20 : 42));
      this.pulseFeedback("watch");
      sfx.play("tick");
    } else {
      this.responseChain = 0;
      this.favor = Phaser.Math.Clamp(this.favor - 5, 0, 100);
      this.discomfort = Phaser.Math.Clamp(this.discomfort + (effect?.guard ?? (line.weak ? 22 : 14)), 0, 100);
      const advice = line.weak
        ? `「${line.cue}」には${line.correct.map((key) => CHOICES.find((choice) => choice.key === key).label).join("・")}が合う。`
        : "相手が話している時は「聞く」で待とう。";
      this.feedbackText.setText(this.wrapText(advice, this.scale.width < 430 ? 20 : 42));
      this.pulseFeedback("miss");
      sfx.play("miss");
    }

    if (line.concern) {
      this.topicText.setText(`${line.isClosing ? "LAST" : `不安 ${this.lineIndex + 1}/4`} / ${this.encounter.label}\n${effect.label} / 安心 ${this.resolvedConcerns.size}/4`);
      const accepted = correct && (!line.isClosing || this.invitationAccepted);
      this.feedbackText.setText(this.wrapText(accepted ? `「${effect.reaction}」` : correct ? "まだ不安が残るな。今日はここまでにしよう。" : `「${effect.reaction}」`, this.scale.width < 430 ? 21 : 30));
      const index = CHOICES.findIndex(c => c.key === choiceKey);
      const card = this.choiceButtons[index];
      this.choiceButtons.forEach((button, i) => button.setAlpha(i === index ? 1 : .35));
      this.tweens.add({ targets: card, scaleX: .92, scaleY: .92, yoyo: true, duration: 130 });
      this.layout();
    }
    this.nativeButtons?.sync();
    this.drawGauges();
    if (this.invitationAccepted) {
      this.showFinal(true);
      return;
    }
    if (this.discomfort >= 100) {
      this.showFinal(false, true);
      return;
    }
    this.time.delayedCall(line.concern ? 1800 : 620, () => { if (!this.resultShown) this.nextLine(); });
  }

  timeoutLine() {
    if (this.choiceLocked) return;
    this.choiceLocked = true;
    this.nativeButtons?.sync();
    const line = this.lines[this.lineIndex];
    this.responseChain = 0;
    if (line.weak) {
      this.discomfort = Phaser.Math.Clamp(this.discomfort + 10, 0, 100);
      this.feedbackText.setText(line.concern ? "考えているうちに、話題が変わってしまった。" : "タイミングを逃した。違和感が少し上がる。");
      this.pulseFeedback("timeout");
      if (this.discomfort >= 100) {
        this.showFinal(false, true);
        return;
      }
    } else {
      this.feedbackText.setText("次は「聞く」で信頼を深めよう。");
    }
    this.time.delayedCall(450, () => {
      if (!this.resultShown) this.nextLine();
    });
  }

  skipLine() {
    if (this.choiceLocked) return;
    this.timeoutLine();
  }

  showFinal(success, failedByDiscomfort = false) {
    this.resultShown = true;
    this.timerGraphics.clear();
    this.choiceButtons.forEach((button) => {
      button.setVisible(false);
      button.disableInteractive();
    });
    let title = "中間結果";
    let body = "会話は自然に終わった。反応は悪くないが、次の提案には至らない。";
    this.resultBonus = 25;
    this.streakDelta = 1;

    let outcomeTag = "中間";
    if (success) {
      title = "ラブホ同行成立！";
      body = "行き先を確認して、二人でラブホテルへ向かう。";
      this.resultBonus = 120;
      this.streakDelta = 2;
      outcomeTag = "ラブホ同行成立";
      sfx.play("win");
    } else if (failedByDiscomfort || this.discomfort >= 100) {
      title = "失敗";
      body = "違和感が上がりすぎた。追わずに離れる。";
      this.resultBonus = 0;
      this.streakDelta = -this.streak;
      outcomeTag = "違和感で失敗";
      sfx.play("lose");
    } else if (this.favor >= 68 && !this.lines.some(line => line.concern)) {
      body = "短い雑談は成立。場所とタイミング次第で次に進める。";
      this.resultBonus = 55;
      this.streakDelta = 1;
      outcomeTag = "雑談成立";
      sfx.play("win");
    } else {
      outcomeTag = "中間";
      this.streakDelta = 0;
      sfx.play("skip");
    }
    this.resultBody = body;
    this.lastOutcome = `${outcomeTag} 好${this.favor}/違${this.discomfort}`;
    const preview = this.previewScoreResult();

    this.topicText.setText(title);
    this.lineText.setFontSize(this.scale.width < 430 ? 30 : 42);
    this.lineText.setText(this.wrapText(body, this.scale.width < 430 ? 12 : 24));
    this.feedbackText.setText(`安心感 ${this.favor} / 違和感 ${this.discomfort}\n${this.resolvedConcerns.size}/4 話題で安心して話せた`);
    this.resultScoreText
      .setText(`獲得 +${preview.total} / 連続 ${this.streak} → ${preview.nextStreak}`)
      .setVisible(true);
    this.drawResultPanel(success, failedByDiscomfort);
    this.resultButton.list.find((child) => child.text !== undefined).setText(this.resultBonus >= 55 ? "ラブホテルへ歩く" : "フィールドへ");
    this.resultButton.setVisible(true);
    this.resultButton.setInteractive(
      new Phaser.Geom.Rectangle(this.resultButton.buttonWidth / 2, this.resultButton.buttonHeight / 2, this.resultButton.buttonWidth, this.resultButton.buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );
    this.layout();
  }

  returnToField() {
    const { total, nextStreak } = this.previewScoreResult();
    this.scene.start(this.resultBonus >= 55 ? "EscortScene" : "MainScene", {
      mapKey: this.mapKey,
      score: this.score + total,
      best: this.best,
      difficulty: this.difficulty.key,
      height: this.height.key,
      history: this.history,
      lastOutcome: `${this.lastOutcome || "中間"} +${total}`,
      streak: nextStreak,
      cleared: this.cleared,
      hotelEntered: this.hotelEntered,
      hotelReadyNotified: this.hotelReadyNotified,
      companion: this.resultBonus >= 55
        ? {
            profile: this.profile,
            textureKey: this.fieldTextureKey,
            portraitTextureKey: this.portraitTextureKey,
          }
        : null,
    });
  }

  pulseFeedback(kind) {
    // Card feedback already occupies this space; keep the dialogue readable.
    if (this.lines[this.lineIndex]?.concern) return;
    const color = {
      hit: "#57f5ff",
      safe: "#57f5ff",
      miss: "#ff4d6d",
      watch: "#ffd24f",
      timeout: "#f5f1df",
    }[kind] || "#ffffff";
    const label = {
      hit: "好印象",
      safe: "減点なし",
      miss: "違和感",
      watch: "READ",
      timeout: "LATE",
    }[kind] || "";
    const t = this.add
      .text(this.scale.width / 2, this.scale.height * 0.62, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "32px",
        color,
        fontStyle: "bold",
        stroke: "#0a0a10",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(35);
    this.tweens.add({
      targets: t,
      y: t.y - 28,
      alpha: 0,
      duration: 650,
      ease: "Quad.easeOut",
      onComplete: () => t.destroy(),
    });
    this.tweens.add({
      targets: this.lineText,
      scaleX: kind === "miss" || kind === "timeout" ? 1.04 : 1.02,
      scaleY: kind === "miss" || kind === "timeout" ? 1.04 : 1.02,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  drawResultPanel(success, failedByDiscomfort) {
    const panelWidth = Math.min(this.contentWidth + 12, 540);
    const lineBounds = this.lineText.getBounds();
    const panelHeight = Math.min(170, Math.max(104, lineBounds.height + 42));
    const x = this.contentLeft + (this.contentWidth - panelWidth) / 2;
    const y = lineBounds.y - 12;
    const accent = success ? 0x57f5ff : failedByDiscomfort ? 0xff4d6d : 0xffd24f;
    this.resultPanel.clear();
    this.resultPanel.setVisible(true);
    this.resultPanel.fillStyle(0x090b10, 0.82).fillRoundedRect(x, y, panelWidth, panelHeight, 10);
    this.resultPanel.lineStyle(3, accent, 0.72).strokeRoundedRect(x, y, panelWidth, panelHeight, 10);
    this.resultPanel.fillStyle(accent, 0.08).fillRoundedRect(x + 5, y + 5, panelWidth - 10, panelHeight - 10, 8);
  }

  previewScoreResult() {
    const adjusted = Math.round(this.resultBonus * this.difficulty.mult);
    const nextStreak = Math.max(0, this.streak + this.streakDelta);
    const comboBonus = adjusted > 0 && nextStreak >= 3 ? Math.min(40, nextStreak * 6) : 0;
    return {
      adjusted,
      comboBonus,
      nextStreak,
      total: adjusted + comboBonus,
    };
  }

  wrapText(text, maxChars) {
    return text.split("\n").map((paragraph) => {
      const lines = [];
      const rows = Math.ceil(paragraph.length / maxChars);
      // Keep a trailing character or punctuation from becoming a line on its own.
      const count = rows > 1 && paragraph.length % maxChars > 0 && paragraph.length % maxChars <= 2
        ? Math.ceil(paragraph.length / rows) : maxChars;
      for (let i = 0; i < paragraph.length; i += count) lines.push(paragraph.slice(i, i + count));
      return lines.join("\n");
    }).join("\n");
  }
}
