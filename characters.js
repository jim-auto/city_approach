// 32x32 character sprites drawn to an offscreen canvas, registered as Phaser
// textures. Two modes:
//   "pixel" — chibi pixel art with 3-value material ramps (default).
//   "icon"  — emoji rendered via Canvas 2D fillText, for a cuter, cleaner
//             look that stays cross-platform without any asset files.
// Both modes emit the same texture keys (player-0/1, npc-0/1) so nothing
// downstream has to branch.

import { getSpriteMode } from "./storage.js";

const ICON_SETS = {
  player: ["😊", "😄"],
  npc:    ["🙂", "😶"],
};

const PALETTES = {
  player: {
    hair:  { base: 0x3a2820, shadow: 0x1d1320, highlight: 0x5a4030 },
    skin:  { base: 0xfadcae, shadow: 0xd09580, highlight: 0xfff0d6 },
    shirt: { base: 0x4a88c8, shadow: 0x28486a, highlight: 0x9cc4ec },
    shirtAccent: 0xdef0ff,
    pants: { base: 0x2a3a66, shadow: 0x141e38, highlight: 0x4a5c92 },
    shoes: { base: 0x181820, shadow: 0x08080c, highlight: 0x343440 },
    outline: 0x23202a,
    mouth: 0xdc5a66,
    blush: 0xff9cb4,
    eyeHighlight: 0xffffff,
    eyeGlint: 0xffc880,
  },
  npc: {
    hair:  { base: 0x3a2a20, shadow: 0x1e141c, highlight: 0x5c4132 },
    skin:  { base: 0xfadcae, shadow: 0xd09580, highlight: 0xfff0d6 },
    shirt: { base: 0xb25664, shadow: 0x6c2a3a, highlight: 0xe48a96 },
    shirtAccent: 0xffd8dc,
    pants: { base: 0x3a2834, shadow: 0x1f141c, highlight: 0x5c4252 },
    shoes: { base: 0x141418, shadow: 0x06060a, highlight: 0x2e2e36 },
    outline: 0x23202a,
    mouth: 0xdc5a66,
    blush: 0xff9cb4,
    eyeHighlight: 0xffffff,
    eyeGlint: 0xffc880,
  },
};

function hex(n) {
  return "#" + n.toString(16).padStart(6, "0");
}

function paint(ctx, x, y, w, h, color) {
  ctx.fillStyle = hex(color);
  ctx.fillRect(x, y, w, h);
}

function fill3(ctx, x, y, w, h, ramp) {
  // Flat base fill first.
  paint(ctx, x, y, w, h, ramp.base);
  // Shadow: right column + bottom row.
  paint(ctx, x + w - 1, y + 1, 1, h - 1, ramp.shadow);
  paint(ctx, x + 1, y + h - 1, w - 1, 1, ramp.shadow);
  // Highlight: single top-left pixel.
  paint(ctx, x, y, 1, 1, ramp.highlight);
}

function drawBody(ctx, p) {
  // Hair cap (rough rounded top)
  paint(ctx, 12, 3, 8, 1, p.hair.base);
  paint(ctx, 11, 4, 10, 2, p.hair.base);
  paint(ctx, 10, 6, 12, 1, p.hair.base);
  // Hair highlight diagonal (upper-left glossy strip)
  paint(ctx, 13, 3, 2, 1, p.hair.highlight);
  paint(ctx, 12, 4, 2, 1, p.hair.highlight);
  paint(ctx, 11, 5, 2, 1, p.hair.highlight);
  // Hair shadow right side
  paint(ctx, 19, 4, 2, 2, p.hair.shadow);
  paint(ctx, 21, 6, 1, 1, p.hair.shadow);

  // Face skin
  fill3(ctx, 11, 6, 10, 7, p.skin);

  // Hair sides framing face
  paint(ctx, 10, 6, 1, 6, p.hair.base);
  paint(ctx, 21, 6, 1, 6, p.hair.shadow);
  // Bangs
  paint(ctx, 11, 6, 2, 1, p.hair.base);
  paint(ctx, 19, 6, 2, 1, p.hair.shadow);

  // Big sparkly chibi eyes — 3x3 with sparkle, pupil band, and warm glint
  paint(ctx, 12, 8, 3, 3, p.outline);
  paint(ctx, 17, 8, 3, 3, p.outline);
  // White sparkle (top-left)
  paint(ctx, 12, 8, 1, 1, p.eyeHighlight);
  paint(ctx, 17, 8, 1, 1, p.eyeHighlight);
  // Warm reflective glint (mid)
  paint(ctx, 14, 9, 1, 1, p.eyeGlint);
  paint(ctx, 19, 9, 1, 1, p.eyeGlint);

  // Blush (row 10, outer cheeks)
  paint(ctx, 11, 10, 1, 1, p.blush);
  paint(ctx, 20, 10, 1, 1, p.blush);

  // Smile arc — corners up, bottom dip in the middle
  paint(ctx, 14, 11, 1, 1, p.mouth);
  paint(ctx, 17, 11, 1, 1, p.mouth);
  paint(ctx, 15, 12, 2, 1, p.mouth);

  // Neck (row 13, connecting head to shirt)
  paint(ctx, 15, 13, 2, 1, p.skin.shadow);

  // Shirt torso
  fill3(ctx, 11, 14, 10, 7, p.shirt);
  // Collar accent (SNES sprites often have a 1-row accent)
  paint(ctx, 14, 14, 4, 1, p.shirtAccent);
  paint(ctx, 15, 15, 2, 1, p.shirtAccent);

  // Arms (1px wide stick-outs)
  paint(ctx, 10, 15, 1, 5, p.shirt.base);
  paint(ctx, 21, 15, 1, 5, p.shirt.shadow);

  // Hands
  paint(ctx, 10, 20, 1, 1, p.skin.base);
  paint(ctx, 21, 20, 1, 1, p.skin.shadow);

  // Belt (dark line)
  paint(ctx, 11, 21, 10, 1, p.outline);

  // Hips (pants top)
  fill3(ctx, 12, 22, 8, 3, p.pants);
}

