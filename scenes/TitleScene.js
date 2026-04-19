import { sfx } from "../sfx.js";
import { getBest, getDifficulty, cycleDifficulty } from "../storage.js";

const TUTORIAL_LINES = [
  "【あそびかた】",
  "・左下のジョイスティックで街を歩く",
  "・NPCに近づくとサイン（アイコン）が見える",
  "・右下の声かけ op を選ぶ",
  "　お天気op：立ち止まり/目が合う向け",
  "　服装op：目が合う+立ち止まりに強い",
  "　小物op：スマホ/観光中の人に刺さる",
  "　ネタop：目が合う/友達同伴向け、警戒はNG",
  "　離れる：防御サインが強いときの正解",
  "・成功すると会話バトル（共感/ツッコミ/提案）",
  "・右上の街切替で名古屋駅⇄歌舞伎町",
];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create() {
    this.difficulty = getDifficulty();
    this.best = getBest();
    this.started = false;

    this.bg = this.add.graphics().setDepth(-10);
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
        fontSize: "13px",
        color: "#e3e7ef",
        align: "left",
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
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
      })
      .setOrigin(0.5);
    this.startText = this.add
      .text(0, 0, "タップで開始", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.diffButton = this.add.rectangle(0, 0, 220, 44, 0x2f2a3a, 0.86).setStrokeStyle(2, 0xffffff, 0.32);
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
    this.diffText.setText(`難度: ${this.difficulty.label}（タップで切替）`);
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
    this.titleText.setPosition(cx, h * 0.1).setFontSize(mobile ? 34 : 52);
    this.subText.setPosition(cx, h * 0.17).setWordWrapWidth(Math.min(640, w - 40));
    this.tutorialText.setPosition(cx, h * 0.24).setFontSize(mobile ? 12 : 15);
    this.bestText.setPosition(cx, h * 0.7);
    this.diffButton.setPosition(cx, h * 0.78);
    this.diffText.setPosition(cx, h * 0.78);
    this.startText.setPosition(cx, h * 0.9);
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    sfx.play("success");
    this.scene.start("MainScene");
  }
}
