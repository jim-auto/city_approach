import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { getDifficulty, setDifficulty } from '../storage.js';
import { goalCostumeFor } from '../goal-costumes.js';
import { startTestServer } from './helpers.mjs';

const saved=new Map();
globalThis.window={localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}};
assert.equal(getDifficulty().key,'easy');
setDifficulty('hard');assert.equal(getDifficulty().key,'hard','explicit selection is retained');
saved.set('city_approach_difficulty','invalid');assert.equal(getDifficulty().key,'easy');
delete globalThis.window;
console.log('PASS easy default, saved choice, and invalid setting fallback');
const server=await startTestServer();await mkdir('test-results/easy-goal',{recursive:true});
try{
for(const [engine,width,height,reduced] of [['chromium',320,568,false],['webkit',568,320,false],['chromium',390,844,true]]){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
 const page=await browser.newPage({viewport:{width,height},hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.url);
 await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
 assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TitleScene.difficulty.key),'easy');
 await page.evaluate(()=>window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.player?.active);
 const companionKey = reduced ? 'npc-prin-student' : engine === 'webkit' ? 'npc-friends-chic' : 'npc-waiting-pastel';
 const portraitKey = reduced ? 'ai_npc_prin_student_raw' : engine === 'webkit' ? 'ai_npc_friends_raw_chic' : 'ai_npc_waiting_raw_pastel';
 await page.evaluate(({companionKey,portraitKey})=>window.cityApproachGame.scene.keys.MainScene.scene.start('EscortScene',
  {score:10,companion:{textureKey:`${companionKey}-0`,portraitTextureKey:portraitKey}}),{companionKey,portraitKey});
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene?.player?.active);
 await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.conversationBonus=80;e.score+=80;e.nextQuestionIndex=e.questionCount;e.questionsAnswered=e.questionCount;e.destinationConfirmed=true;e.player.x=2900;e.partner.x=2832;});
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.finished);
 await page.waitForFunction(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.goalTitle?.alpha===1 && !e.tweens.isTweening(e.goalTitle);});
 const goal=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;const score=e.score;e.finish();return {title:e.goalTitle.text,active:e.goalTitle.active,scale:e.goalTitle.scaleX,particles:e.goalConfetti.length,score:e.score,previous:score,bounds:{x:e.goalTitle.getBounds().x,y:e.goalTitle.getBounds().y,right:e.goalTitle.getBounds().right,bottom:e.goalTitle.getBounds().bottom},width:e.scale.width,height:e.scale.height};});
 assert.equal(goal.title,'ゴール！');assert(goal.active);assert.equal(goal.score,190);assert.equal(goal.score,goal.previous);
 assert(Math.abs(goal.scale-1)<.01);
 assert.equal(goal.particles,reduced?0:40);
 assert(goal.bounds.x>=0 && goal.bounds.y>=0 && goal.bounds.right<=goal.width && goal.bounds.bottom<=goal.height);
 const art=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;
  return {x:e.goalArt.x,y:e.goalArt.y,width:e.goalArt.width,height:e.goalArt.height,
   textures:e.goalArt.list.filter(o=>o.texture).map(o=>o.texture.key)};});
 const selection=goalCostumeFor(`${companionKey}-0`);
 assert.deepEqual(art.textures,[selection.roomKey,selection.family === 'bunny' ? 'goal-player-easy' : 'ai_player_raw',selection.portraitKey],'CG must keep the actual companion and palette');
 assert(art.x>=0 && art.y>=0 && art.x+art.width<=width && art.y+art.height<=height,'CG stays inside the viewport');
 assert(await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;
  const a=new Phaser.Geom.Rectangle(e.goalArt.x,e.goalArt.y,e.goalArt.width,e.goalArt.height);
  const body=e.finishText.getBounds(),button=e.returnButton.getBounds();
  return !Phaser.Geom.Rectangle.Overlaps(a,body) && body.bottom<button.top && button.width>=44 && button.height>=44;
 }),'conversation reward text must fit between the CG and return button');
 const screenshot=await page.screenshot({path:`test-results/easy-goal/${engine}-${width}${reduced?'-reduced':''}.png`});
 // Inspect the rendered frame, rather than just checking that scene objects exist.
 const pixels=await page.evaluate(async({png,art})=>{
  const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const colors=new Set();let bright=0,total=0;
  for(let y=art.y+8;y<art.y+art.height-8;y+=5)for(let x=art.x+8;x<art.x+art.width-8;x+=5){
   const [r,g,b]=ctx.getImageData(x,y,1,1).data;colors.add(`${r>>4},${g>>4},${b>>4}`);
   if(Math.max(r,g,b)>90)bright++;total++;
  }
  return {colors:colors.size,bright:bright/total};
 },{png:screenshot.toString('base64'),art});
 assert(pixels.colors>100 && pixels.bright>.35,`CG rendered as blank/dark: ${JSON.stringify(pixels)}`);
 await page.setViewportSize({width:height,height:width});
 await page.waitForFunction(({width,height})=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.scale.width===height && e.scale.height===width;},{width,height});
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 assert(await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;
  return e.goalArt.list.length===4 && e.goalArt.x+e.goalArt.width<=e.scale.width && e.goalArt.y+e.goalArt.height<=e.scale.height;
 }),'rotation preserves the CG without duplicating layers');
 await page.screenshot({path:`test-results/easy-goal/${engine}-${width}-rotated.png`});
 await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.scene.restart({score:10});});
 await page.waitForFunction(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return !e.finished && e.goalTitle===null;});
 await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;for(let i=0;i<3;i++){e.beginConversation();e.chooseWalkReply('evade');if(!e.finished)e.closeConversation();}});
 assert(await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.outcome==='breakdown' && !e.goalTitle && !e.goalArt && e.goalConfetti.length===0;}),'failure must not celebrate or reuse a destroyed goal title');
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine} ${width}x${height}: illustrated CG/pixels, companion identity, rotation, goal animation, score once, restart/failure cleanup${reduced?', reduced motion':''}`);
 }finally{await browser.close();}
}
}finally{await server.close();}
