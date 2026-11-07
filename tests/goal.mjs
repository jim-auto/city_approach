import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { getDifficulty, setDifficulty } from '../storage.js';
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
 await page.evaluate(()=>window.cityApproachGame.scene.keys.MainScene.scene.start('EscortScene',{score:10}));
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene?.player?.active);
 await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.nextQuestionIndex=4;e.questionsAnswered=4;e.destinationConfirmed=true;e.player.x=2900;e.partner.x=2832;});
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.finished);
 await page.waitForFunction(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.goalTitle?.alpha===1 && !e.tweens.isTweening(e.goalTitle);});
 const goal=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;const score=e.score;e.finish();return {title:e.goalTitle.text,active:e.goalTitle.active,scale:e.goalTitle.scaleX,particles:e.goalConfetti.length,score:e.score,previous:score,bounds:{x:e.goalTitle.getBounds().x,y:e.goalTitle.getBounds().y,right:e.goalTitle.getBounds().right,bottom:e.goalTitle.getBounds().bottom},width:e.scale.width,height:e.scale.height};});
 assert.equal(goal.title,'ゴール！');assert(goal.active);assert.equal(goal.score,110);assert.equal(goal.score,goal.previous);
 assert(Math.abs(goal.scale-1)<.01);
 assert.equal(goal.particles,reduced?0:40);
 assert(goal.bounds.x>=0 && goal.bounds.y>=0 && goal.bounds.right<=goal.width && goal.bounds.bottom<=goal.height);
 await page.screenshot({path:`test-results/easy-goal/${engine}-${width}${reduced?'-reduced':''}.png`});
 await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.scene.restart({score:10});});
 await page.waitForFunction(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return !e.finished && e.goalTitle===null;});
 await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;for(let i=0;i<3;i++){e.beginConversation();e.chooseWalkReply('evade');if(!e.finished)e.closeConversation();}});
 assert(await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.outcome==='breakdown' && !e.goalTitle && e.goalConfetti.length===0;}),'failure must not celebrate or reuse a destroyed goal title');
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine} ${width}x${height}: goal animation, score once, restart/failure cleanup${reduced?', reduced motion':''}`);
 }finally{await browser.close();}
}
}finally{await server.close();}
