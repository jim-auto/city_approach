import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { PREFERENCES, compatibilityFor } from '../attraction.js';
import { DIFFICULTIES, HEIGHTS } from '../storage.js';
import { startTestServer } from './helpers.mjs';
for (const preference of PREFERENCES) for (const d of DIFFICULTIES) for (const h of HEIGHTS) {
  const c=compatibilityFor({preferenceKey:preference.key},{difficulty:d.key,height:h.key});
  const rejected=d.key==='hard' && (preference.key==='no-oji' || preference.key==='tall-oji' && h.key==='short');
  assert.equal(c.eligible,!rejected,`${preference.key}/${d.key}/${h.key}`);
}
assert(compatibilityFor({preferenceKey:'oji'},{difficulty:'hard',height:'short'}).rateMod > compatibilityFor({preferenceKey:'oji'},{difficulty:'easy',height:'tall'}).rateMod);
assert(compatibilityFor({preferenceKey:'tall-oji'},{difficulty:'hard',height:'tall'}).favorMod>0);
assert(compatibilityFor({preferenceKey:'tall'},{difficulty:'normal',height:'short'}).eligible);
console.log('PASS 36 combinations: individual exclusions, tall older men, older-man preference, and soft preferences');
const server=await startTestServer();await mkdir('test-results/player-types',{recursive:true});
async function tap(page,scene,key,index) {
 const p=await page.evaluate(({scene,key,index})=>{const s=window.cityApproachGame.scene.keys[scene],b=index===undefined?s[key]:s[key][index],r=s.game.canvas.getBoundingClientRect(),box=b.getBounds();return {x:r.x+(b.buttonWidth?b.x+b.buttonWidth/2:box.centerX),y:r.y+(b.buttonHeight?b.y+b.buttonHeight/2:box.centerY)};},{scene,key,index});
 await page.touchscreen.tap(p.x,p.y);
}
try {
 for(const engine of (process.env.TYPE_BROWSERS || 'chromium,webkit').split(',')) {
  const browser=await ({chromium,webkit}[engine]).launch();
  try {
   const page=await browser.newPage({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});await page.goto(server.url);
   await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.heightButton?.active);
   for(let face=0;face<3;face++) for(let height=0;height<2;height++) {
    if(face || height) {
     await page.evaluate(()=>{const g=window.cityApproachGame;['MainScene','TalkScene','EscortScene'].forEach(k=>g.scene.stop(k));g.scene.start('TitleScene');});
     await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TitleScene?.heightButton?.active);
     if(!height) await tap(page,'TitleScene','diffButton');
     await tap(page,'TitleScene','heightButton');
    }
    const desired=HEIGHTS[height], d=DIFFICULTIES[face];
    const title=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TitleScene;return {face:t.difficulty.key,height:t.height.key,labels:[t.diffText.text,t.heightText.text],bounds:[t.diffButton,t.heightButton,t.diffText,t.heightText].map(o=>{const b=o.getBounds();return [b.x,b.y,b.right,b.bottom];})};});
    assert.equal(title.face,d.key);assert.equal(title.height,desired.key);
    assert(title.labels[0].includes(d.persona)&&title.labels[1].includes(desired.label));
    assert(title.bounds.every(([x,y,r,b])=>x>=0&&y>=0&&r<=320&&b<=568));
    await page.screenshot({path:`test-results/player-types/${engine}-${d.key}-${desired.key}-title.png`});
    await tap(page,'TitleScene','startText');
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.heightButton?.active);
    const field=await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;return {height:m.height.key,face:m.difficulty.key,scale:m.player.scaleY,prefs:m.npcs.map(n=>n.profile.preferenceKey),bounds:[m.difficultyButton,m.heightButton,m.mapButton].map(o=>({x:o.x,r:o.x+o.buttonWidth}))};});
    assert.equal(field.face,d.key);assert.equal(field.height,desired.key);assert.equal(field.scale,1.6*desired.figureScale);
    assert(field.prefs.every(p=>PREFERENCES.some(v=>v.key===p)));assert(new Set(field.prefs).size===Math.min(field.prefs.length,PREFERENCES.length));
    assert(field.bounds[0].r<field.bounds[1].x&&field.bounds[1].r<field.bounds[2].x);
    // A native opener exercises the production Main -> Talk payload.
    await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;m.npcs.forEach((n,i)=>{if(i)n.disabled=true;else{n.sprite.setPosition(m.player.x+40,m.player.y);n.speed=0;}});m.nearNpc=m.npcs[0];m.nearNpc.profile.preferenceKey='open';m.calculateSuccessRate=()=>1;});
    await tap(page,'MainScene','actionButtons',0);
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TalkScene?.sys.isActive());
    assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.height.key),desired.key);
    // Isolate the final invitation; the preceding calm-reply path has separate coverage.
    await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;t.time.removeAllEvents();t.lineIndex=3;t.favor=100;t.discomfort=0;t.resolvedConcerns=new Set(['safety','time','vibe','pace']);t.nextLine();});
    await page.locator('.game-native-buttons[data-scene="TalkScene"] button').nth(3).tap();
    if(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.sys.isActive())) {
      await tap(page,'TalkScene','resultButton');
    }
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene?.player?.active);
    assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.runData.height),desired.key);
    await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.nextQuestionIndex=e.questionsAnswered=e.questionCount;e.destinationConfirmed=true;e.player.x=2900;e.partner.x=2832;});
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.goalArt?.active);
    const ending=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;const [male,female]=e.goalArt.list.slice(2);return {height:e.height.key,ratio:male.texture.customData.goalBounds.height*male.scaleY/(female.texture.customData.goalBounds.height*female.scaleY),playerKey:male.texture.key};});
    assert.equal(ending.height,desired.key);assert(Math.abs(ending.ratio-desired.figureScale)<.001);assert(ending.playerKey.includes(d.key));
    await page.screenshot({path:`test-results/player-types/${engine}-${d.key}-${desired.key}-goal.png`});
   }
   // Height changes retain the encounter's preference and alter its real availability.
   await page.evaluate(()=>{const g=window.cityApproachGame;g.scene.stop('EscortScene');g.scene.start('MainScene');});
   await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.heightButton?.active);
   await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;m.npcs.forEach((n,i)=>{if(i)n.disabled=true;else{n.sprite.setPosition(m.player.x+40,m.player.y);n.speed=0;}});m.nearNpc=m.npcs[0];m.nearNpc.profile.preferenceKey='tall-oji';});
   const rates=()=>page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;return {rate:m.estimateActionRate(m.npcs[0].profile,'weather'),pref:m.npcs[0].profile.preferenceKey,height:m.height.key};});
   assert.equal((await rates()).rate,0);
   await tap(page,'MainScene','heightButton');
   assert((await rates()).rate>0);assert.equal((await rates()).pref,'tall-oji');
   await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;m.npcs[0].profile.preferenceKey='no-oji';m.nearNpc=m.npcs[0];});
   await tap(page,'MainScene','actionButtons',0);
   assert(await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;return m.sys.isActive()&&!m.approachPending&&m.messageText.text.includes('年上');}));
   // A perfect conversation cannot override an explicit incompatible preference.
   await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;m.scene.start('TalkScene',{difficulty:'hard',height:'tall',profile:{traits:[],preferenceKey:'no-oji',interest:100}});});
   await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TalkScene?.sys.isActive());
   await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;t.time.removeAllEvents();t.favor=100;t.discomfort=0;t.lineIndex=3;t.resolvedConcerns=new Set(['a','b','c','d']);t.nextLine();});
   await page.locator('.game-native-buttons[data-scene="TalkScene"] button').nth(3).tap();
   assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.invitationAccepted),false);
   // Low initial interest and a soft mismatch still permit the full calm-reply route.
   await page.evaluate(()=>{const g=window.cityApproachGame;g.scene.stop('TalkScene');g.scene.start('TalkScene',{
     difficulty:'hard',height:'short',profile:{traits:[],styleLabel:'地雷系',preferenceKey:'looks',interest:5}
   });});
   await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TalkScene?.sys.isActive() && window.cityApproachGame.scene.keys.TalkScene.lineIndex===0);
   for(let round=0;round<5;round++) {
     await page.waitForFunction(round=>{const t=window.cityApproachGame.scene.keys.TalkScene;return t.lineIndex===round&&!t.choiceLocked;},round);
     const index=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene,l=t.lines[t.lineIndex];return l.isClosing?3:l.cards.findIndex(c=>c.safe&&!l.correct.includes(c.key));});
     await page.locator('.game-native-buttons[data-scene="TalkScene"] button').nth(index).tap();
   }
   assert(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.invitationAccepted),'a soft mismatch must stay playable with calm replies');
   for(const [width,height] of [[568,320],[320,568]]) {
    await page.setViewportSize({width,height});await page.evaluate(()=>{const g=window.cityApproachGame;['TalkScene','EscortScene'].forEach(k=>g.scene.stop(k));g.scene.start('TitleScene');});
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TitleScene?.heightButton?.active);
    const fits=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TitleScene;return [t.diffButton,t.heightButton,t.diffText,t.heightText].every(o=>{const b=o.getBounds();return b.x>=0&&b.y>=0&&b.right<=t.scale.width&&b.bottom<=t.scale.height;});});
    assert(fits);await page.screenshot({path:`test-results/player-types/${engine}-${width}-selectors.png`});
   }
   await page.reload();await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.heightButton?.active);
   assert.deepEqual(await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TitleScene;return [t.difficulty.key,t.height.key];}),['hard','tall']);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: six selections, actual field/talk/goal handoff, persistent preferences, height-dependent availability, NG rejection, rotation and saved settings`);
  } finally {await browser.close();}
 }
}finally{await server.close();}
