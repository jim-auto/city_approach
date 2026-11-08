// The street sprite determines both the person and palette in the ending CG.
// Atlas cells use the same 4 x 3 layout as the street-character artwork.
export const GOAL_COSTUMES = {
  'npc-waiting': { cell: 1, family: 'maid', label: '定番メイド', room: 'rose', quote: '着てみると、けっこう楽しいね。' },
  'npc-busy': { cell: 2, family: 'police', label: 'ミニスカポリス', room: 'neon', quote: '今日はポリス役ってことで（笑）' },
  'npc-friends': { cell: 3, family: 'maid', label: 'ピンクメイド', room: 'rose', quote: 'このフリル、思ったより好き。' },
  'npc-eye': { cell: 4, family: 'sailor', label: '赤リボンセーラー', room: 'rose', quote: 'この服、一度着てみたかった。' },
  'npc-earphones': { cell: 5, family: 'swimsuit', label: '紺のスクール水着', room: 'neon', quote: 'このシンプルな感じ、逆に新鮮だね。' },
  'npc-tourist': { cell: 6, family: 'nurse', label: 'ピンクナース', room: 'rose', quote: 'この帽子、ちょっとかわいいかも。' },
  'npc-student': { cell: 7, family: 'sailor', label: '紺襟セーラー', room: 'rose', quote: 'リボン、ちゃんと結べてる？' },
  'npc-reader': { cell: 8, family: 'nurse', label: '白ナース', room: 'rose', quote: 'ドラマの衣装みたい。似合ってる？' },
  'npc-cafe': { cell: 9, family: 'maid', label: 'カフェメイド', room: 'rose', quote: '写真が撮れたら、お茶にしよう。' },
  'npc-jogger': { cell: 10, family: 'gym', label: '体操服＆ブルマ', room: 'neon', quote: 'レトロな体操服、意外と動きやすい！' },
  'npc-prin-student': { cell: null, family: 'bunny', label: '金髪ブラックバニー', room: 'neon', quote: 'うさ耳、ちょっと気に入ったかも。' },
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
    atlasKey: palette === 'prin' ? 'goal-costumes-bunny-prin' : `goal-costumes-retail-${palette}`,
    atlasPath: palette === 'prin' ? 'assets/ai/costumes-bunny-prin.png' : `assets/ai/costumes-retail-${palette}.png`,
    portraitKey: `goal-portrait-retail-${base}-${palette}`,
    roomKey: `goal-bedroom-${costume.room}`,
    roomPath: `assets/ai/bedroom-${costume.room}.png`,
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
