// Character sprites registered as Phaser textures under `player-0/1` and
// `npc-0/1`. Two modes:
//   "pixel" — chibi pixel art drawn with Canvas 2D fillRect, {base, shadow,
//             highlight} material ramps, 3×3 sparkly eyes, smile, blush.
//   "icon"  — AI-generated character artwork loaded from assets/ai/, with the
//             white background chroma-keyed to transparent at build time.
// Both modes emit the same texture keys so the rest of the scene doesn't
// branch on mode.

import { getSpriteMode } from "./storage.js";

const AI_SOURCE_KEYS = {
  player: "ai_player_raw",
  "npc-waiting": "ai_npc_waiting_raw",
  "npc-busy": "ai_npc_busy_raw",
  "npc-friends": "ai_npc_friends_raw",
  "npc-eye": "ai_npc_eye_raw",
  "npc-earphones": "ai_npc_earphones_raw",
  "npc-tourist": "ai_npc_tourist_raw",
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

const AI_CANVAS_SIZE = 48;

function renderAiFrame(scene, key) {
  const sourceKey = AI_SOURCE_KEYS[key] || AI_SOURCE_KEYS.npc;
  if (!scene.textures.exists(sourceKey)) return null;
  const img = scene.textures.get(sourceKey).getSourceImage();
  const canvas = document.createElement("canvas");
  canvas.width = AI_CANVAS_SIZE;
  canvas.height = AI_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, AI_CANVAS_SIZE, AI_CANVAS_SIZE);
  // Chroma-key near-white pixels to transparent so characters blend into the
  // dark map instead of sitting on a white card.
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r > 232 && g > 232 && b > 232) {
      d[i + 3] = 0;
    } else if (r > 210 && g > 210 && b > 210) {
      // Soft edge fade so there's no hard outline from the chroma-key.
      d[i + 3] = Math.max(0, d[i + 3] - 128);
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export function buildCharacterTextures(scene) {
  const modeKey = getSpriteMode().key;
  const targets = modeKey === "icon"
    ? Object.keys(AI_SOURCE_KEYS)
    : Object.keys(PALETTES);
  targets.forEach((key) => {
    const palette = PALETTES[key] || PALETTES.npc;
    const aiCanvas = modeKey === "icon" ? renderAiFrame(scene, key) : null;
    const effectiveMode = aiCanvas ? "icon" : "pixel";
    for (let frame = 0; frame < 2; frame += 1) {
      const texKey = `${key}-${frame}`;
      if (scene.textures.exists(texKey)) {
        const existing = scene.textures.get(texKey);
        if (existing._modeKey === effectiveMode) continue;
        scene.textures.remove(texKey);
      }
      const canvas = aiCanvas ? aiCanvas : renderPixelFrame(palette, frame);
      const tex = scene.textures.addCanvas(texKey, canvas);
      if (tex) tex._modeKey = effectiveMode;
    }
  });
}

export function registerCharacterAnimations(scene) {
  const modeKey = getSpriteMode().key;
  const targets = modeKey === "icon"
    ? Object.keys(AI_SOURCE_KEYS)
    : Object.keys(PALETTES);
  targets.forEach((key) => {
    const animKey = `${key}-walk`;
    if (scene.anims.exists(animKey)) return;
    scene.anims.create({
      key: animKey,
      frames: [{ key: `${key}-0` }, { key: `${key}-1` }],
      frameRate: key === "player" ? 6 : 5,
      repeat: -1,
    });
  });
}
