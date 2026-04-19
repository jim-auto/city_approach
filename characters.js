// 32x32 chibi sprites drawn to an offscreen canvas, registered as Phaser
// textures. Two frames per character so we can run a walk animation. The
// look is inspired by 16-bit JRPG townspeople: bigger head, small body,
// stubby legs, limited palette.

const PALETTES = {
  player: {
    hair: 0x3a2820,
    skin: 0xf5d6a8,
    shirt: 0x4a88c8,
    shirtAccent: 0xbcd9f0,
    pants: 0x2a3a66,
    shoes: 0x181820,
    outline: 0x05050a,
    mouth: 0x8e4a3c,
  },
  npc: {
    hair: 0x3a2a20,
    skin: 0xf5d6a8,
    shirt: 0xb25664,
    shirtAccent: 0xf3b1ba,
    pants: 0x3a2834,
    shoes: 0x141418,
    outline: 0x05050a,
    mouth: 0x8e4a3c,
  },
};

function hex(n) {
  return "#" + n.toString(16).padStart(6, "0");
}

function paint(ctx, x, y, w, h, color) {
  ctx.fillStyle = hex(color);
  ctx.fillRect(x, y, w, h);
}

function drawBody(ctx, p) {
  // Hair cap
  paint(ctx, 12, 3, 8, 1, p.hair);
  paint(ctx, 11, 4, 10, 2, p.hair);
  paint(ctx, 10, 6, 12, 1, p.hair);
  // Face (skin)
  paint(ctx, 11, 6, 10, 7, p.skin);
  // Hair sides + bangs overlap face
  paint(ctx, 10, 6, 1, 6, p.hair);
  paint(ctx, 21, 6, 1, 6, p.hair);
  paint(ctx, 11, 6, 2, 1, p.hair);
  paint(ctx, 19, 6, 2, 1, p.hair);
  // Eyes + mouth
  paint(ctx, 13, 9, 2, 1, p.outline);
  paint(ctx, 17, 9, 2, 1, p.outline);
  paint(ctx, 15, 11, 2, 1, p.mouth);
  // Jaw / neck
  paint(ctx, 11, 12, 10, 1, p.skin);
  paint(ctx, 15, 13, 2, 1, p.skin);
  // Shirt
  paint(ctx, 11, 14, 10, 7, p.shirt);
  paint(ctx, 10, 15, 1, 5, p.shirt);
  paint(ctx, 21, 15, 1, 5, p.shirt);
  paint(ctx, 14, 14, 4, 1, p.shirtAccent);
  // Hands
  paint(ctx, 10, 20, 1, 1, p.skin);
  paint(ctx, 21, 20, 1, 1, p.skin);
  // Belt
  paint(ctx, 11, 21, 10, 1, p.outline);
  // Hips
  paint(ctx, 12, 22, 8, 3, p.pants);
}

function drawLegs(ctx, p, frame) {
  if (frame === 0) {
    paint(ctx, 12, 25, 3, 4, p.pants);
    paint(ctx, 17, 25, 3, 4, p.pants);
    paint(ctx, 12, 29, 3, 1, p.shoes);
    paint(ctx, 17, 29, 3, 1, p.shoes);
  } else {
    paint(ctx, 11, 25, 3, 4, p.pants);
    paint(ctx, 18, 25, 3, 4, p.pants);
    paint(ctx, 11, 29, 3, 1, p.shoes);
    paint(ctx, 18, 29, 3, 1, p.shoes);
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
  // Shirt bottom
  paint(ctx, 10, 20, 1, 1, o);
  paint(ctx, 21, 20, 1, 1, o);
  // Hip edges
  paint(ctx, 11, 22, 1, 3, o);
  paint(ctx, 20, 22, 1, 3, o);
  // Leg outer edges
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

function renderFrame(palette, frame) {
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

export function buildCharacterTextures(scene) {
  Object.entries(PALETTES).forEach(([key, palette]) => {
    for (let frame = 0; frame < 2; frame += 1) {
      const texKey = `${key}-${frame}`;
      if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
      scene.textures.addCanvas(texKey, renderFrame(palette, frame));
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
