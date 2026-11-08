import { DIFFICULTIES } from './storage.js?v=20261108-cast1';

export const PLAYER_CAST_KEY = 'player-cast-atlas';
export const PLAYER_CAST_PATH = 'assets/ai/player-cast.png';

export function playerForDifficulty(key = 'easy') {
  const difficulty = DIFFICULTIES.find(d => d.key === key) || DIFFICULTIES[0];
  const base = difficulty.key === 'easy' ? 'player' : `player-${difficulty.key}`;
  return { difficulty: difficulty.key, name: difficulty.persona, base,
    spriteKey: `${base}-0`, animationKey: `${base}-walk`,
    portraitKey: difficulty.key === 'easy' ? 'ai_player_raw' : `ai_player_${difficulty.key}_raw` };
}

export function buildPlayerCast(scene) {
  const source = scene.textures.get(PLAYER_CAST_KEY).getSourceImage();
  DIFFICULTIES.forEach((difficulty, index) => {
    const player = playerForDifficulty(difficulty.key);
    if (!scene.textures.exists(player.portraitKey)) {
      const width = source.width / 3, height = source.height;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const scale = 512 / Math.max(width, height);
      canvas.getContext('2d').drawImage(source, index * width, 0, width, height,
        (512-width*scale)/2, (512-height*scale)/2, width*scale, height*scale);
      scene.textures.addCanvas(player.portraitKey, canvas);
    }
    for (let frame=0;frame<2;frame++) {
      const key = `${player.base}-${frame}`;
      if (scene.textures.exists(key)) continue;
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=48;
      canvas.getContext('2d').drawImage(scene.textures.get(player.portraitKey).getSourceImage(),0,0,48,48);
      scene.textures.addCanvas(key,canvas)._modeKey='icon';
    }
    if (!scene.anims.exists(player.animationKey)) scene.anims.create({
      key:player.animationKey,frames:[{key:`${player.base}-0`},{key:`${player.base}-1`}],frameRate:6,repeat:-1,
    });
  });
}
