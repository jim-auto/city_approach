const WORLD = { width: 1280, height: 760 };

const MAPS = {
  nagoya: {
    key: "nagoya",
    label: "名古屋駅",
    period: "昼-夕方",
    baseBonus: 0.04,
    noisePenalty: 0.02,
    npcCount: 3,
    ambientCount: 8,
    playerStart: { x: 640, y: 440 },
    movement: "linear",
    tint: 0x23272f,
    lanes: [292, 372, 452, 548],
    stopPoints: [
      { x: 255, y: 370, label: "銀時計" },
      { x: 640, y: 515, label: "改札前" },
      { x: 1015, y: 370, label: "金時計" },
    ],
  },
  kabukicho: {
    key: "kabukicho",
    label: "歌舞伎町",
    period: "夜",
    baseBonus: -0.04,
    noisePenalty: 0.12,
    npcCount: 3,
    ambientCount: 17,
    playerStart: { x: 650, y: 575 },
    movement: "random",
    tint: 0x211423,
    lanes: [260, 360, 470, 575],
    stopPoints: [
      { x: 270, y: 295, label: "広場" },
      { x: 640, y: 405, label: "横断前" },
      { x: 1010, y: 290, label: "ネオン街" },
    ],
  },
};

const CHARACTER_TYPES = [
  {
    type: "待ち合わせ系",
    traits: ["立ち止まり", "スマホ", "待ち合わせ"],
    difficulty: "低",
    effective_actions: ["軽く", "状況ツッコミ"],
    bad_actions: ["長話", "距離詰め"],
    baseInterest: 52,
    flags: ["phone", "waiting"],
  },
  {
    type: "忙しい系",
    traits: ["スマホ", "歩くの速い", "外界遮断"],
    difficulty: "高",
    effective_actions: ["短く要点", "邪魔しない"],
    bad_actions: ["長話", "距離詰め"],
    baseInterest: 24,
    flags: ["busy", "fast", "phone"],
  },
  {
    type: "友達同伴系",
    traits: ["友達といる", "周囲を見る"],
    difficulty: "高",
    effective_actions: ["グループの邪魔をしない", "短く"],
    bad_actions: ["一人だけに強く行く", "距離詰め"],
    baseInterest: 22,
    flags: ["with_friend"],
  },
  {
    type: "目線あり系",
    traits: ["目が合う", "歩くの遅い"],
    difficulty: "中",
    effective_actions: ["軽く", "自然な提案"],
    bad_actions: ["強すぎる直球"],
    baseInterest: 58,
    flags: ["eye_contact"],
  },
  {
    type: "イヤホン系",
    traits: ["イヤホン", "外界遮断", "歩くの速い"],
    difficulty: "高",
    effective_actions: ["邪魔しない"],
    bad_actions: ["急に割り込む", "長話"],
    baseInterest: 18,
    flags: ["earphones", "busy"],
  },
  {
    type: "観光・迷い中系",
    traits: ["周囲を見る", "歩くの遅い", "観光中"],
    difficulty: "中",
    effective_actions: ["状況ツッコミ", "案内の提案"],
    bad_actions: ["強引", "距離詰め"],
    baseInterest: 42,
    flags: ["looking_around"],
  },
];

const MAP_TRAITS = {
  nagoya: ["改札前", "直線移動", "待ち合わせ"],
  kabukicho: ["ネオンに注意", "人混み", "夜の警戒"],
};

const TRAIT_RATE_MODS = {
  "目が合う": 0.16,
  "立ち止まり": 0.1,
  "待ち合わせ": 0.07,
  "周囲を見る": 0.04,
  "歩くの遅い": 0.05,
  "観光中": 0.03,
  "スマホ": -0.05,
  "歩くの速い": -0.13,
  "友達といる": -0.18,
  "イヤホン": -0.18,
  "外界遮断": -0.08,
  "人混み": -0.06,
  "夜の警戒": -0.07,
  "ネオンに注意": -0.03,
};

