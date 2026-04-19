import { sfx } from "../sfx.js";
import { getBest, setBest, getDifficulty, cycleDifficulty, getSpriteMode } from "../storage.js";
import { buildCharacterTextures, registerCharacterAnimations } from "../characters.js";

const NPC_VARIANT_KEYS = {
  "待ち合わせ系": "npc-waiting",
  "忙しい系": "npc-busy",
  "友達同伴系": "npc-friends",
  "目線あり系": "npc-eye",
  "イヤホン系": "npc-earphones",
  "観光・迷い中系": "npc-tourist",
};
const AMBIENT_VARIANTS = [
  "npc-waiting",
  "npc-busy",
  "npc-friends",
  "npc-eye",
  "npc-earphones",
  "npc-tourist",
];

const WORLD = { width: 760, height: 1280 };

const MAPS = {
  nagoya: {
    key: "nagoya",
    label: "名古屋駅",
    period: "昼-夕方",
    baseBonus: 0.04,
    noisePenalty: 0.02,
    npcCount: 3,
    ambientCount: 8,
    playerStart: { x: 380, y: 640 },
    movement: "vertical",
    tint: 0x23272f,
    lanes: [285, 345, 405, 465],
    stopPoints: [
      { x: 380, y: 380, label: "銀時計" },
      { x: 380, y: 640, label: "改札前" },
      { x: 380, y: 970, label: "金時計" },
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
    playerStart: { x: 380, y: 640 },
    movement: "random",
    tint: 0x211423,
    lanes: [220, 340, 430, 540],
    stopPoints: [
      { x: 380, y: 540, label: "TOHO前" },
      { x: 380, y: 760, label: "横断前" },
      { x: 380, y: 1050, label: "ネオン街" },
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
  weather: {
    label: "お天気op",
    defaultMod: 0.01,
    traits: {
      "目が合う": 0.08,
      "立ち止まり": 0.10,
      "待ち合わせ": 0.08,
      "歩くの速い": -0.08,
      "イヤホン": -0.10,
      "外界遮断": -0.06,
    },
  },
  outfit: {
    label: "服装op",
    defaultMod: 0.03,
    traits: {
      "目が合う": 0.12,
      "立ち止まり": 0.10,
      "観光中": 0.08,
      "歩くの速い": -0.10,
      "友達といる": -0.08,
      "スマホ": -0.06,
    },
  },
  item: {
    label: "小物op",
    defaultMod: 0.02,
    traits: {
      "スマホ": 0.08,
      "観光中": 0.10,
      "周囲を見る": 0.09,
      "目が合う": 0.06,
      "立ち止まり": 0.04,
      "歩くの速い": -0.08,
      "イヤホン": -0.06,
    },
  },
  joke: {
    label: "ネタop",
    defaultMod: -0.02,
    traits: {
      "目が合う": 0.12,
      "友達といる": 0.08,
      "立ち止まり": 0.04,
      "夜の警戒": -0.08,
      "外界遮断": -0.10,
      "歩くの速い": -0.10,
      "人混み": -0.05,
    },
  },
};

const FLAG_ICON_COLOR = {
  eye_contact:   0x57f5ff,
  busy:          0xffa857,
  fast:          0xffd24f,
  with_friend:   0xff6f8f,
  phone:         0x9cb8ff,
  earphones:     0xffd24f,
  waiting:       0xf5f1df,
  looking_around: 0xff4dd2,
};

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    this.load.image("tiles", "assets/tiles.png");
    this.load.image("ai_player_raw", "assets/ai/player.png");
    this.load.image("ai_npc_waiting_raw", "assets/ai/npc-waiting.png");
    this.load.image("ai_npc_busy_raw", "assets/ai/npc-busy.png");
    this.load.image("ai_npc_friends_raw", "assets/ai/npc-friends.png");
    this.load.image("ai_npc_eye_raw", "assets/ai/npc-eye.png");
    this.load.image("ai_npc_earphones_raw", "assets/ai/npc-earphones.png");
    this.load.image("ai_npc_tourist_raw", "assets/ai/npc-tourist.png");
  }

  create(data = {}) {
    this.currentMapKey = data.mapKey || "nagoya";
    this.score = data.score || 0;
    this.best = Math.max(getBest(), this.score);
    this.difficulty = getDifficulty();
    this.spriteMode = getSpriteMode().key;
    this.history = Array.isArray(data.history) ? data.history.slice(-3) : [];
    if (data.lastOutcome) this.pushHistory(data.lastOutcome);
    this.joystickVector = new Phaser.Math.Vector2();
    this.joystickPointerId = null;
    this.nearNpc = null;
    this.npcs = [];
    this.ambient = [];
    this.mapLabels = [];

    buildCharacterTextures(this);
    registerCharacterAnimations(this);

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);

    this.tileBg = this.add
      .tileSprite(0, 0, WORLD.width, WORLD.height, "tiles")
      .setOrigin(0)
      .setDepth(-20);
    this.mapGraphics = this.add.graphics().setDepth(-10);
    this.nearRing = this.add.graphics().setDepth(5);

    this.player = this.physics.add
      .sprite(0, 0, "player-0")
      .setScale(1.6)
      .setDepth(10);
    this.player.body.setSize(14, 20).setOffset(9, 10);
    this.player.setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.createHud();
    this.buildMap();
    this.input.addPointer(3);
    this.registerJoystickInput();

    this.scale.on("resize", this.layoutHud, this);
    this.layoutHud();
    this.updateBest();
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
    // Vertical concourse
    g.fillStyle(0x181b22, 1).fillRect(240, 120, 280, 1040);
    // Two decorative horizontal seams across the floor
    g.fillStyle(0x2a2d35, 1).fillRect(240, 430, 280, 22);
    g.fillStyle(0x2a2d35, 1).fillRect(240, 830, 280, 22);
    // Lane stripes (vertical) + subtle horizontal gridlines
    g.lineStyle(2, 0xf5f1df, 0.13);
    for (let y = 160; y <= 1120; y += 80) {
      g.lineBetween(240, y, 520, y);
    }
    for (let x = 260; x <= 500; x += 48) {
      g.lineStyle(1, 0xffffff, 0.05).lineBetween(x, 120, x, 1160);
    }
    g.lineStyle(3, 0xf5f1df, 0.22).strokeRect(240, 120, 280, 1040);
    // Entrance bands (top and bottom of concourse)
    g.fillStyle(0x10131a, 1).fillRect(210, 120, 34, 1040);
    g.fillRect(516, 120, 40, 1040);
    // Ticket gate (middle, horizontal box extending left)
    g.fillStyle(0x1c2530, 1).fillRect(75, 600, 165, 90);
    g.lineStyle(2, 0xf5f1df, 0.18).strokeRect(75, 600, 165, 90);
    this.sprinkleTileVariants(
      240,
      120,
      280,
      1040,
      [
        { color: 0x090b10, alpha: 0.55 },
        { color: 0x23272f, alpha: 0.35, dot: 0xf5f1df },
        { color: 0xf5f1df, alpha: 0.05, dot: 0xf5f1df },
        { color: 0x44321c, alpha: 0.28 },
      ],
      0.11,
      10
    );
    // Silver clock tower (top)
    this.drawClockTower(380, 300, {
      main: 0xc0c6d0,
      dark: 0x4a5058,
      accent: 0xeaf0f5,
      faceBg: 0xfaf4de,
      hand: 0x1a1d24,
    });
    // Gold clock tower (bottom)
    this.drawClockTower(380, 1125, {
      main: 0xd4a94a,
      dark: 0x6b4824,
      accent: 0xffd780,
      faceBg: 0xfaf4de,
      hand: 0x2a1a0a,
    });
    this.addPixelFlecks(248, 140, 264, 1000, 20, [0xf5f1df, 0x5e6674]);
    this.addMapLabel(380, 340, "銀時計", "#c0c6d0", 18);
    this.addMapLabel(380, 1170, "金時計", "#d4a94a", 18);
    this.addMapLabel(157, 644, "改札前", "#f5f1df", 18);
    this.addMapLabel(380, 140, "中央コンコース", "#f5f1df", 16);
    this.drawStopMarkers(MAPS.nagoya.stopPoints, 0xf5f1df);
  }

  drawClockTower(cx, baseY, colors) {
    const g = this.mapGraphics;
    const { main, dark, accent, faceBg, hand } = colors;
    // Wide base
    g.fillStyle(dark, 1).fillRect(cx - 42, baseY - 2, 84, 6);
    g.fillStyle(main, 1).fillRect(cx - 38, baseY - 6, 76, 4);
    g.fillStyle(accent, 0.8).fillRect(cx - 36, baseY - 6, 72, 1);
    // Mid base
    g.fillStyle(main, 1).fillRect(cx - 28, baseY - 12, 56, 6);
    g.fillStyle(dark, 1).fillRect(cx - 28, baseY - 7, 56, 1);
    // Column
    g.fillStyle(dark, 1).fillRect(cx - 10, baseY - 46, 20, 34);
    g.fillStyle(main, 1).fillRect(cx - 8, baseY - 46, 16, 34);
    g.fillStyle(accent, 0.7).fillRect(cx - 7, baseY - 45, 2, 32);
    // Clock face (circle)
    const faceY = baseY - 68;
    g.fillStyle(dark, 1).fillCircle(cx, faceY, 24);
    g.fillStyle(main, 1).fillCircle(cx, faceY, 22);
    g.fillStyle(faceBg, 1).fillCircle(cx, faceY, 18);
    // Hour marks at 12/3/6/9
    g.fillStyle(dark, 1);
    g.fillRect(cx - 1, faceY - 17, 2, 4);
    g.fillRect(cx + 13, faceY - 1, 4, 2);
    g.fillRect(cx - 1, faceY + 13, 2, 4);
    g.fillRect(cx - 17, faceY - 1, 4, 2);
    // Hour hand (short, 2 o'clock) and minute hand (long, 12)
    g.lineStyle(2, hand, 1);
    g.lineBetween(cx, faceY, cx + 7, faceY - 6);
    g.lineStyle(2, hand, 1);
    g.lineBetween(cx, faceY, cx, faceY - 14);
    // Center dot
    g.fillStyle(accent, 1).fillCircle(cx, faceY, 2);
    // Top ornament
    g.fillStyle(main, 1).fillRect(cx - 3, faceY - 27, 6, 3);
    g.fillStyle(accent, 1).fillRect(cx - 1, faceY - 31, 2, 4);
  }

  drawKabukichoMap() {
    const g = this.mapGraphics;
    g.fillStyle(0x05050a, 1).fillRect(0, 0, WORLD.width, WORLD.height);
    // Main nightlife area (below the TOHO landmark)
    g.fillStyle(0x11131a, 1).fillRect(60, 510, 640, 640);
    // Central plaza road (walking path below TOHO)
    g.fillStyle(0x1c1f28, 1).fillRect(270, 510, 220, 640);
    // Crosswalk band in the middle
    g.fillStyle(0x1c1f28, 1).fillRect(60, 720, 640, 100);
    this.sprinkleTileVariants(
      60,
      510,
      640,
      640,
      [
        { color: 0x05060a, alpha: 0.55 },
        { color: 0x2a1b2d, alpha: 0.45, dot: 0xff4d6d },
        { color: 0x152430, alpha: 0.45, dot: 0x57f5ff },
        { color: 0xffd24f, alpha: 0.08 },
      ],
      0.13,
      10
    );
    // Crosswalk stripes (diagonal for depth)
    g.lineStyle(2, 0xf5f1df, 0.42);
    for (let y = 735; y < 820; y += 22) {
      g.lineBetween(290, y, 470, y + 10);
    }
    g.lineStyle(3, 0xf5f1df, 0.18).strokeRect(60, 510, 640, 640);

    // ===== TOHO ビル (central landmark, Shinjuku's iconic building) =====
    this.drawTohoBuilding(380, 488);

    // Flanking neon buildings around TOHO (upper half of the map)
    const upperBuildings = [
      [55, 190, 155, 150, 0x171922, "BAR"],
      [550, 190, 155, 150, 0x1b1622, "GAME"],
      [55, 350, 155, 140, 0x142126, "KARAOKE"],
      [550, 350, 155, 140, 0x22161a, "FOOD"],
    ];
    const lowerBuildings = [
      [70, 520, 185, 150, 0x142026, "HOTEL"],
      [505, 520, 185, 150, 0x211822, "CLUB"],
      [70, 870, 185, 150, 0x191521, "LIVE"],
      [505, 870, 185, 150, 0x221821, "KARA"],
      [70, 1040, 185, 110, 0x191a28, "RAMEN"],
      [505, 1040, 185, 110, 0x221a22, "DON"],
    ];
    [...upperBuildings, ...lowerBuildings].forEach(([x, y, w, h, color, label], index) => {
      g.fillStyle(color, 1).fillRect(x, y, w, h);
      g.lineStyle(3, 0xf5f1df, 0.24).strokeRect(x, y, w, h);
      g.lineStyle(3, index % 2 ? 0xffd24f : 0x57f5ff, 0.9);
      g.strokeRect(x + 8, y + 8, w - 16, 26);
      this.addMapLabel(x + w / 2, y + 21, label, "#f5f1df", 15);
      // Tiny window glow dots on flanking buildings
      for (let wy = y + 40; wy < y + h - 10; wy += 14) {
        for (let wx = x + 14; wx < x + w - 10; wx += 18) {
          if (((wx + wy) * 37) % 100 < 62) {
            g.fillStyle(0xfada50, 0.55).fillRect(wx, wy, 3, 5);
          }
        }
      }
    });

    this.addMapLabel(380, 785, "横断前", "#f5f1df", 17);
    this.drawStopMarkers(MAPS.kabukicho.stopPoints, 0xff4d6d);

    // Neon particles scattered across the whole map
    for (let i = 0; i < 70; i += 1) {
      const x = Phaser.Math.Between(70, 690);
      const y = Phaser.Math.Between(140, 1140);
      const color = Phaser.Math.RND.pick([0x57f5ff, 0xffd24f, 0xff4d6d, 0xf5f1df]);
      g.fillStyle(color, 0.68).fillRect(x, y, 4, 4);
    }
  }

  drawTohoBuilding(cx, baseY) {
    const g = this.mapGraphics;
    // --- Godzilla head silhouette on the rooftop (above the building) ---
    this.drawGodzillaHead(cx + 30, 165);
    // --- Building body ---
    const bx = cx - 120;
    const by = 180;
    const bw = 240;
    const bh = baseY - by;
    g.fillStyle(0x14141a, 1).fillRect(bx, by, bw, bh);
    g.lineStyle(3, 0xf5f1df, 0.28).strokeRect(bx, by, bw, bh);
    g.fillStyle(0x1e2028, 1).fillRect(bx + 6, by + 6, bw - 12, bh - 12);
    // TOHO red sign
    const signY = by + 30;
    g.fillStyle(0xe5293b, 1).fillRect(bx + 28, signY, bw - 56, 26);
    g.lineStyle(2, 0xffffff, 0.6).strokeRect(bx + 28, signY, bw - 56, 26);
    this.addMapLabel(cx, signY + 13, "TOHO", "#ffffff", 18);
    // Window grid (deterministic checker)
    for (let wy = signY + 40; wy < by + bh - 12; wy += 14) {
      for (let wx = bx + 16; wx < bx + bw - 16; wx += 16) {
        const lit = (((wx * 13 + wy * 7) % 37) > 13);
        if (lit) {
          g.fillStyle(0xfada50, 0.72).fillRect(wx, wy, 5, 8);
          g.fillStyle(0xffeab0, 0.55).fillRect(wx, wy, 5, 2);
        } else {
          g.fillStyle(0x2a2a38, 1).fillRect(wx, wy, 5, 8);
        }
      }
    }
    // Vertical accent stripes (neon column)
    g.fillStyle(0xff4d6d, 0.4).fillRect(bx + 12, signY + 30, 2, bh - 80);
    g.fillStyle(0x57f5ff, 0.4).fillRect(bx + bw - 14, signY + 30, 2, bh - 80);
    // Entrance at ground level
    g.fillStyle(0x2a2a36, 1).fillRect(cx - 28, baseY - 24, 56, 24);
    g.fillStyle(0xffd24f, 0.5).fillRect(cx - 26, baseY - 20, 52, 2);
  }

  drawGodzillaHead(cx, cy) {
    const g = this.mapGraphics;
    const body = 0x3a4a2c;
    const dark = 0x1a2210;
    const lit = 0x5c7440;
    // Back spines (jagged triangles reaching above the skyline)
    g.fillStyle(0x6a8040, 1);
    g.fillTriangle(cx - 46, cy + 14, cx - 40, cy - 8, cx - 34, cy + 14);
    g.fillTriangle(cx - 32, cy + 10, cx - 26, cy - 14, cx - 20, cy + 10);
    g.fillTriangle(cx - 18, cy + 6, cx - 10, cy - 24, cx - 2, cy + 6);
    g.fillTriangle(cx - 0, cy + 4, cx + 6, cy - 16, cx + 12, cy + 4);
    // Neck base emerging from rooftop
    g.fillStyle(body, 1).fillRect(cx - 18, cy + 12, 40, 16);
    // Head dome
    g.fillStyle(body, 1).fillCircle(cx, cy + 6, 18);
    // Skull highlight on the top-left
    g.fillStyle(lit, 1).fillRect(cx - 10, cy - 6, 12, 3);
    g.fillStyle(lit, 1).fillRect(cx - 12, cy - 2, 3, 5);
    // Snout extends to the right
    g.fillStyle(body, 1).fillRect(cx + 12, cy + 2, 24, 16);
    g.fillStyle(body, 1).fillRect(cx + 30, cy + 6, 8, 10);
    g.fillStyle(lit, 1).fillRect(cx + 14, cy + 3, 20, 2);
    // Jaw shadow (below snout)
    g.fillStyle(dark, 1).fillRect(cx + 12, cy + 16, 22, 4);
    // Eye (glowing orange with yellow core)
    g.fillStyle(0xff7030, 1).fillRect(cx + 8, cy + 5, 4, 3);
    g.fillStyle(0xffe080, 1).fillRect(cx + 9, cy + 5, 2, 1);
    // Teeth
    g.fillStyle(0xfaf0c0, 1).fillRect(cx + 16, cy + 15, 1, 2);
    g.fillStyle(0xfaf0c0, 1).fillRect(cx + 20, cy + 15, 1, 2);
    g.fillStyle(0xfaf0c0, 1).fillRect(cx + 24, cy + 15, 1, 2);
    g.fillStyle(0xfaf0c0, 1).fillRect(cx + 28, cy + 15, 1, 2);
    // Nostril
    g.fillStyle(dark, 1).fillRect(cx + 32, cy + 9, 2, 2);
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

  sprinkleTileVariants(x, y, width, height, variants, probability = 0.09, tile = 8) {
    const g = this.mapGraphics;
    for (let px = x; px < x + width; px += tile) {
      for (let py = y; py < y + height; py += tile) {
        if (Phaser.Math.RND.frac() > probability) continue;
        const v = Phaser.Math.RND.pick(variants);
        g.fillStyle(v.color, v.alpha).fillRect(px, py, tile, tile);
        if (v.dot) {
          g.fillStyle(v.dot, Math.min(1, v.alpha + 0.15)).fillRect(
            px + Phaser.Math.Between(1, tile - 2),
            py + Phaser.Math.Between(1, tile - 2),
            1,
            1
          );
        }
      }
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
          : Phaser.Math.Between(110, 650);
      const y =
        map.key === "nagoya"
          ? stop.y + Phaser.Math.Between(-28, 28)
          : Phaser.Math.Between(530, 1100);
      const variantKey = this.npcVariantKey(profile);
      const sprite = this.add.sprite(x, y, `${variantKey}-0`).setScale(1.45).setDepth(8);
      if (this.spriteMode !== "icon") sprite.setTint(this.npcTintFor(profile));
      sprite.play(`${variantKey}-walk`);
      const icons = this.makeFlagIcons(profile.flags)
        .setPosition(x, y - 38)
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
      const sx =
        map.key === "nagoya"
          ? Phaser.Math.RND.pick(map.lanes) + Phaser.Math.Between(-14, 14)
          : Phaser.Math.Between(110, 650);
      const sy =
        map.key === "nagoya"
          ? Phaser.Math.Between(150, 1140)
          : Phaser.Math.Between(530, 1100);
      const ambientKey = this.spriteMode === "icon"
        ? Phaser.Math.RND.pick(AMBIENT_VARIANTS)
        : "npc";
      const sprite = this.add
        .sprite(sx, sy, `${ambientKey}-0`)
        .setScale(this.spriteMode === "icon" ? 0.78 : 1.08)
        .setDepth(6)
        .setAlpha(map.key === "kabukicho" ? 0.42 : 0.32);
      if (this.spriteMode !== "icon") {
        sprite.setTint(map.key === "kabukicho" ? Phaser.Math.RND.pick([0x57f5ff, 0xffd24f, 0xff6f8f]) : 0xd8d8d8);
      }
      sprite.play(`${ambientKey}-walk`);
      sprite.dir = Phaser.Math.RND.pick([-1, 1]);
      sprite.speed = Phaser.Math.Between(30, map.key === "kabukicho" ? 82 : 58);
      sprite.nextTurnAt = 0;
      sprite.vx = Phaser.Math.FloatBetween(-1, 1);
      sprite.vy = Phaser.Math.FloatBetween(-1, 1);
      this.ambient.push(sprite);
    }
  }

  npcVariantKey(profile) {
    if (this.spriteMode !== "icon") return "npc";
    return NPC_VARIANT_KEYS[profile.type] || "npc-waiting";
  }

  npcTintFor(profile) {
    const flags = profile.flags || [];
    if (flags.includes("with_friend")) return 0xffe07a;
    if (flags.includes("earphones")) return 0xd9c37a;
    if (flags.includes("eye_contact")) return 0xc6e8ff;
    if (flags.includes("phone")) return 0xaab7e0;
    if (flags.includes("looking_around")) return 0xe2a8e8;
    return 0xffffff;
  }

  makeFlagIcons(flags) {
    const valid = flags.filter((f) => FLAG_ICON_COLOR[f]).slice(0, 3);
    const g = this.add.graphics();
    if (!valid.length) return g;
    const spacing = 16;
    const startOffset = -spacing * (valid.length - 1) / 2;
    valid.forEach((flag, i) => this.drawFlagBadge(g, flag, startOffset + i * spacing, 0));
    return g;
  }

  drawFlagBadge(g, flag, cx, cy) {
    const color = FLAG_ICON_COLOR[flag];
    const size = 14;
    const half = size / 2;
    g.fillStyle(0x0a0b10, 0.92).fillRect(cx - half, cy - half, size, size);
    g.lineStyle(1, 0xf5f1df, 0.42).strokeRect(cx - half + 0.5, cy - half + 0.5, size - 1, size - 1);
    g.fillStyle(color, 1);
    switch (flag) {
      case "eye_contact":
        g.fillRect(cx - 3, cy - 2, 6, 4);
        g.fillStyle(0x0a0b10, 1).fillRect(cx - 1, cy - 1, 2, 2);
        break;
      case "busy":
        g.fillRect(cx - 1, cy - 5, 2, 6);
        g.fillRect(cx - 1, cy + 3, 2, 2);
        break;
      case "fast":
        g.fillTriangle(cx - 4, cy - 3, cx - 4, cy + 3, cx - 1, cy);
        g.fillTriangle(cx, cy - 3, cx, cy + 3, cx + 3, cy);
        break;
      case "with_friend":
        g.fillCircle(cx - 2, cy - 1, 2);
        g.fillCircle(cx + 2, cy - 1, 2);
        g.fillRect(cx - 3, cy + 2, 6, 1);
        break;
      case "phone":
        g.fillRect(cx - 2, cy - 4, 4, 8);
        g.fillStyle(0x0a0b10, 1).fillRect(cx - 1, cy - 3, 2, 5);
        break;
      case "earphones":
        g.fillRect(cx - 4, cy - 1, 2, 3);
        g.fillRect(cx + 2, cy - 1, 2, 3);
        g.fillRect(cx - 3, cy - 3, 6, 1);
        break;
      case "waiting":
        g.lineStyle(1, color, 1).strokeCircle(cx, cy, 4);
        g.fillStyle(color, 1).fillRect(cx, cy - 3, 1, 3);
        g.fillRect(cx, cy, 3, 1);
        break;
      case "looking_around":
        g.fillTriangle(cx - 5, cy, cx - 2, cy - 3, cx - 2, cy + 3);
        g.fillTriangle(cx + 5, cy, cx + 2, cy - 3, cx + 2, cy + 3);
        break;
    }
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
    this.difficultyButton = this.createHudButton(
      `難度:${this.difficulty.label}`,
      () => this.toggleDifficulty(),
      148,
      46,
      0x2f2a3a
    );
    this.actionButtons = [
      this.createHudButton("お天気op", () => this.tryApproach("weather"), 148, 48, 0x204a42),
      this.createHudButton("服装op", () => this.tryApproach("outfit"), 148, 48, 0x51323d),
      this.createHudButton("小物op", () => this.tryApproach("item"), 148, 48, 0x33405a),
      this.createHudButton("ネタop", () => this.tryApproach("joke"), 148, 48, 0x4a3a22),
      this.createHudButton("離れる", () => this.respectfullySkip(), 148, 48, 0x2a2f38),
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
      this.tweens.add({
        targets: container,
        scale: 0.9,
        duration: 70,
        yoyo: true,
        ease: "Quad.easeOut",
      });
      sfx.play("tick");
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
    this.difficultyButton.setPosition(
      width - this.mapButton.buttonWidth - this.difficultyButton.buttonWidth - 22,
      14
    );

    const buttonX = width - 160;
    const spacing = 54;
    const totalStack = spacing * (this.actionButtons.length - 1) + 48;
    const startY = Math.max(84, height - totalStack - 14);
    this.actionButtons.forEach((button, index) => {
      button.setPosition(buttonX, startY + index * spacing);
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
    this.updatePlayerAnim();
    this.updateNpcs(time, delta);
    this.updateNearestNpc();
    this.updateHud();
  }

  updatePlayerAnim() {
    const moving = this.joystickVector.length() > 0.1;
    if (moving) {
      if (!this.player.anims.isPlaying) this.player.anims.play("player-walk", true);
      if (this.joystickVector.x < -0.1) this.player.setFlipX(true);
      else if (this.joystickVector.x > 0.1) this.player.setFlipX(false);
    } else if (this.player.anims.isPlaying) {
      this.player.anims.stop();
      this.player.setTexture("player-0");
    }
  }

  updateNpcs(time, delta) {
    const map = MAPS[this.currentMapKey];
    const dt = delta / 1000;
    this.npcs.forEach((npc) => {
      if (npc.disabled || npc.profile.flags.includes("waiting")) {
        npc.icons.setPosition(npc.sprite.x, npc.sprite.y - 38);
        return;
      }
      if (map.movement === "vertical") {
        npc.sprite.y += npc.dir * npc.speed * dt;
        npc.sprite.x += (npc.lane - npc.sprite.x) * 0.03;
        if (npc.sprite.y < 145 || npc.sprite.y > 1140) npc.dir *= -1;
      } else {
        if (time > npc.nextTurnAt) {
          npc.nextTurnAt = time + Phaser.Math.Between(800, 1800);
          npc.vx = Phaser.Math.FloatBetween(-0.7, 0.7);
          npc.vy = Phaser.Math.FloatBetween(-1, 1);
        }
        npc.sprite.x += npc.vx * npc.speed * dt;
        npc.sprite.y += npc.vy * npc.speed * dt;
        if (npc.sprite.x < 95 || npc.sprite.x > 665) npc.vx *= -1;
        if (npc.sprite.y < 520 || npc.sprite.y > 1140) npc.vy *= -1;
        if (Math.abs(npc.vx) > 0.05) npc.sprite.setFlipX(npc.vx < 0);
      }
      npc.icons.setPosition(npc.sprite.x, npc.sprite.y - 38);
    });

    this.ambient.forEach((sprite) => {
      if (map.movement === "vertical") {
        sprite.y += sprite.dir * sprite.speed * dt;
        if (sprite.y < 130) sprite.y = 1150;
        if (sprite.y > 1150) sprite.y = 130;
      } else {
        if (time > sprite.nextTurnAt) {
          sprite.nextTurnAt = time + Phaser.Math.Between(500, 1500);
          sprite.vx = Phaser.Math.FloatBetween(-0.8, 0.8);
          sprite.vy = Phaser.Math.FloatBetween(-1, 1);
        }
        sprite.x += sprite.vx * sprite.speed * dt;
        sprite.y += sprite.vy * sprite.speed * dt;
        if (sprite.x < 95 || sprite.x > 665) sprite.vx *= -1;
        if (sprite.y < 520 || sprite.y > 1140) sprite.vy *= -1;
        if (Math.abs(sprite.vx) > 0.05) sprite.setFlipX(sprite.vx < 0);
      }
    });
  }

  updateNearestNpc() {
    const prev = this.nearNpc;
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

    this.nearNpc = nearestDistance <= 96 ? nearest : null;
    this.nearRing.clear();
    if (this.nearNpc) {
      const pulse = 0.55 + 0.35 * Math.sin(this.time.now / 180);
      const ringR = 44 + 3 * Math.sin(this.time.now / 200);
      this.nearRing.fillStyle(0xfadc50, 0.12);
      this.nearRing.fillCircle(this.nearNpc.sprite.x, this.nearNpc.sprite.y, ringR);
      this.nearRing.lineStyle(4, 0xfadc50, pulse);
      this.nearRing.strokeCircle(this.nearNpc.sprite.x, this.nearNpc.sprite.y, ringR);
      this.nearRing.lineStyle(2, 0xffffff, 0.9);
      this.nearRing.strokeCircle(this.nearNpc.sprite.x, this.nearNpc.sprite.y, ringR - 4);
    }
    if (this.nearNpc && !prev) {
      this.showMessage("→ 右下の op で声かけ！", 1200);
    }
  }

  updateHud() {
    const map = MAPS[this.currentMapKey];
    const nearText = this.nearNpc
      ? `${this.nearNpc.profile.type} / 興味${this.nearNpc.profile.interest}`
      : "近くの相手なし";
    const historyLine = this.history.length
      ? `\n直近: ${this.history[this.history.length - 1]}`
      : "";
    this.infoText.setText(
      `${map.label} ${map.period} / ${this.difficulty.label}\n` +
        `Score ${this.score} / Best ${this.best} / ${nearText}` +
        historyLine
    );
    this.actionButtons.forEach((button) => button.redraw(Boolean(this.nearNpc)));
  }

  pushHistory(entry) {
    this.history.push(entry);
    if (this.history.length > 3) this.history.shift();
  }

  updateBest() {
    if (this.score > this.best) this.best = this.score;
    if (this.best > getBest()) setBest(this.best);
  }

  toggleDifficulty() {
    this.difficulty = cycleDifficulty(this.difficulty.key);
    const text = this.difficultyButton.list.find((c) => c.text !== undefined);
    if (text) text.setText(`難度:${this.difficulty.label}`);
    this.showMessage(`難度: ${this.difficulty.label}`, 1100);
  }

  tryApproach(actionKey) {
    if (!this.nearNpc) {
      this.showBigText("もっと近づいて！", "#ffd24f");
      this.showMessage("まだ距離が遠い。相手の近くまで寄ってから op を選ぶ。", 1500);
      return;
    }

    const target = this.nearNpc;
    const rate = this.calculateSuccessRate(target.profile, actionKey);
    const roll = Math.random();
    const actionLabel = ACTIONS[actionKey].label;

    if (roll <= rate) {
      sfx.play("success");
      this.cameras.main.flash(140, 180, 255, 180);
      this.bounceSprite(target.sprite);
      this.showBigText("反応あり！", "#57f5ff");
      this.player.setVelocity(0, 0);
      this.pushHistory(`${actionLabel} 通過 (${Math.round(rate * 100)}%)`);
      this.showMessage(`${actionLabel}: 反応あり。会話へ。`, 650);
      this.time.delayedCall(620, () => {
        this.scene.start("TalkScene", {
          profile: target.profile,
          mapKey: this.currentMapKey,
          score: this.score,
          best: this.best,
          difficulty: this.difficulty.key,
          history: this.history.slice(),
        });
      });
      return;
    }

    sfx.play("fail");
    this.cameras.main.shake(180, 0.005);
    this.shakeSprite(target.sprite);
    this.showBigText("スルー...", "#ff4d6d");
    target.disabled = true;
    target.sprite.setAlpha(0.4);
    target.icons.setAlpha(0.25);
    this.pushHistory(`スルー (${actionLabel} ${Math.round(rate * 100)}%)`);
    this.showMessage(`スルーされた。${this.feedbackFor(target.profile, actionKey)} 成功率${Math.round(rate * 100)}%`, 2300);
  }

  bounceSprite(sprite) {
    const originalX = sprite.scaleX;
    const originalY = sprite.scaleY;
    this.tweens.add({
      targets: sprite,
      scaleX: originalX * 1.35,
      scaleY: originalY * 1.35,
      duration: 150,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  shakeSprite(sprite) {
    const originalX = sprite.x;
    this.tweens.add({
      targets: sprite,
      x: originalX + 5,
      duration: 60,
      yoyo: true,
      repeat: 3,
      onComplete: () => { sprite.x = originalX; },
    });
    sprite.setTint(0xff6070);
    this.time.delayedCall(280, () => {
      if (sprite.active) sprite.clearTint();
    });
  }

  showBigText(text, color) {
    const w = this.scale.width;
    const h = this.scale.height;
    const t = this.add
      .text(w / 2, h * 0.4, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: `${Math.min(46, Math.max(32, w * 0.1))}px`,
        color,
        fontStyle: "bold",
        stroke: "#0a0a10",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(70);
    this.tweens.add({
      targets: t,
      y: h * 0.32,
      alpha: 0,
      duration: 1100,
      ease: "Quad.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  respectfullySkip() {
    if (!this.nearNpc) {
      this.showMessage("離れる相手がいない。まずサインを観察してから。", 1500);
      return;
    }

    const target = this.nearNpc;
    const { bonus, reason } = this.calculateSkipBonus(target.profile);
    const adjusted = Math.round(bonus * this.difficulty.mult);
    this.score += adjusted;
    this.updateBest();
    sfx.play("skip");

    target.disabled = true;
    target.sprite.setAlpha(0.28);
    target.icons.setAlpha(0.2);
    this.nearNpc = null;
    this.nearRing.clear();

    const sign = adjusted >= 0 ? `+${adjusted}` : `${adjusted}`;
    this.pushHistory(`離れる ${sign}`);
    this.showMessage(`離れた。${reason} Score ${sign}`, 2300);
  }

  calculateSkipBonus(profile) {
    const defensive = {
      "イヤホン": 5,
      "友達といる": 5,
      "歩くの速い": 4,
      "外界遮断": 4,
      "夜の警戒": 3,
      "人混み": 2,
    };
    const openTraits = ["目が合う", "立ち止まり", "待ち合わせ"];
    const hits = [];
    let bonus = 0;
    profile.traits.forEach((trait) => {
      if (defensive[trait]) {
        bonus += defensive[trait];
        hits.push(trait);
      }
    });
    bonus = Math.min(bonus, 15);

    if (hits.length > 0) {
      return {
        bonus,
        reason: `${hits.slice(0, 2).join("・")} のサインを読んで引いた。`,
      };
    }
    if (profile.traits.some((trait) => openTraits.includes(trait))) {
      return { bonus: 1, reason: "開かれたサインもあったが無理はしなかった。" };
    }
    return { bonus: 2, reason: "明確なサインは見えなかったので追わなかった。" };
  }

  calculateSuccessRate(profile, actionKey) {
    const map = MAPS[this.currentMapKey];
    const action = ACTIONS[actionKey];
    const diff = this.difficulty;
    let rate =
      0.3 + map.baseBonus + diff.baseMod - map.noisePenalty - diff.noiseMod + (profile.interest - 50) / 190;
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
    if (profile.traits.includes("友達といる") && actionKey === "joke") return "同伴中の笑い取りはグループ内の空気を崩す。";
    if (profile.traits.includes("友達といる")) return "同伴中は防御が高い。グループの流れを切らない。";
    if (profile.traits.includes("歩くの速い")) return "歩行速度が速く、余白の話題に乗る余裕がなかった。";
    if (actionKey === "joke") return "不意のボケは警戒モードでは刺さらない。";
    if (actionKey === "outfit" && profile.traits.includes("スマホ")) return "服装opより、注意の外からすっと入る方が向く場面。";
    if (actionKey === "weather") return "差し障りない話題でも、今は余白がなかった。";
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
    this.scene.restart({
      mapKey: next,
      score: this.score,
      history: this.history.slice(),
    });
  }
}
