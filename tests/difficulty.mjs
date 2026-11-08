import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { DIFFICULTIES } from '../storage.js';
import { playerForDifficulty } from '../player-appearance.js';
import { startTestServer } from './helpers.mjs';

assert.deepEqual(DIFFICULTIES.map(d=>d.persona),['ガチイケ','フツメン','おじさん']);
assert.equal(playerForDifficulty('invalid').difficulty,'easy');
assert.equal(new Set(DIFFICULTIES.map(d=>playerForDifficulty(d.key).portraitKey)).size,3);
const server=await startTestServer();await mkdir('test-results/difficulty',{recursive:true});
async function tap(page,scene,property){
  const p=await page.evaluate(({scene,property})=>{const s=window.cityApproachGame.scene.keys[scene],o=s[property],b=o.getBounds(),r=s.game.canvas.getBoundingClientRect();
    return {x:r.x+(o.buttonWidth?o.x+o.buttonWidth/2:b.centerX),y:r.y+(o.buttonHeight?o.y+o.buttonHeight/2:b.centerY)};},{scene,property});
  await page.touchscreen.tap(p.x,p.y);
}
try{
for(const engine of ['chromium','webkit']){
  const browser=await ({chromium,webkit}[engine]).launch();
  try{
    const page=await browser.newPage({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
    const rates=[],hashes=new Set();
    for(let index=0;index<3;index++){
      const difficulty=DIFFICULTIES[index],player=playerForDifficulty(difficulty.key);
      if(index){
        await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.scene.start('TitleScene'));
        await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TitleScene.startText?.active);
        await tap(page,'TitleScene','diffButton');
      }
      const title=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TitleScene,b=t.diffText.getBounds();
        return {key:t.difficulty.key,text:t.diffText.text,texture:t.iconImage.texture.key,fits:b.x>=0&&b.right<=t.scale.width};});
      assert.equal(title.key,difficulty.key);assert(title.text.includes(difficulty.persona));assert.equal(title.texture,player.portraitKey);assert(title.fits);
      await page.screenshot({path:`test-results/difficulty/${engine}-${difficulty.key}-title.png`});
      await tap(page,'TitleScene','startText');
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.player?.active);
      const main=await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;
        const image=m.textures.get(m.playerAppearance.portraitKey).getSourceImage(),bytes=image.getContext('2d').getImageData(0,0,512,512).data;
        let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;
        return {key:m.difficulty.key,texture:m.player.texture.key,rate:m.estimateActionRate({interest:50,traits:[]},'weather'),hash};});
      assert.equal(main.key,difficulty.key);assert.equal(main.texture,player.spriteKey);assert(!hashes.has(main.hash));hashes.add(main.hash);rates.push(main.rate);
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(animation=>window.cityApproachGame.scene.keys.MainScene.player.anims.currentAnim?.key===animation,player.animationKey);
      await page.keyboard.up('ArrowRight');
      // Exercise the real in-field toggle twice more to return to the same identity.
      for(let n=0;n<3;n++)await tap(page,'MainScene','difficultyButton');
      assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.MainScene.playerAppearance.difficulty),difficulty.key);
      await page.evaluate(key=>window.cityApproachGame.scene.keys.MainScene.scene.start('TalkScene',{
        difficulty:key,profile:{styleLabel:'大学生',traits:['暇','プリン髪','大学生'],interest:80},
        npcTextureKey:'npc-prin-student-0',portraitTextureKey:'ai_npc_prin_student_raw',
      }),difficulty.key);
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TalkScene?.lineText?.active);
      assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.difficulty.key),difficulty.key);
      await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;t.time.removeAllEvents();t.favor=100;t.discomfort=0;t.invitationAccepted=true;t.showFinal(true);t.returnToField();});
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene?.player?.active);
      assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.player.texture.key),player.spriteKey);
      await page.setViewportSize({width:568,height:320});
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.scale.width===568);
      await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.questionsAnswered=4;e.nextQuestionIndex=4;e.destinationConfirmed=true;e.player.x=2900;e.partner.x=2832;});
      await page.waitForFunction(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.goalArt?.active&&!e.cameras.main.fadeEffect.isRunning;});
      const goal=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;
        return {portrait:e.goalArt.list[2].texture.key,difficulty:e.runData.difficulty,room:e.goalSelection.roomPath};});
      assert.equal(goal.portrait,player.portraitKey);assert.equal(goal.difficulty,difficulty.key);assert(goal.room.includes('bedroom-'));
      await page.screenshot({path:`test-results/difficulty/${engine}-${difficulty.key}-goal.png`});
      await page.setViewportSize({width:320,height:568});
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.scale.width===320);
    }
    assert(rates[0]>rates[1]&&rates[1]>rates[2],'same encounter becomes harder for each setting');
    await page.reload();await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TitleScene?.startText?.active);
    assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TitleScene.difficulty.key),'hard','selection persists across reload');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${engine}: three distinct protagonists, title/field touch toggles, movement, conversation/goal continuity, rotation, saved selection, difficulty effects`);
  }finally{await browser.close();}
}
}finally{await server.close();}