function drawLegs(ctx, p, frame) {
  if (frame === 0) {
    fill3(ctx, 12, 25, 3, 4, p.pants);
    fill3(ctx, 17, 25, 3, 4, p.pants);
    paint(ctx, 12, 29, 3, 1, p.shoes.base);
    paint(ctx, 17, 29, 3, 1, p.shoes.base);
    paint(ctx, 14, 29, 1, 1, p.shoes.shadow);
    paint(ctx, 19, 29, 1, 1, p.shoes.shadow);
  } else {
    fill3(ctx, 11, 25, 3, 4, p.pants);
    fill3(ctx, 18, 25, 3, 4, p.pants);
    paint(ctx, 11, 29, 3, 1, p.shoes.base);
    paint(ctx, 18, 29, 3, 1, p.shoes.base);
    paint(ctx, 13, 29, 1, 1, p.shoes.shadow);
    paint(ctx, 20, 29, 1, 1, p.shoes.shadow);
  }
}

function drawOutline(ctx, p, frame) {
  const o = p.outline;
  // Sides of head
  paint(ctx, 9, 6, 1, 7, o);
  paint(ctx, 22, 6, 1, 7, o);
  paint(ctx, 10, 13, 1, 1, o);
  paint(ctx, 21, 13, 1, 1, o);
  // Side of shirt / arms
  paint(ctx, 9, 15, 1, 5, o);
  paint(ctx, 22, 15, 1, 5, o);
  // Shirt bottom corners
  paint(ctx, 10, 20, 1, 1, o);
  paint(ctx, 21, 20, 1, 1, o);
  // Hip edges
  paint(ctx, 11, 22, 1, 3, o);
  paint(ctx, 20, 22, 1, 3, o);
  // Leg outer edges + gap
  if (frame === 0) {
    paint(ctx, 11, 25, 1, 5, o);
    paint(ctx, 20, 25, 1, 5, o);
    paint(ctx, 15, 25, 2, 4, o);
  } else {
    paint(ctx, 10, 25, 1, 5, o);
    paint(ctx, 21, 25, 1, 5, o);
    paint(ctx, 14, 25, 4, 4, o);
  }
}

function renderPixelFrame(palette, frame) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  drawBody(ctx, palette);
  drawLegs(ctx, palette, frame);
  drawOutline(ctx, palette, frame);
  return canvas;
}

function renderIconFrame(key, frame) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.font = "26px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const emoji = (ICON_SETS[key] || ICON_SETS.npc)[frame % 2];
  ctx.fillText(emoji, 16, 17);
  return canvas;
}

export function buildCharacterTextures(scene) {
  const modeKey = getSpriteMode().key;
  Object.entries(PALETTES).forEach(([key, palette]) => {
    for (let frame = 0; frame < 2; frame += 1) {
      const texKey = `${key}-${frame}`;
      if (scene.textures.exists(texKey)) {
        const existing = scene.textures.get(texKey);
        if (existing._modeKey === modeKey) continue;
        scene.textures.remove(texKey);
      }
      const canvas = modeKey === "icon"
        ? renderIconFrame(key, frame)
        : renderPixelFrame(palette, frame);
      const tex = scene.textures.addCanvas(texKey, canvas);
      if (tex) tex._modeKey = modeKey;
    }
  });
}

export function registerCharacterAnimations(scene) {
  if (!scene.anims.exists("player-walk")) {
    scene.anims.create({
      key: "player-walk",
      frames: [{ key: "player-0" }, { key: "player-1" }],
      frameRate: 6,
      repeat: -1,
    });
  }
  if (!scene.anims.exists("npc-walk")) {
    scene.anims.create({
      key: "npc-walk",
      frames: [{ key: "npc-0" }, { key: "npc-1" }],
      frameRate: 5,
      repeat: -1,
    });
  }
}
