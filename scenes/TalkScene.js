import { sfx } from "../sfx.js";
import { DIFFICULTIES, getDifficulty } from "../storage.js";

const CHOICES = [
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
    this.npcTextureKey = data.portraitTextureKey || data.npcTextureKey || null;
    this.history = Array.isArray(data.history) ? data.history.slice(-3) : [];
    this.streak = data.streak || 0;
    this.cleared = Boolean(data.cleared);
    this.hotelEntered = Boolean(data.hotelEntered);
    this.hotelReadyNotified = Boolean(data.hotelReadyNotified);
    this.difficulty =
      DIFFICULTIES.find((d) => d.key === data.difficulty) || getDifficulty();
    this.favor = 42 + Math.round((this.profile.interest - 50) * 0.35);
    this.discomfort = this.mapKey === "kabukicho" ? 24 : 14;
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
    this.favorGaugeLabel = this.createGaugeLabel("好感度");
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

    this.input.on("pointerdown", (pointer, objects) => {
      if (!objects.length && !this.resultShown) {
        this.skipLine();
      }
    });
    this.scale.on("resize", this.layout, this);
    this.layout();
    this.nextLine();
  }

  buildLines(profile, mapKey) {
    const pool = {
      opening: [
        { text: "友達待っててさ", weak: false, correct: [], cue: "同伴確認" },
        { text: "今ちょっと手短になら", weak: false, correct: [], cue: "時間制約" },
        { text: "普段は返さないんだけど", weak: false, correct: [], cue: "初見の警戒" },
      ],
      neutralWeak: [
        { text: "でもちょっと時間あるし", weak: true, correct: ["proposal", "empathy"], cue: "時間の余白" },
        { text: "ナンパとか慣れてなくて", weak: true, correct: ["empathy"], cue: "警戒" },
        { text: "えっと、何の話?", weak: true, correct: ["tsukkomi", "proposal"], cue: "仕切り直し" },
      ],
      phone: [
        { text: "通知見ながらでごめん", weak: true, correct: ["tsukkomi", "empathy"], cue: "注意分散" },
        { text: "LINE返してからでいい?", weak: true, correct: ["empathy"], cue: "優先順位" },
      ],
      eye_contact: [
        { text: "目合っちゃったね", weak: true, correct: ["empathy", "tsukkomi"], cue: "偶然の合図" },
        { text: "ちらっと見えちゃったから", weak: true, correct: ["tsukkomi"], cue: "軽いノリ" },
      ],
      waiting: [
        { text: "友達もう遅れてる", weak: true, correct: ["tsukkomi", "empathy"], cue: "待ち時間" },
        { text: "ここで30分待ってる", weak: true, correct: ["empathy", "proposal"], cue: "余白" },
      ],
      friend: [
        { text: "友達が戻ったらすぐ行くね", weak: true, correct: ["empathy", "proposal"], cue: "相手の予定" },
        { text: "この子ほんとに急いでて", weak: false, correct: [], cue: "グループ事情" },
      ],
      earphones: [
        { text: "今ちょっと音楽聞いてて", weak: true, correct: ["empathy"], cue: "遮断サイン" },
        { text: "片耳だけ外した", weak: true, correct: ["empathy", "proposal"], cue: "半開き" },
      ],
      fast: [
        { text: "急いでるんだごめん", weak: false, correct: [], cue: "急ぎ" },
      ],
      slow: [
        { text: "まだ時間あるからゆっくり", weak: true, correct: ["empathy"], cue: "余白" },
      ],
      lookingAround: [
        { text: "ここ初めてで迷っちゃって", weak: true, correct: ["proposal", "tsukkomi"], cue: "情報要求" },
        { text: "人多くてびっくりしてる", weak: true, correct: ["empathy", "tsukkomi"], cue: "圧" },
      ],
      kabukicho: [
        { text: "この辺、声かけ多くて警戒しちゃう", weak: true, correct: ["empathy"], cue: "夜の警戒" },
        { text: "ネオン撮りたかったのに人多い", weak: true, correct: ["empathy", "proposal"], cue: "場所の文脈" },
        { text: "夜ってテンション違うよね", weak: true, correct: ["tsukkomi", "empathy"], cue: "時間帯" },
      ],
      nagoya: [
        { text: "改札前だと人が多いね", weak: true, correct: ["tsukkomi", "proposal"], cue: "場所の文脈" },
        { text: "金時計で合流予定", weak: false, correct: [], cue: "待ち合わせ" },
        { text: "エスカの方から来たんだけど", weak: true, correct: ["tsukkomi", "empathy"], cue: "地理" },
      ],
    };

    const pickOne = (bucket) => Phaser.Math.RND.pick(bucket);
    const lines = [pickOne(pool.opening)];

    if (profile.traits.includes("イヤホン") || profile.traits.includes("外界遮断")) {
      lines.push(pickOne(pool.earphones));
    }
    if (profile.traits.includes("スマホ")) {
      lines.push(pickOne(pool.phone));
    }
    if (profile.traits.includes("目が合う")) {
      lines.push(pickOne(pool.eye_contact));
    }
    if (profile.traits.includes("待ち合わせ") || profile.traits.includes("立ち止まり")) {
      lines.push(pickOne(pool.waiting));
    }
    if (profile.traits.includes("友達といる")) {
      lines.push(pickOne(pool.friend));
    }
    if (profile.traits.includes("歩くの速い")) {
      lines.push(pickOne(pool.fast));
    }
    if (profile.traits.includes("歩くの遅い")) {
      lines.push(pickOne(pool.slow));
    }
    if (profile.traits.includes("観光中") || profile.traits.includes("周囲を見る")) {
      lines.push(pickOne(pool.lookingAround));
    }
    lines.push(pickOne(pool.neutralWeak));
    lines.push(pickOne(mapKey === "kabukicho" ? pool.kabukicho : pool.nagoya));
    return lines.slice(0, 6);
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
        color: "#ffffff",
      })
      .setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(width, height);
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    container.on("pointerdown", (pointer) => {
      pointer.event?.preventDefault();
      onClick();
    });
    container.bg = bg;
    container.fillColor = fillColor;
    container.buttonWidth = width;
    container.buttonHeight = height;
    container.redraw = () => {
      bg.clear();
      bg.fillStyle(fillColor, 0.94);
      bg.fillRoundedRect(0, 0, width, height, 8);
      bg.lineStyle(2, 0xffffff, 0.38);
      bg.strokeRoundedRect(0, 0, width, height, 8);
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
    this.drawBackground(width, height);

    // Portrait of the NPC we're talking to, large and centered in the upper
    // half. The rest of the UI gets pushed down beneath it.
    let portraitBottom = 64;
    if (this.portraitImage) {
      const size = Math.min(width * 0.58, height * 0.34);
      const centerY = 72 + size / 2;
      const scale = size / this.portraitImage.width;
      this.portraitImage.setPosition(width / 2, centerY).setScale(scale);
      this.portraitHalo.clear();
      this.portraitHalo.fillStyle(0xffc8d8, 0.32);
      this.portraitHalo.fillCircle(width / 2, centerY, size * 0.58);
      this.portraitHalo.fillStyle(0xffffff, 0.14);
      this.portraitHalo.fillCircle(width / 2, centerY, size * 0.46);
      portraitBottom = centerY + size / 2 + 8;
    }

    this.topicText.setPosition(width / 2, portraitBottom + 18);
    this.lineText.setWordWrapWidth(Math.min(880, width - 32));
    this.lineText.setPosition(width / 2, portraitBottom + 80);
    this.feedbackText.setPosition(width / 2, Math.min(height - 148, height * 0.72));
    this.resultScoreText.setPosition(width / 2, Math.min(height - 112, height * 0.79));

    const gap = 10;
    const buttonWidth = Math.min(132, Math.floor((width - 48) / 3));
    const startX = (width - buttonWidth * 3 - gap * 2) / 2;
    const y = height - 76;
    this.choiceButtons.forEach((button, index) => {
      button.setPosition(startX + index * (buttonWidth + gap), y);
      button.scaleX = buttonWidth / button.buttonWidth;
    });
    this.resultButton.setPosition((width - this.resultButton.buttonWidth) / 2, height - 84);
    this.drawGauges();
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
    if (this.resultShown || this.lineIndex < 0) return;
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
    const y = this.scale.height * 0.77 - 8;
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
    const baseSize = this.scale.width < 430 ? 29 : 40;
    this.lineText.setFontSize(line.text.length > 16 ? baseSize - 6 : baseSize);
    this.lineText.setText(this.wrapText(line.text, this.scale.width < 430 ? 12 : 22));
    this.topicText.setText(line.weak ? `反応ポイント: ${line.cue}` : `観察: ${line.cue}`);
    this.lineStartedAt = this.time.now;
    this.lineDuration = line.weak ? 3800 : 3000;
    sfx.play("tick");
  }

  choose(choiceKey) {
    if (this.resultShown || this.choiceLocked) return;
    this.choiceLocked = true;
    const line = this.lines[this.lineIndex];
    const correct = line.weak && line.correct.includes(choiceKey);

    if (correct) {
      this.favor = Phaser.Math.Clamp(this.favor + 24, 0, 100);
      this.discomfort = Phaser.Math.Clamp(this.discomfort - 6, 0, 100);
      this.feedbackText.setText("刺さった。相手の文脈に合っている。");
      this.pulseFeedback("hit");
      sfx.play("hit");
    } else if (line.weak) {
      this.favor = Phaser.Math.Clamp(this.favor - 5, 0, 100);
      this.discomfort = Phaser.Math.Clamp(this.discomfort + 22, 0, 100);
      this.feedbackText.setText("ズレた。弱点ではなく不安を押している。");
      this.pulseFeedback("miss");
      sfx.play("miss");
    } else {
      this.favor = Phaser.Math.Clamp(this.favor + (choiceKey === "empathy" ? 7 : 1), 0, 100);
      this.discomfort = Phaser.Math.Clamp(this.discomfort + (choiceKey === "tsukkomi" ? 5 : 0), 0, 100);
      this.feedbackText.setText("観察フェーズ。急がず反応を見る。");
      this.pulseFeedback("watch");
      sfx.play("tick");
    }

    this.drawGauges();
    if (this.favor >= 100) {
      this.showFinal(true);
      return;
    }
    if (this.discomfort >= 100) {
      this.showFinal(false, true);
      return;
    }
    this.time.delayedCall(620, () => this.nextLine());
  }

  timeoutLine() {
    if (this.choiceLocked) return;
    this.choiceLocked = true;
    const line = this.lines[this.lineIndex];
    if (line.weak) {
      this.discomfort = Phaser.Math.Clamp(this.discomfort + 10, 0, 100);
      this.feedbackText.setText("タイミングを逃した。違和感が少し上がる。");
      this.pulseFeedback("timeout");
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
      title = "カフェ成功";
      body = "短く文脈に合わせた提案が通った。";
      this.resultBonus = 120;
      this.streakDelta = 2;
      outcomeTag = "カフェ成功";
      sfx.play("win");
    } else if (failedByDiscomfort || this.discomfort >= 100) {
      title = "失敗";
      body = "違和感が上がりすぎた。追わずに離れる。";
      this.resultBonus = 0;
      this.streakDelta = -this.streak;
      outcomeTag = "違和感で失敗";
      sfx.play("lose");
    } else if (this.favor >= 68) {
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
    this.lastOutcome = `${outcomeTag} 好${this.favor}/違${this.discomfort}`;
    const preview = this.previewScoreResult();

    this.topicText.setText(title);
    this.lineText.setFontSize(this.scale.width < 430 ? 30 : 42);
    this.lineText.setText(this.wrapText(body, this.scale.width < 430 ? 12 : 24));
    this.feedbackText.setText(`好感度 ${this.favor} / 違和感 ${this.discomfort}`);
    this.resultScoreText
      .setText(`獲得 +${preview.total} / 連続 ${this.streak} → ${preview.nextStreak}`)
      .setVisible(true);
    this.drawResultPanel(success, failedByDiscomfort);
    this.resultButton.setVisible(true);
    this.resultButton.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.resultButton.buttonWidth, this.resultButton.buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );
  }

  returnToField() {
    const { total, nextStreak } = this.previewScoreResult();
    this.scene.start("MainScene", {
      mapKey: this.mapKey,
      score: this.score + total,
      best: this.best,
      difficulty: this.difficulty.key,
      history: this.history,
      lastOutcome: `${this.lastOutcome || "中間"} +${total}`,
      streak: nextStreak,
      cleared: this.cleared,
      hotelEntered: this.hotelEntered,
      hotelReadyNotified: this.hotelReadyNotified,
    });
  }

  pulseFeedback(kind) {
    const color = {
      hit: "#57f5ff",
      miss: "#ff4d6d",
      watch: "#ffd24f",
      timeout: "#f5f1df",
    }[kind] || "#ffffff";
    const label = {
      hit: "HIT",
      miss: "MISS",
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
    const width = this.scale.width;
    const height = this.scale.height;
    const panelWidth = Math.min(width - 28, 540);
    const lineBounds = this.lineText.getBounds();
    const panelHeight = Math.min(170, Math.max(104, lineBounds.height + 42));
    const x = (width - panelWidth) / 2;
    const y = Math.max(110, Math.min(lineBounds.y - 18, height - panelHeight - 118));
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
    if (text.length <= maxChars) return text;
    const lines = [];
    for (let i = 0; i < text.length; i += maxChars) {
      lines.push(text.slice(i, i + maxChars));
    }
    return lines.join("\n");
  }
}
