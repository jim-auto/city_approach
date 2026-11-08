import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { walkQuestion, walkReplyEffect, WALK_REPLY_KEYS } from '../escort-conversation.js';
import { encounterFor } from '../encounter-rules.js';
import { startTestServer } from './helpers.mjs';

const profiles = [
  {styleLabel:'大学生',traits:['暇','プリン髪','大学生']},
  {traits:['歩くの速い']}, {traits:['友達といる']}, {styleLabel:'地雷系'},
  {styleLabel:'専門学生'}, {styleLabel:'大学生'}, {},
];
assert.deepEqual(profiles.map(p=>encounterFor(p).key),['casual','rushed','friends','cautious','creative','student','neutral']);
for(const profile of profiles) for(let i=0;i<4;i++) {
  const q=walkQuestion(profile,i);
  assert.deepEqual(q.cards.map(c=>c.key),WALK_REPLY_KEYS);
  assert(walkReplyEffect(profile,q,'explain').gain>=8,'safe reply always progresses');
  assert.equal(walkReplyEffect(profile,q,'evade').gain,0);
}
const effect=(p,key)=>walkReplyEffect(p,walkQuestion(p,1),key);
assert(effect(profiles[0],'check').gain>effect(profiles[3],'check').gain,'same joke depends on companion');
assert(effect(profiles[4],'spark').gain>effect(profiles[1],'spark').gain,'style compliment depends on companion');
console.log('PASS seven personalities: safe replies, different reactions and bonuses');

const server=await startTestServer();
await mkdir('test-results/escort',{recursive:true});
try {
for(const [engine,width,height,profile] of [
  ['chromium',320,568,profiles[0]], ['webkit',568,320,profiles[3]], ['chromium',390,844,profiles[4]],
]) {
  const browser=await ({chromium,webkit}[engine]).launch();
  try {
    const page=await browser.newPage({viewport:{width,height},hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
    await page.evaluate(()=>window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.player?.active);
    await page.evaluate(profile=>window.cityApproachGame.scene.keys.MainScene.scene.start('EscortScene',{
      score:10,companion:{textureKey:'npc-prin-student-0',portraitTextureKey:'ai_npc_prin_student_raw',profile},
    }),profile);
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene?.player?.active);
    assert(await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return !e.jumpButton&&!e.walkAction;}));
    let expected=10;
    for(let i=0;i<4;i++) {
      await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.beginConversation());
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.dialogState==='asking');
      const cards=page.locator('.game-native-buttons[data-scene="EscortScene"] button');
      assert.equal(await cards.count(),4);
      const geometry=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;
        return e.replyButtons.every(b=>{const t=b.list[1].getBounds();return b.buttonHeight>=44&&b.buttonWidth>=44&&t.x>=b.x&&t.right<=b.x+b.buttonWidth&&t.y>=b.y&&t.bottom<=b.y+b.buttonHeight;});});
      assert(geometry,'all four reply texts fit their touch targets');
      if(i===0){
        await page.waitForTimeout(1100);
        assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.dialogState),'asking','no pressure to answer quickly');
        await page.screenshot({path:`test-results/escort/${engine}-${width}-cards.png`});
        await page.setViewportSize({width:height,height:width});
        await page.waitForFunction(({width,height})=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.scale.width===height&&e.scale.height===width;},{width,height});
        assert.equal(await cards.filter({visible:true}).count(),4,'rotation preserves every reply');
        await page.setViewportSize({width,height});
        await page.waitForFunction(({width,height})=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.scale.width===width&&e.scale.height===height;},{width,height});
      }
      const key=engine==='chromium'&&width===320&&(i===0||i===1)?(i===0?'spark':'check'):'explain';
      await page.locator(`.game-native-buttons[data-scene="EscortScene"] button[data-choice="${key}"]`).tap();
      await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.dialogState==='reply');
      const result=await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return {score:e.score,bonus:e.conversationBonus,chain:e.replyChain,body:e.dialogueBody};});
      const reward=walkReplyEffect(profile,walkQuestion(profile,i),key);
      expected+=reward.gain+(result.chain===2?10:0);
      assert.equal(result.score,expected);assert.equal(result.bonus,expected-10);
      assert(result.body.includes(reward.reaction));
      await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.chooseWalkReply('explain');});
      assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.score),expected,'duplicate activation cannot award twice');
      if(i===0) await page.screenshot({path:`test-results/escort/${engine}-${width}-reaction.png`});
      await page.waitForFunction(()=>!window.cityApproachGame.scene.keys.EscortScene.currentQuestion);
    }
    await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;e.player.x=2900;e.partner.x=2832;});
    await page.waitForFunction(()=>window.cityApproachGame.scene.keys.EscortScene.outcome==='goal');
    assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.score),expected+100);
    await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.scene.restart({score:10}));
    await page.waitForFunction(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return !e.finished&&e.player?.active;});
    for(let i=0;i<3;i++) {
      await page.evaluate(()=>window.cityApproachGame.scene.keys.EscortScene.beginConversation());
      await page.locator('.game-native-buttons[data-scene="EscortScene"] button[data-choice="evade"]').tap();
      if(i<2) await page.waitForFunction(()=>!window.cityApproachGame.scene.keys.EscortScene.currentQuestion);
    }
    assert(await page.evaluate(()=>{const e=window.cityApproachGame.scene.keys.EscortScene;return e.outcome==='breakdown'&&e.score===10&&!e.goalArt;}));
    assert.deepEqual(errors,[]);
    console.log(`PASS ${engine} ${width}x${height}: four live touch flips, reactions, score/chain, easy goal, repeated evasion failure`);
  } finally { await browser.close(); }
}
} finally { await server.close(); }
