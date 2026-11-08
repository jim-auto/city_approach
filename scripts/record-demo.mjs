import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startTestServer } from '../tests/helpers.mjs';

// Record real input and game outcomes. No game state, success rates, scores or
// destination positions are changed. The edit uses marked excerpts of this take.
const output='test-results/demo';
await mkdir(output,{recursive:true});
const server=await startTestServer();
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:480,height:800},hasTouch:true,
  recordVideo:{dir:output,size:{width:480,height:800}}});
const page=await context.newPage();
const started=Date.now(), marks=[], errors=[];
const mark=name=>{const time=(Date.now()-started)/1000;marks.push({name,time});console.log(name,time.toFixed(2));};
page.on('pageerror',e=>errors.push(e.message));
async function tapObject(scene,property,index){
  const p=await page.evaluate(({scene,property,index})=>{
    const s=window.cityApproachGame.scene.keys[scene],o=index===undefined?s[property]:s[property][index];
    const r=s.game.canvas.getBoundingClientRect(),b=o.getBounds();
    return {x:r.x+(o.buttonWidth?o.x+o.buttonWidth/2:b.centerX),y:r.y+(o.buttonHeight?o.y+o.buttonHeight/2:b.centerY)};
  },{scene,property,index});
  await page.touchscreen.tap(p.x,p.y);
}
try {
  await page.goto(server.url);
  await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
  await tapObject('TitleScene','startText');
  await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.player?.active);
  mark('street');
  // Follow the first naturally spawned NPC with keyboard input. Failed takes
  // start a new normal run; success rates and random results are never altered.
  let talking=false;
  for(let attempt=0;attempt<5&&!talking;attempt++){
    const target=await page.evaluate(()=>{
      const s=window.cityApproachGame.scene.keys.MainScene;
      return s.npcs.findIndex(n=>!n.disabled);
    });
    assert(target>=0,'no available encounter');
    for(let step=0;step<140;step++){
      const p=await page.evaluate(index=>{const s=window.cityApproachGame.scene.keys.MainScene,n=s.npcs[index];
        return {dx:n.sprite.x-s.player.x,dy:n.sprite.y-s.player.y,near:s.nearNpc===n};},target);
      if(p.near&&Math.hypot(p.dx,p.dy)<60) break;
      const keys=[];
      if(Math.abs(p.dx)>25) keys.push(p.dx>0?'ArrowRight':'ArrowLeft');
      if(Math.abs(p.dy)>25) keys.push(p.dy>0?'ArrowDown':'ArrowUp');
      for(const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(140);
      for(const k of keys) await page.keyboard.up(k);
    }
    const action=await page.evaluate(()=>{const s=window.cityApproachGame.scene.keys.MainScene;
      return ['weather','outfit','item','joke'].map((key,index)=>({index,rate:s.nearNpc?s.calculateSuccessRate(s.nearNpc.profile,key):0})).sort((a,b)=>b.rate-a.rate)[0];});
    await page.waitForTimeout(650);mark(`approach-${attempt}`);
    await tapObject('MainScene','actionButtons',action.index);
    await page.waitForTimeout(1100);
    talking=await page.evaluate(()=>window.cityApproachGame.scene.isActive('TalkScene') && window.cityApproachGame.scene.keys.TalkScene.fieldTextureKey.startsWith('npc-prin-student'));
    if(!talking && attempt<4){
      // Begin a new unmodified run after a failed opener or a different nearby NPC.
      await page.reload();
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TitleScene?.startText?.active);
      await tapObject('TitleScene','startText');
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.player?.active);
    }
  }
  assert(talking,'no successful opener in this take');
  assert(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.fieldTextureKey.startsWith('npc-prin-student')), 'Record another take: the bunny ending belongs to the first naturally spawned companion');
  mark('talk');
  for(let turn=0;turn<8;turn++){
    const decision=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;
      if(t.resultShown)return {done:true};
      const line=t.lines[t.lineIndex];return {line:t.lineIndex,index:line.cards.findIndex(c=>c.key===line.correct[0])};});
    if(decision.done)break;
    await page.waitForTimeout(turn===0?1900:1000);
    await page.locator('.game-native-buttons[data-scene="TalkScene"] button').nth(decision.index).tap();
    if(turn===0)mark('talk-reaction');
    await page.waitForFunction(line=>{const t=window.cityApproachGame.scene.keys.TalkScene;return t.resultShown||t.lineIndex>line;},decision.line);
  }
  assert(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.resultBonus===120),'conversation must earn the invitation');
  await page.waitForTimeout(900);
  await tapObject('TalkScene','resultButton');
  await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene?.player?.active);
  mark('walk');
  for(let i=0;i<4;i++){
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.dialogState==='asking',null,{timeout:60000});
    await page.keyboard.up('ArrowRight');
    mark(`question-${i}`);
    await page.waitForTimeout(1300);
    const key=i===0?'evade':i===1?'check':'explain';
    await page.locator(`.game-native-buttons[data-scene="EscortScene"] button[data-choice="${key}"]`).tap();
    mark(`reaction-${i}`);
    await page.waitForFunction(()=>!window.cityApproachGame.scene.keys.EscortScene.currentQuestion);
    if(i===3)mark('arrival-walk');
  }
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.outcome==='goal',null,{timeout:60000});
  await page.keyboard.up('ArrowRight');
  assert(await page.evaluate(()=>{const s=window.cityApproachGame.scene.keys.EscortScene.goalSelection;return s.family==='bunny'&&s.roomPath.includes('bedroom-');}), 'demo must end with the actual bunny costume in the guest bedroom');
  mark('goal');
  await page.waitForTimeout(4500);
  await page.screenshot({path:`${output}/goal.png`});
  assert.deepEqual(errors,[]);
} finally {
  const video=page.video();
  await context.close();
  const path=await video.path();
  await writeFile(`${output}/take.json`,JSON.stringify({video:path,marks,errors},null,2));
  await browser.close();await server.close();
}
