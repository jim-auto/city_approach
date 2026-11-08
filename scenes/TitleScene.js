import { PLAYER_CAST_KEY, PLAYER_CAST_PATH, buildPlayerCast, playerForDifficulty } from "../player-appearance.js?v=20261108-calm1";
import { sfx } from "../sfx.js?v=20261108-calm1";
import { getBest, getDifficulty, cycleDifficulty } from "../storage.js?v=20261108-calm1";

const TUTORIAL_LINES = [
  "街を歩く  →  状態を見る  →  オープナーを選ぶ",
  "気になる相手へ近づいて、声をかける",
  "共感 / 状況いじり / 持ち物 / ユーモア賭け",
  "相手の話を聞く → 減点を避ける → 二人で決める",
  "無理にウケを狙わず、自然な返しでホテルへ",
];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload() {
    this.load.image("app-icon", "assets/app-icon.png");
    if (!this.textures.exists(PLAYER_CAST_KEY)) this.load.image(PLAYER_CAST_KEY, PLAYER_CAST_PATH);
  }

  create() {
    this.difficulty = getDifficulty();
    buildPlayerCast(this);
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
      .text(0, 0, "街で声をかけ、相手に合う返しを選ぶ。", {
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
        fontSize: "16px",
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
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));

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
    this.diffText.setText(`${this.difficulty.label} / ${this.difficulty.persona} ↻`);
    this.iconImage.setTexture(playerForDifficulty(this.difficulty.key).portraitKey);
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
    const landscape = w > h && h < 600;
    const mobile = w < 600 || landscape;
    if (landscape) {
      const left = w * 0.23;
      this.iconImage.setPosition(left, h * 0.28).setDisplaySize(86, 86);
      this.titleText.setPosition(left, h * 0.52).setFontSize(Math.min(30, w * 0.039));
      this.subText.setPosition(left, h * 0.68).setFontSize(12).setWordWrapWidth(w * 0.42);
      this.tutorialText.setPosition(w * 0.72, h * 0.25).setFontSize(w < 700 ? 11 : 14).setLineSpacing(5);
      this.bestText.setPosition(w * 0.72, h * 0.52).setFontSize(16);
      this.diffButton.setPosition(w * 0.72, h * 0.68);
      this.diffText.setPosition(w * 0.72, h * 0.68);
      this.startText.setPosition(w * 0.72, h - 25).setFontSize(20);
    } else {
      const iconSize = Math.min(104, h * 0.15);
      this.iconImage.setPosition(cx, h * 0.105).setDisplaySize(iconSize, iconSize);
      this.titleText.setPosition(cx, h * 0.235).setFontSize(Math.min(mobile ? 34 : 54, (w - 28) / 8.9));
      this.subText.setPosition(cx, h * 0.305).setFontSize(mobile ? 13 : 15).setWordWrapWidth(w - 32);
      this.tutorialText.setPosition(cx, h * 0.48).setFontSize(w < 360 ? 12 : mobile ? 14 : 17).setLineSpacing(8);
      this.bestText.setPosition(cx, h * 0.68).setFontSize(18);
      this.diffButton.setPosition(cx, h * 0.79);
      this.diffText.setPosition(cx, h * 0.79);
      this.startText.setPosition(cx, h - 30).setFontSize(22);
    }
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    sfx.play("success");
    this.scene.start("MainScene");
  }
}
