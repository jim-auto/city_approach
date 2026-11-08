// The street sprite determines both the person and palette in the ending CG.
// Atlas cells use the same 4 x 3 layout as the street-character artwork.
export const GOAL_COSTUMES = {
  'npc-waiting': { cell: 1, label: 'クラシックメイド', room: 'rose', quote: 'この衣装、ちょっと似合ってるかも。' },
  'npc-busy': { cell: 2, label: 'ステージマジシャン', room: 'neon', quote: 'それじゃ、一回だけマジック見せるね。' },
  'npc-friends': { cell: 3, label: 'ゴシックプリンセス', room: 'rose', quote: 'こういう世界観、けっこう好き。' },
  'npc-eye': { cell: 4, label: '猫耳パーカー', room: 'rose', quote: '猫耳って、つけると楽しくなるね。' },
  'npc-earphones': { cell: 5, label: 'ネオンアイドル', room: 'neon', quote: '一曲だけ、ライブっぽくやってみる？' },
  'npc-tourist': { cell: 6, label: '花柄の浴衣', room: 'rose', quote: '旅行の記念写真みたいでいいね。' },
  'npc-student': { cell: 7, label: '星空の魔法使い', room: 'neon', quote: '今日は魔法使いってことで。' },
  'npc-reader': { cell: 8, label: 'クラシカルドレス', room: 'rose', quote: '物語の中に入ったみたい。' },
  'npc-cafe': { cell: 9, label: 'スイートパティシエ', room: 'rose', quote: '写真が撮れたら、お茶にしよう。' },
  'npc-jogger': { cell: 10, label: 'スペースパイロット', room: 'neon', quote: 'このスーツ、意外と動きやすい！' },
  'npc-prin-student': { cell: null, label: 'ブルーアリス', room: 'rose', quote: 'これ着てみたかったんだ。写真撮ろ！' },
};
export const GOAL_PALETTES = ['original', 'pastel', 'street', 'chic'];

export function goalCostumeFor(textureKey = 'npc-waiting-0') {
  let base = (typeof textureKey === 'string' ? textureKey : 'npc-waiting-0').replace(/-[01]$/, '');
  const color = GOAL_PALETTES.slice(1).find(key => base.endsWith(`-${key}`)) || 'original';
  if (color !== 'original') base = base.slice(0, -(color.length + 1));
  if (!Object.hasOwn(GOAL_COSTUMES, base)) base = 'npc-waiting';
  const costume = GOAL_COSTUMES[base];
  const palette = base === 'npc-prin-student' ? 'prin' : color;
  return {
    ...costume, base, palette,
    atlasKey: `goal-costumes-${palette}`,
    atlasPath: `assets/ai/costumes-${palette}.png`,
    portraitKey: `goal-portrait-${base}-${palette}`,
    roomKey: `goal-room-${costume.room}`,
    roomPath: `assets/ai/room-${costume.room}.png`,
  };
}

export function buildGoalPortrait(scene, selection) {
  if (scene.textures.exists(selection.portraitKey)) return;
  const source = scene.textures.get(selection.atlasKey).getSourceImage();
  const single = selection.cell === null;
  const w = source.width / (single ? 1 : 4), h = source.height / (single ? 1 : 3);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(512, Math.ceil(Math.max(w, h)));
  const scale = canvas.width / Math.max(w, h);
  canvas.getContext('2d').drawImage(source,
    single ? 0 : selection.cell % 4 * w, single ? 0 : Math.floor(selection.cell / 4) * h,
    w, h, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
  scene.textures.addCanvas(selection.portraitKey, canvas);
}

export function goalPortraitBounds(scene, key) {
  const texture = scene.textures.get(key);
  if (texture.customData.goalBounds) return texture.customData.goalBounds;
  const image = texture.getSourceImage();
  const pixels = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
  let left = image.width, top = image.height, right = 0, bottom = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (pixels[(y * image.width + x) * 4 + 3] <= 8) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return texture.customData.goalBounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
