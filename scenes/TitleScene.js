import { sfx } from "../sfx.js";
import { getBest, getDifficulty, cycleDifficulty } from "../storage.js";

const TUTORIAL_LINES = [
  "街を歩く  →  状態を見る  →  オープナーを選ぶ",
  "防御サインが強い相手は「離れる」が正解",
  "共感 / 状況いじり / 持ち物 / ユーモア賭け",
  "会話では 共感 / ツッコミ / 提案 を選択",
  "Goal 500点で CITY CLEAR",
];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload() {
    this.load.image("app-icon", "assets/app-icon.png");
  }

  create() {
    this.difficulty = getDifficulty();
    this.best = getBest();
    this.started = false;

    this.bg = this.add.graphics().setDepth(-10);
    this.iconImage = this.add.image(0, 0, "app-icon").setOrigin(0.5);
    this.titleText = this.add
      .text(0, 0, "CITY APPROACH", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "54px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.subText = this.add
      .text(0, 0, "街で相手のサインを読む。無理なら離れる。", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#cfd3da",
        align: "center",
        wordWrap: { width: 640, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.tutorialText = this.add
      .text(0, 0, TUTORIAL_LINES.join("\n"), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#e3e7ef",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    this.bestText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#57f5ff",
      })
      .setOrigin(0.5);
    this.diffText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: "#ffd24f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.startText = this.add
      .text(0, 0, "タップで開始", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.diffButton = this.add.rectangle(0, 0, 240, 48, 0x3b3248, 0.96).setStrokeStyle(2, 0xffffff, 0.45).setDepth(1);
    this.diffButton.setInteractive({ useHandCursor: true });
    this.diffButton.on("pointerdown", (pointer, _lx, _ly, event) => {
      event?.stopPropagation?.();
      this.difficulty = cycleDifficulty(this.difficulty.key);
      this.refreshTexts();
      sfx.play("tick");
    });
    this.input.on("pointerdown", () => this.startGame());
    this.input.keyboard?.on("keydown", () => this.startGame());
    this.scale.on("resize", this.layout, this);

    this.tweens.add({
      targets: this.startText,
      alpha: 0.35,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.refreshTexts();
    this.layout();
  }

  refreshTexts() {
    this.bestText.setText(`Best ${this.best}`);
    this.diffText.setText(`難度: ${this.difficulty.label}`);
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.bg.clear();
    this.bg.fillStyle(0x05060a, 1).fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i += 1) {
      const px = (i * 97 + 13) % w;
      const py = (i * 53 + 29) % h;
      this.bg.fillStyle(i % 2 ? 0x57f5ff : 0xff4d6d, 0.35).fillRect(px, py, 3, 3);
    }

    const cx = w / 2;
    const mobile = w < 430;
    const iconSize = Math.min(mobile ? 104 : 132, h * 0.17);
    this.iconImage
      .setPosition(cx, h * 0.105)
      .setDisplaySize(iconSize, iconSize);
    this.titleText.setPosition(cx, h * 0.235).setFontSize(mobile ? 34 : 54);
    this.subText.setPosition(cx, h * 0.305).setWordWrapWidth(Math.min(640, w - 40));
    this.tutorialText.setPosition(cx, h * 0.46).setFontSize(mobile ? 14 : 17);
    this.bestText.setPosition(cx, h * 0.68);
    this.diffButton.setPosition(cx, h * 0.79);
    this.diffText.setPosition(cx, h * 0.79);
    this.startText.setPosition(cx, h * 0.93);
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    sfx.play("success");
    this.scene.start("MainScene");
  }
}