const ACTIONS = {
  soft: {
    label: "軽く",
    defaultMod: 0.01,
    traits: {
      "目が合う": 0.1,
      "立ち止まり": 0.08,
      "待ち合わせ": 0.05,
      "友達といる": -0.06,
      "イヤホン": -0.08,
    },
  },
  straight: {
    label: "ストレート",
    defaultMod: -0.03,
    traits: {
      "目が合う": 0.12,
      "歩くの速い": -0.12,
      "友達といる": -0.12,
      "イヤホン": -0.12,
      "スマホ": -0.04,
    },
  },
  situational: {
    label: "状況ツッコミ",
    defaultMod: 0.04,
    traits: {
      "スマホ": 0.06,
      "周囲を見る": 0.09,
      "観光中": 0.08,
      "ネオンに注意": 0.04,
      "立ち止まり": 0.04,
      "イヤホン": -0.08,
    },
  },
};

const FLAG_ICONS = {
  eye_contact: "◎",
  busy: "!",
  fast: ">>",
  with_friend: "2",
  phone: "□",
  earphones: "E",
  waiting: "W",
  looking_around: "?",
};

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    this.load.image("player", "assets/player.png");
    this.load.image("npc", "assets/npc.png");
    this.load.image("tiles", "assets/tiles.png");
  }

  create(data = {}) {
    this.currentMapKey = data.mapKey || "nagoya";
    this.score = data.score || 0;
    this.joystickVector = new Phaser.Math.Vector2();
    this.joystickPointerId = null;
    this.nearNpc = null;
    this.npcs = [];
    this.ambient = [];
    this.mapLabels = [];

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);

    this.tileBg = this.add
      .tileSprite(0, 0, WORLD.width, WORLD.height, "tiles")
      .setOrigin(0)
      .setDepth(-20);
    this.mapGraphics = this.add.graphics().setDepth(-10);
    this.nearRing = this.add.graphics().setDepth(5);

    this.player = this.physics.add
      .sprite(0, 0, "player")
      .setScale(1.6)
      .setDepth(10);
    this.player.body.setSize(22, 24).setOffset(5, 6);
    this.player.setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.createHud();
    this.buildMap();
    this.input.addPointer(3);
    this.registerJoystickInput();

    this.scale.on("resize", this.layoutHud, this);
    this.layoutHud();
  }

  buildMap() {
    const map = MAPS[this.currentMapKey];
    this.tileBg.setTint(map.tint);
    this.mapGraphics.clear();
    this.mapLabels.forEach((label) => label.destroy());
    this.mapLabels = [];
    this.npcs.forEach((npc) => {
      npc.sprite.destroy();
      npc.icons.destroy();
    });
    this.ambient.forEach((sprite) => sprite.destroy());
    this.npcs = [];
    this.ambient = [];

    if (map.key === "nagoya") {
      this.drawNagoyaMap();
    } else {
      this.drawKabukichoMap();
    }

    this.player.setPosition(map.playerStart.x, map.playerStart.y);
    this.spawnNpcs(map);
    this.spawnAmbient(map);
    this.showMessage(
      `${map.label}: 近づいて右下の声かけを選ぶ。相手のサインを見て無理なら離れる。`,
      2600
    );
  }

  drawNagoyaMap() {
    const g = this.mapGraphics;
    g.fillStyle(0x090b10, 1).fillRect(0, 0, WORLD.width, WORLD.height);
    g.fillStyle(0x181b22, 1).fillRect(120, 245, 1040, 280);
    g.fillStyle(0x2a2d35, 1).fillRect(120, 335, 1040, 22);
    g.fillStyle(0x2a2d35, 1).fillRect(120, 440, 1040, 22);
    g.lineStyle(2, 0xf5f1df, 0.13);
    for (let x = 160; x <= 1120; x += 80) {
      g.lineBetween(x, 245, x, 525);
    }
    for (let y = 260; y <= 510; y += 48) {
      g.lineStyle(1, 0xffffff, 0.05).lineBetween(120, y, 1160, y);
    }
    g.lineStyle(3, 0xf5f1df, 0.22).strokeRect(120, 245, 1040, 280);
    g.fillStyle(0x10131a, 1).fillRect(120, 210, 1040, 34);
    g.fillRect(120, 526, 1040, 40);
    g.fillStyle(0x1c2530, 1).fillRect(550, 565, 180, 75);
    g.lineStyle(2, 0xf5f1df, 0.18).strokeRect(550, 565, 180, 75);
    g.fillStyle(0x2b2118, 1).fillRect(185, 292, 130, 95);
    g.fillStyle(0x2f2a17, 1).fillRect(960, 292, 130, 95);
    g.lineStyle(3, 0xf5f1df, 0.32).strokeRect(185, 292, 130, 95);
    g.strokeRect(960, 292, 130, 95);
    this.addPixelFlecks(145, 260, 990, 240, 26, [0xf5f1df, 0x5e6674]);
    this.addMapLabel(255, 335, "銀時計", "#f5f1df", 18);
    this.addMapLabel(1015, 335, "金時計", "#f5f1df", 18);
    this.addMapLabel(640, 604, "改札前", "#f5f1df", 18);
    this.addMapLabel(640, 225, "中央コンコース", "#f5f1df", 17);
    this.drawStopMarkers(MAPS.nagoya.stopPoints, 0xf5f1df);
  }

  drawKabukichoMap() {
    const g = this.mapGraphics;
    g.fillStyle(0x05050a, 1).fillRect(0, 0, WORLD.width, WORLD.height);
    g.fillStyle(0x11131a, 1).fillRect(130, 205, 1020, 440);
    g.fillStyle(0x1c1f28, 1).fillRect(575, 205, 130, 440);
    g.fillStyle(0x1c1f28, 1).fillRect(130, 395, 1020, 120);
    g.lineStyle(2, 0xf5f1df, 0.42);
    for (let x = 585; x < 700; x += 22) {
      g.lineBetween(x, 405, x - 60, 510);
      g.lineBetween(x + 75, 405, x + 15, 510);
    }
    g.lineStyle(3, 0xf5f1df, 0.18).strokeRect(130, 205, 1020, 440);

    const buildings = [
      [155, 235, 160, 105, 0x171922, "BAR"],
      [360, 230, 155, 120, 0x1b1622, "GAME"],
      [735, 225, 165, 115, 0x142126, "KARAOKE"],
      [945, 232, 160, 110, 0x22161a, "FOOD"],
      [150, 545, 210, 85, 0x142026, "HOTEL"],
      [905, 545, 205, 85, 0x211822, "CLUB"],
    ];
    buildings.forEach(([x, y, w, h, color, label], index) => {
      g.fillStyle(color, 1).fillRect(x, y, w, h);
      g.lineStyle(3, 0xf5f1df, 0.24).strokeRect(x, y, w, h);
      g.lineStyle(3, index % 2 ? 0xffd24f : 0x57f5ff, 0.9);
      g.strokeRect(x + 8, y + 8, w - 16, 26);
      this.addMapLabel(x + w / 2, y + 21, label, "#f5f1df", 15);
    });

    g.fillStyle(0xff4d6d, 0.92).fillRect(520, 178, 240, 16);
    g.lineStyle(2, 0xf5f1df, 0.35).strokeRect(520, 178, 240, 16);
    this.addMapLabel(640, 184, "NEON STREET", "#ffffff", 15);
    this.addMapLabel(642, 457, "横断前", "#f5f1df", 17);
    this.drawStopMarkers(MAPS.kabukicho.stopPoints, 0xff4d6d);

    for (let i = 0; i < 44; i += 1) {
      const x = Phaser.Math.Between(150, 1130);
      const y = Phaser.Math.Between(215, 630);
      const color = Phaser.Math.RND.pick([0x57f5ff, 0xffd24f, 0xff4d6d, 0xf5f1df]);
      g.fillStyle(color, 0.68).fillRect(x, y, 4, 4);
    }
  }

  drawStopMarkers(points, color) {
    points.forEach((point) => {
      this.mapGraphics.lineStyle(2, color, 0.75).strokeCircle(point.x, point.y, 42);
    });
  }

  addMapLabel(x, y, text, color, size) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: `${size}px`,
        color,
      })
      .setOrigin(0.5)
      .setDepth(-4);
    this.mapLabels.push(label);
  }

  addPixelFlecks(x, y, width, height, count, colors) {
    for (let i = 0; i < count; i += 1) {
      const px = x + Phaser.Math.Between(0, width);
      const py = y + Phaser.Math.Between(0, height);
      const color = Phaser.Math.RND.pick(colors);
      this.mapGraphics.fillStyle(color, i % 3 === 0 ? 0.16 : 0.08).fillRect(px, py, 4, 4);
    }
  }

  spawnNpcs(map) {
    const usedStops = Phaser.Utils.Array.Shuffle([...map.stopPoints]);
    for (let i = 0; i < map.npcCount; i += 1) {
      const profile = this.makeProfile(map);
      const stop = usedStops[i % usedStops.length];
      const x =
        map.key === "nagoya"
          ? stop.x + Phaser.Math.Between(-35, 35)
          : Phaser.Math.Between(210, 1070);
      const y =
        map.key === "nagoya"
          ? stop.y + Phaser.Math.Between(-28, 28)
          : Phaser.Math.RND.pick(map.lanes) + Phaser.Math.Between(-30, 30);
      const sprite = this.add.sprite(x, y, "npc").setScale(1.45).setDepth(8);
      sprite.setTint(profile.flags.includes("with_friend") ? 0xffe07a : 0xffffff);
      const icons = this.add
        .text(x, y - 38, this.iconsFor(profile.flags), {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#ffffff",
          backgroundColor: "rgba(12, 14, 18, 0.72)",
          padding: { left: 4, right: 4, top: 2, bottom: 2 },
        })
        .setOrigin(0.5)
        .setDepth(12);

      this.npcs.push({
        sprite,
        icons,
        profile,
        dir: Phaser.Math.RND.pick([-1, 1]),
        speed: map.key === "nagoya" ? Phaser.Math.Between(38, 62) : Phaser.Math.Between(22, 58),
        lane: Phaser.Math.RND.pick(map.lanes),
        nextTurnAt: 0,
        vx: Phaser.Math.FloatBetween(-1, 1),
        vy: Phaser.Math.FloatBetween(-1, 1),
        disabled: false,
      });
    }
  }

  makeProfile(map) {
    const base = Phaser.Math.RND.pick(CHARACTER_TYPES);
    const mapTrait = Phaser.Math.RND.pick(MAP_TRAITS[map.key]);
    const extraTrait =
      map.key === "kabukicho"
        ? Phaser.Math.RND.pick(["人混み", "夜の警戒", "ネオンに注意"])
        : Phaser.Math.RND.pick(["改札前", "直線移動", "待ち合わせ"]);
    const traits = Array.from(new Set([...base.traits, mapTrait, extraTrait]));
    const flags = Array.from(new Set([...base.flags]));
    if (traits.includes("人混み")) flags.push("busy");
    if (traits.includes("歩くの速い")) flags.push("fast");
    if (traits.includes("目が合う")) flags.push("eye_contact");

    const interest = Phaser.Math.Clamp(
      base.baseInterest + Phaser.Math.Between(-10, 16) + (map.key === "nagoya" ? 5 : -4),
      5,
      96
    );

    return {
      type: base.type,
      traits,
      difficulty: base.difficulty,
      effective_actions: base.effective_actions,
      bad_actions: base.bad_actions,
      interest,
      flags,
    };
  }

  spawnAmbient(map) {
    for (let i = 0; i < map.ambientCount; i += 1) {
      const sprite = this.add
        .sprite(Phaser.Math.Between(150, 1130), Phaser.Math.RND.pick(map.lanes), "npc")
        .setScale(1.08)
        .setDepth(6)
        .setAlpha(map.key === "kabukicho" ? 0.42 : 0.32)
        .setTint(map.key === "kabukicho" ? Phaser.Math.RND.pick([0x57f5ff, 0xffd24f, 0xff6f8f]) : 0xd8d8d8);
      sprite.dir = Phaser.Math.RND.pick([-1, 1]);
      sprite.speed = Phaser.Math.Between(30, map.key === "kabukicho" ? 82 : 58);
      sprite.nextTurnAt = 0;
      sprite.vx = Phaser.Math.FloatBetween(-1, 1);
      sprite.vy = Phaser.Math.FloatBetween(-1, 1);
      this.ambient.push(sprite);
    }
  }

  iconsFor(flags) {
    return flags
      .filter((flag) => FLAG_ICONS[flag])
      .slice(0, 3)
      .map((flag) => FLAG_ICONS[flag])
      .join(" ");
  }

  createHud() {
    this.infoText = this.add
      .text(16, 14, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "rgba(17,18,23,0.72)",
        padding: { left: 10, right: 10, top: 7, bottom: 7 },
      })
      .setScrollFactor(0)
      .setDepth(50);

    this.messageBg = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.messageText = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 620, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(51)
      .setVisible(false);

    this.mapButton = this.createHudButton("街切替", () => this.switchMap(), 118, 46, 0x223340);
    this.actionButtons = [
      this.createHudButton("軽く", () => this.tryApproach("soft"), 148, 52, 0x204a42),
      this.createHudButton("ストレート", () => this.tryApproach("straight"), 148, 52, 0x51323d),
      this.createHudButton("状況ツッコミ", () => this.tryApproach("situational"), 148, 52, 0x33405a),
    ];

    this.joystickBase = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.joystickThumb = this.add.graphics().setScrollFactor(0).setDepth(51);
  }

  createHudButton(label, onClick, width, height, fillColor) {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(54);
    const bg = this.add.graphics();
    const text = this.add
      .text(width / 2, height / 2, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: label.length >= 6 ? "15px" : "18px",
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
    container.redraw = (enabled = true) => {
      bg.clear();
      bg.fillStyle(fillColor, enabled ? 0.92 : 0.34);
      bg.fillRoundedRect(0, 0, width, height, 8);
      bg.lineStyle(2, 0xffffff, enabled ? 0.38 : 0.16);
      bg.strokeRoundedRect(0, 0, width, height, 8);
    };
    container.redraw(true);
    return container;
  }

  layoutHud() {
    const width = this.scale.width;
    const height = this.scale.height;
    this.infoText.setPosition(16, 14);
    this.mapButton.setPosition(width - this.mapButton.buttonWidth - 14, 14);

    const buttonX = width - 160;
    const totalButtonHeight = 52 * this.actionButtons.length + 8 * (this.actionButtons.length - 1);
    const startY = Math.max(84, height - totalButtonHeight - 18);
    this.actionButtons.forEach((button, index) => {
      button.setPosition(buttonX, startY + index * 60);
    });

    this.joystickCenter = {
      x: Math.max(78, Math.min(96, width * 0.23)),
      y: height - 88,
    };
    this.drawJoystick();

    this.messageText.setWordWrapWidth(Math.min(640, width - 28));
    this.messageText.setPosition(width / 2, width < 430 ? 118 : 96);
    this.drawMessageBox();
  }

  drawJoystick() {
    const { x, y } = this.joystickCenter;
    const thumbX = x + this.joystickVector.x * 32;
    const thumbY = y + this.joystickVector.y * 32;
    this.joystickBase.clear();
    this.joystickBase.fillStyle(0x0f1218, 0.55).fillCircle(x, y, 58);
    this.joystickBase.lineStyle(3, 0xffffff, 0.24).strokeCircle(x, y, 58);
    this.joystickThumb.clear();
    this.joystickThumb.fillStyle(0xffffff, 0.58).fillCircle(thumbX, thumbY, 25);
    this.joystickThumb.lineStyle(2, 0x10131a, 0.4).strokeCircle(thumbX, thumbY, 25);
  }

  drawMessageBox() {
    if (!this.messageText.visible) return;
    const bounds = this.messageText.getBounds();
    this.messageBg.clear();
    this.messageBg.fillStyle(0x10131a, 0.82);
    this.messageBg.fillRoundedRect(bounds.x - 14, bounds.y - 10, bounds.width + 28, bounds.height + 20, 8);
    this.messageBg.lineStyle(2, 0xffffff, 0.18);
    this.messageBg.strokeRoundedRect(bounds.x - 14, bounds.y - 10, bounds.width + 28, bounds.height + 20, 8);
  }

  registerJoystickInput() {
    this.input.on("pointerdown", (pointer) => {
      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.joystickCenter.x,
        this.joystickCenter.y
      );
      if (dist <= 78 && this.joystickPointerId === null) {
        this.joystickPointerId = pointer.id;
        this.updateJoystick(pointer);
      }
    });

    this.input.on("pointermove", (pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.updateJoystick(pointer);
      }
    });

    this.input.on("pointerup", (pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.joystickPointerId = null;
        this.joystickVector.set(0, 0);
        this.drawJoystick();
      }
    });
  }

  updateJoystick(pointer) {
    const dx = pointer.x - this.joystickCenter.x;
    const dy = pointer.y - this.joystickCenter.y;
    const vector = new Phaser.Math.Vector2(dx, dy);
    const length = Math.min(vector.length(), 48);
    if (vector.length() > 0) {
      vector.normalize().scale(length / 48);
    }
    this.joystickVector.copy(vector);
    this.drawJoystick();
  }

  update(time, delta) {
    if (!this.player) return;
    const speed = 170;
    this.player.setVelocity(this.joystickVector.x * speed, this.joystickVector.y * speed);
    this.updateNpcs(time, delta);
    this.updateNearestNpc();
    this.updateHud();
  }

  updateNpcs(time, delta) {
    const map = MAPS[this.currentMapKey];
    const dt = delta / 1000;
    this.npcs.forEach((npc) => {
      if (npc.disabled || npc.profile.flags.includes("waiting")) {
        npc.icons.setPosition(npc.sprite.x, npc.sprite.y - 38);
        return;
      }
      if (map.movement === "linear") {
        npc.sprite.x += npc.dir * npc.speed * dt;
        npc.sprite.y += (npc.lane - npc.sprite.y) * 0.03;
        if (npc.sprite.x < 145 || npc.sprite.x > 1135) npc.dir *= -1;
      } else {
        if (time > npc.nextTurnAt) {
          npc.nextTurnAt = time + Phaser.Math.Between(800, 1800);
          npc.vx = Phaser.Math.FloatBetween(-1, 1);
          npc.vy = Phaser.Math.FloatBetween(-0.7, 0.7);
        }
        npc.sprite.x += npc.vx * npc.speed * dt;
        npc.sprite.y += npc.vy * npc.speed * dt;
        if (npc.sprite.x < 150 || npc.sprite.x > 1130) npc.vx *= -1;
        if (npc.sprite.y < 215 || npc.sprite.y > 630) npc.vy *= -1;
      }
      npc.icons.setPosition(npc.sprite.x, npc.sprite.y - 38);
    });

    this.ambient.forEach((sprite) => {
      if (map.movement === "linear") {
        sprite.x += sprite.dir * sprite.speed * dt;
        if (sprite.x < 120) sprite.x = 1160;
        if (sprite.x > 1160) sprite.x = 120;
      } else {
        if (time > sprite.nextTurnAt) {
          sprite.nextTurnAt = time + Phaser.Math.Between(500, 1500);
          sprite.vx = Phaser.Math.FloatBetween(-1, 1);
          sprite.vy = Phaser.Math.FloatBetween(-0.8, 0.8);
        }
        sprite.x += sprite.vx * sprite.speed * dt;
        sprite.y += sprite.vy * sprite.speed * dt;
        if (sprite.x < 140 || sprite.x > 1140) sprite.vx *= -1;
        if (sprite.y < 210 || sprite.y > 640) sprite.vy *= -1;
      }
    });
  }

  updateNearestNpc() {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    this.npcs.forEach((npc) => {
      if (npc.disabled) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y);
      if (dist < nearestDistance) {
        nearest = npc;
        nearestDistance = dist;
      }
    });

    this.nearNpc = nearestDistance <= 88 ? nearest : null;
    this.nearRing.clear();
    if (this.nearNpc) {
      this.nearRing.lineStyle(3, 0xffffff, 0.68).strokeCircle(this.nearNpc.sprite.x, this.nearNpc.sprite.y, 34);
    }
  }

  updateHud() {
    const map = MAPS[this.currentMapKey];
    const nearText = this.nearNpc
      ? `${this.nearNpc.profile.type} / 興味${this.nearNpc.profile.interest}`
      : "近くの相手なし";
    this.infoText.setText(`${map.label} ${map.period}\nScore ${this.score} / ${nearText}`);
    this.actionButtons.forEach((button) => button.redraw(Boolean(this.nearNpc)));
  }

  tryApproach(actionKey) {
    if (!this.nearNpc) {
      this.showMessage("まだ距離が遠い。進路をふさがない位置まで近づく。", 1500);
      return;
    }

    const target = this.nearNpc;
    const rate = this.calculateSuccessRate(target.profile, actionKey);
    const roll = Math.random();
    const actionLabel = ACTIONS[actionKey].label;

    if (roll <= rate) {
      this.player.setVelocity(0, 0);
      this.showMessage(`${actionLabel}: 反応あり。会話へ。`, 650);
      this.time.delayedCall(520, () => {
        this.scene.start("TalkScene", {
          profile: target.profile,
          mapKey: this.currentMapKey,
          score: this.score,
        });
      });
      return;
    }

    target.disabled = true;
    target.sprite.setAlpha(0.35);
    target.icons.setAlpha(0.25);
    this.showMessage(`スルーされた。${this.feedbackFor(target.profile, actionKey)} 成功率${Math.round(rate * 100)}%`, 2300);
  }

  calculateSuccessRate(profile, actionKey) {
    const map = MAPS[this.currentMapKey];
    const action = ACTIONS[actionKey];
    let rate = 0.3 + map.baseBonus - map.noisePenalty + (profile.interest - 50) / 190;
    profile.traits.forEach((trait) => {
      rate += TRAIT_RATE_MODS[trait] || 0;
      rate += action.traits[trait] || 0;
    });
    rate += action.defaultMod;

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.nearNpc.sprite.x,
      this.nearNpc.sprite.y
    );
    if (distance < 28) rate -= 0.08;
    if (distance > 62) rate -= 0.04;
    return Phaser.Math.Clamp(rate, 0.04, 0.86);
  }

  feedbackFor(profile, actionKey) {
    if (profile.traits.includes("イヤホン")) return "外界遮断のサインが強い。声量より距離感を優先。";
    if (profile.traits.includes("友達といる")) return "同伴中は防御が高い。グループの流れを切らない。";
    if (profile.traits.includes("歩くの速い")) return "歩行速度が速く、急ぎの可能性が高い。";
    if (actionKey === "straight") return "直球が強すぎた。短く軽い入りが向く場面だった。";
    if (profile.traits.includes("スマホ")) return "注意がスマホに分散していた。状況を見て一言で切る。";
    return "反応が薄いので追わずに離れた。";
  }

  showMessage(text, duration = 1800) {
    const maxChars = this.scale.width < 430 ? 17 : 42;
    this.messageText.setText(this.wrapText(text, maxChars)).setVisible(true);
    this.drawMessageBox();
    this.messageTimer?.remove(false);
    this.messageTimer = this.time.delayedCall(duration, () => {
      this.messageText.setVisible(false);
      this.messageBg.clear();
    });
  }

  wrapText(text, maxChars) {
    if (text.length <= maxChars) return text;
    const lines = [];
    for (let i = 0; i < text.length; i += maxChars) {
      lines.push(text.slice(i, i + maxChars));
    }
    return lines.join("\n");
  }

  switchMap() {
    const next = this.currentMapKey === "nagoya" ? "kabukicho" : "nagoya";
    this.scene.restart({ mapKey: next, score: this.score });
  }
}
