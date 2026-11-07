// Deterministic pixel scenery: static street detail plus two moving skyline layers.
const noise = (n) => ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
const mix = (a, b, t) => {
  const c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

export function drawCitySky(scene) {
  const { width: w, height: h } = scene.scale;
  const g = scene.sky.clear(), night = scene.mapKey === 'kabukicho';
  const floor = scene.groundY - 16;
  for (let y = 0; y < h; y += 8) {
    g.fillStyle(mix(night ? 0x080e25 : 0x273b64, night ? 0x573151 : 0xf1ae87, Math.min(1, y / floor)))
      .fillRect(0, y, w, 8);
  }
  const sunX = w * .8 - scene.cameras.main.scrollX * .025;
  g.fillStyle(night ? 0xb6bbeb : 0xffc591, .06).fillCircle(sunX, floor * .36, 62);
  g.fillStyle(night ? 0xe4e4ed : 0xffd7a4).fillCircle(sunX, floor * .36, night ? 17 : 30);
  if (night) {
    g.fillStyle(0xffffff, .55);
    for (let i = 0; i < 28; i++) g.fillRect(noise(i) * w, 100 + noise(i + 50) * Math.max(5, floor * .45 - 100), 2, 2);
  } else {
    for (let i = 0; i < 6; i++) {
      const x = noise(i + 8) * (w + 220) - 110 - (scene.cameras.main.scrollX * .04 % 80);
      g.fillStyle(0xffcdb2, .16).fillRect(x, floor * (.12 + i * .07), 90 + noise(i) * 150, 5);
    }
  }
  for (let layer = 0; layer < 2; layer++) {
    const pitch = layer ? 132 : 92, drift = scene.cameras.main.scrollX * (layer ? .36 : .14);
    for (let i = -1; i < Math.ceil(w / pitch) + 2; i++) {
      const index = i + Math.floor(drift / pitch), x = i * pitch - drift % pitch;
      const bh = Math.min(floor * .73, (layer ? 115 : 150) + noise(index + layer * 70) * 190);
      const top = floor - bh, bw = pitch - 12 - noise(index) * 15;
      g.fillStyle(layer ? (night ? 0x151a30 : 0x34465d) : (night ? 0x29233e : 0x626780)).fillRect(x, top, bw, bh);
      g.fillStyle(0xa7bbd4, .18).fillRect(x + 3, top, 3, bh);
      if (index % 3 === 0) {
        g.fillStyle(layer ? 0x26324b : 0x656779).fillRect(x + bw * .3, top - 13, bw * .45, 13);
        g.fillRect(x + bw * .52, top - 30, 2, 18);
      }
      for (let r = 0; r < Math.floor((bh - 12) / 17); r++) for (let c = 0; c < Math.floor((bw - 10) / 14); c++) {
        const lit = noise(index * 43 + r * 8 + c) > .47;
        g.fillStyle(lit ? (night ? 0xe8b985 : 0xc3c9cd) : 0x64718c, lit ? .58 : .13)
          .fillRect(x + 8 + c * 14, top + 12 + r * 17, 5, 8);
      }
    }
  }
}

function tree(g, x, y, night, seed) {
  g.fillStyle(0x151e28, .35).fillEllipse(x + 8, y - 5, 94, 14);
  g.fillStyle(0x665347).fillRect(x - 4, y - 116, 8, 110);
  g.lineStyle(4, 0x665347).lineBetween(x, y - 70, x - 21, y - 106).lineBetween(x, y - 90, x + 22, y - 129);
  for (let i = 0; i < 20; i++) {
    g.fillStyle(night ? [0x203a39, 0x2b4e45, 0x385b4b][i % 3] : [0x405d4e, 0x61774f, 0x87935c][i % 3]);
    g.fillRect(x - 49 + noise(seed + i) * 73, y - 162 + noise(seed + i + 30) * 63, 28, 27);
  }
  g.fillStyle(0x596477).fillRect(x - 28, y - 12, 56, 12);
}

function shop(scene, x, width, height, index, night) {
  const g = scene.street, y = scene.groundY - 17, top = y - height;
  const colors = night ? [0xef639b, 0x5bdbdc, 0xffbd6b, 0x9c8cef] : [0xe0b379, 0x9cb9b7, 0xd5a4a2, 0x8fa9c8];
  const accent = colors[index % colors.length];
  g.fillStyle(night ? 0x1d2233 : [0x596779, 0x736b6a, 0x4d6471][index % 3]).fillRect(x, top, width, height);
  g.fillStyle(0x101b2c, .35).fillRect(x + width - 12, top, 12, height);
  g.fillStyle(0xa7a8ab, .4).fillRect(x - 3, top - 5, width + 6, 5);
  for (let row = 0; row < Math.floor((height - 98) / 28); row++) {
    for (let col = 0; col < Math.floor((width - 18) / 27); col++) {
      g.fillStyle(noise(index * 23 + row * 5 + col) > .3 ? 0xcab38f : 0x35465a, .7)
        .fillRect(x + 12 + col * 27, top + 15 + row * 28, 16, 17);
      g.fillStyle(0x202c3e, .5).fillRect(x + 12 + col * 27, top + 23 + row * 28, 16, 2);
    }
  }
  const signY = y - 91;
  g.fillStyle(accent, .07).fillRect(x - 8, signY - 9, width + 16, 46);
  g.fillStyle(0x111b2c).fillRect(x + 5, signY, width - 10, 28);
  g.lineStyle(2, accent).strokeRect(x + 5, signY, width - 10, 28);
  const names = night ? ['喫茶 月灯', 'RAMEN', 'カラオケ', 'BAR • 24', '夜喫茶', 'RECORDS'] : ['COFFEE', '花とくらし', 'BAKERY', 'BOOKS', '喫茶 こもれび', 'GALLERY'];
  scene.label(x + width / 2, signY + 14, names[index % names.length], '#' + accent.toString(16).padStart(6, '0'), 13);
  g.fillStyle(0xe5ba7c, night ? .65 : .5).fillRect(x + 10, y - 57, width - 20, 54);
  for (let c = 0; c < 4; c++) {
    g.fillStyle(0x253548).fillRect(x + 9 + c * (width - 18) / 3, y - 59, 4, 59);
  }
  g.fillStyle(0x263344).fillRect(x + 5, y - 64, width - 10, 8);
  g.fillStyle(accent).fillRect(x + 5, y - 64, width - 10, 3);
  g.fillStyle(0x101b2c).fillRect(x, y, width, 5);
  if (night) {
    // Broken vertical streaks suggest wet paving, without obscuring the characters.
    for (let i = 0; i < 12; i++) g.fillStyle(accent, .035 + noise(i + index) * .06)
      .fillRect(x + noise(i + index * 31) * width, y + 27 + noise(i) * 80, 3 + noise(i + 4) * 18, 2);
  }
}

export function drawCityStreet(scene, worldWidth, hotelX) {
  const g = scene.street.clear(), y = scene.groundY, h = scene.scale.height;
  const night = scene.mapKey === 'kabukicho';
  g.fillStyle(night ? 0x292b3d : 0x6a6c71).fillRect(0, y - 17, worldWidth, h - y + 17);
  for (let row = 0; row < 4; row++) {
    g.lineStyle(1, night ? 0x434452 : 0x91908c, .55).lineBetween(0, y - 12 + row * 13, worldWidth, y - 12 + row * 13);
    for (let x = (row % 2) * 27; x < worldWidth; x += 54) g.lineBetween(x, y - 12 + row * 13, x, y + 1 + row * 13);
  }
  g.fillStyle(0xa6a19a).fillRect(0, y + 31, worldWidth, 4);
  g.fillStyle(night ? 0x111827 : 0x303d4e).fillRect(0, y + 37, worldWidth, h - y);
  g.fillStyle(0xe6c36b, .55).fillRect(0, y + 45, worldWidth, 2);
  for (let x = 0; x < worldWidth; x += 100) g.fillStyle(0x96a0ab, .5).fillRect(x, y + 91, 47, 3);
  // Three districts: dense shops, a planted square, then the quieter hotel approach.
  for (let i = 0; i < 14; i++) {
    const x = i * 183 - 90;
    if (x > 1350 && x < 1720) continue;
    shop(scene, x, 163, Math.min(y - 72, 174 + noise(i + 2) * 130), i, night);
  }
  for (const x of [380, 1115, 1470, 1655, 2235, 2670, 3090]) tree(g, x, y - 16, night, x);
  for (let x = 80; x < worldWidth; x += 540) {
    const lampHeight = Math.min(190, y - 80);
    g.fillStyle(0x263443).fillRect(x, y - lampHeight, 5, lampHeight + 7);
    g.fillRect(x - 3, y + 2, 12, 6);
    g.fillRect(x - 17, y - lampHeight, 38, 5);
    g.fillStyle(0xffdeb0, .055).fillTriangle(x + 2, y - lampHeight, x - 80, y + 12, x + 84, y + 12);
    g.fillStyle(0xffe5b9).fillRect(x - 16, y - lampHeight + 5, 36, 4);
  }
  for (const x of [780, 1525, 2340]) {
    g.fillStyle(0x3c3331).fillRect(x, y - 35, 80, 7).fillRect(x, y - 49, 80, 5);
    g.fillStyle(0x263544).fillRect(x + 7, y - 28, 5, 16).fillRect(x + 68, y - 28, 5, 16);
  }
  const names = night ? ['ネオン横丁', '月あかり広場', 'ラブホテル通り'] : ['名駅・駅前通り', 'こもれび広場', 'ラブホテル通り'];
  names.forEach((name, i) => {
    const x = 600 + i * 850, top = Math.max(118, y - 240);
    g.fillStyle(0x273e4b).fillRect(x - 80, top, 160, 30);
    g.fillStyle(0x8fbdba).fillRect(x - 80, top + 29, 160, 2);
    scene.label(x, top + 15, `${name} →`, '#d5e5db', 13);
  });
  // Stone facade, brass trim, recessed glass lobby and a lit entrance canopy.
  const top = y - Math.min(330, y - (scene.compact ? 108 : 130));
  g.fillStyle(0x555665).fillRect(hotelX - 141, top, 282, y - top - 14);
  g.fillStyle(0x323b50).fillRect(hotelX - 125, top + 7, 250, y - top - 21);
  for (let x = hotelX - 120; x < hotelX + 130; x += 25) g.fillStyle(0xcbb796, .23).fillRect(x, top + 8, 2, y - top - 24);
  for (let row = top + 58; row < y - 110; row += 40) for (let c = 0; c < 5; c++) {
    g.fillStyle(0xffd79c, .74).fillRect(hotelX - 107 + c * 47, row, 25, 23);
    g.fillStyle(0x394353).fillRect(hotelX - 96 + c * 47, row, 2, 23);
  }
  g.fillStyle(0xe6bb84, .8).fillRect(hotelX - 70, y - 83, 140, 67);
  g.fillStyle(0x25394b).fillRect(hotelX - 31, y - 78, 62, 62);
  g.lineStyle(2, 0xdac396).strokeRect(hotelX - 31, y - 78, 62, 62).lineBetween(hotelX, y - 78, hotelX, y - 16);
  g.fillStyle(0x182636).fillRect(hotelX - 110, y - 100, 220, 18);
  g.fillStyle(0xf4d29a).fillRect(hotelX - 110, y - 83, 220, 3);
  g.fillStyle(0xffdca1, .08).fillTriangle(hotelX, y - 82, hotelX - 110, y + 20, hotelX + 110, y + 20);
  for (const x of [hotelX - 101, hotelX + 101]) {
    g.fillStyle(0x9f927c).fillRect(x - 10, y - 34, 20, 20);
    g.fillStyle(0x426657).fillRect(x - 13, y - 57, 26, 26);
  }
  g.lineStyle(2, 0xff80b3, .8).strokeRect(hotelX - 141, top, 282, y - top - 14);
  for (const x of [hotelX - 109, hotelX + 109]) {
    g.fillStyle(0xff78ac, .08).fillCircle(x, top + 29, 28);
    g.fillStyle(0xff8cbd).fillCircle(x - 4, top + 25, 5).fillCircle(x + 4, top + 25, 5)
      .fillTriangle(x - 9, top + 26, x + 9, top + 26, x, top + 38);
  }
  scene.label(hotelX, top + 30, 'LOVE HOTEL', '#ffb2d2', scene.compact ? 18 : 24);
  scene.label(hotelX - 83, y - 54, 'REST', '#ffd5e7', 10);
  scene.label(hotelX, top - 16, 'GOAL', '#9eede0', 16);
}
