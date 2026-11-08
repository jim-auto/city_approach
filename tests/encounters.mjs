import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { encounterFor, replyEffect } from '../encounter-rules.js';
import { buildFlipLines } from '../conversation-flips.js';
import { startTestServer } from './helpers.mjs';

const profiles = [
  { key: 'casual', age: 21, type: '暇なプリン髪大学生', styleLabel: '大学生 / プリン髪', interest: 72, traits: ['大学生','プリン髪','暇'], flags: [] },
  { key: 'rushed', age: 22, styleLabel: '大学生', interest: 50, traits: ['歩くの速い'], flags: [] },
  { key: 'friends', age: 23, styleLabel: '大学生', interest: 50, traits: ['友達といる'], flags: [] },
  { key: 'cautious', age: 21, styleLabel: '地雷系', interest: 50, traits: [], flags: [] },
  { key: 'creative', age: 20, styleLabel: '美容専門学生', interest: 50, traits: [], flags: [] },
  { key: 'student', age: 21, styleLabel: '文系大学生', interest: 50, traits: [], flags: [] },
  { key: 'neutral', age: 24, styleLabel: 'カフェバイト', interest: 50, traits: [], flags: [] },
];
const linesFor = p => buildFlipLines(p, 'nagoya', items => items);
const vibeFor = p => linesFor(p).find(l => l.concern === 'vibe');
const [casual, rushed, friends, cautious, creative] = profiles;
for (const profile of profiles) {
  assert.equal(encounterFor(profile).key, profile.key);
  const lines = linesFor(profile);
  assert.equal(lines.length, 5);
  assert.equal(new Set(lines.slice(0,4).map(l=>l.concern)).size, 4);
  assert(lines.every(l=>l.cards.length===4 && l.correct.length===1));
  assert(lines.at(-1).cards[3].text.includes('ラブホテル'));
}
// Every type can progress using only calm replies, without affinity bonuses.
for (const profile of profiles) {
  const type = encounterFor(profile);
  let favor = 42 + Math.round((profile.interest - 50) * .35) + type.startFavor;
  let guard = 24 + type.startGuard;
  for (const line of linesFor(profile).slice(0, 4)) {
    const calm = line.cards.find(c => c.safe && !line.correct.includes(c.key));
    assert(calm, `${profile.key}/${line.concern} needs a calm alternative`);
    const effect = replyEffect(profile, line, calm.key, 0);
    assert.equal(effect.quality, 'safe');
    assert(effect.favor >= 0 && effect.guard <= 0);
    favor = Math.min(100, favor + effect.favor); guard = Math.max(0, guard + effect.guard);
    for (const card of line.cards.filter(c => !c.safe && !line.correct.includes(c.key))) {
      assert.equal(replyEffect(profile, line, card.key).quality, 'miss');
    }
  }
  assert(favor >= type.inviteAt && guard < 60, `${profile.key} calm path must qualify`);
}
const casualVibe = vibeFor(casual);
const banter = casualVibe.cards.find(c=>c.strategy==='banter').key;
assert.equal(replyEffect(casual,casualVibe,banter).favor,34);
assert.equal(replyEffect(rushed,vibeFor(rushed),banter).favor,16);
assert.equal(replyEffect(rushed,vibeFor(rushed),banter).guard,0);
assert.equal(replyEffect(cautious,vibeFor(cautious),'listen').favor,34);
assert.equal(replyEffect(creative,vibeFor(creative),'proposal').favor,34);
const friendLine=linesFor(friends).find(l=>l.concern==='friend');
assert.equal(replyEffect(friends,friendLine,friendLine.correct[0]).favor,34);
const safe=linesFor(casual)[0], miss=safe.cards.find(c=>!c.safe && !safe.correct.includes(c.key)).key;
assert.equal(replyEffect(casual,safe,miss).guard,14);
assert.equal(replyEffect(cautious,safe,miss).guard,30);
assert.equal(encounterFor(casual).inviteAt,60);
assert.equal(encounterFor(cautious).inviteAt,78);
assert.notEqual(encounterFor({...casual,traits:['大学生','プリン髪']}).key,'casual','hair alone is not the free-afternoon personality');
assert.equal(encounterFor({...casual,traits:[...casual.traits,'歩くの速い']}).key,'rushed');
assert.equal(encounterFor({traits:['夜の警戒']}).key,'cautious');
console.log('PASS attribute balancing: same card differs by situation, four preferred strategies, different guard and invitation thresholds');

const output='test-results/encounters';await mkdir(output,{recursive:true});
const server=await startTestServer();
try {
for(const engine of (process.env.ENCOUNTER_BROWSERS || 'chromium,webkit').split(',')) {
 const browser=await ({chromium,webkit}[engine]).launch();
 try {
 const page=await browser.newPage({viewport:{width:320,height:568},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url);
 await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
 await page.evaluate(()=>window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.npcs?.length);
 const field=await page.evaluate(()=>{const m=window.cityApproachGame.scene.keys.MainScene;return {adults:m.npcs.every(n=>n.profile.age>=20),prin:m.npcs.some(n=>n.sprite.texture.key.startsWith('npc-prin-student')),illustrated:m.textures.get('npc-prin-student-0')._modeKey==='icon'};});
 assert(field.adults && field.prin && field.illustrated,'adult special NPC is spawned with illustrated art');
 for(const [width,height] of [[320,568],[568,320]]) {
  await page.setViewportSize({width,height});
  for(const profile of profiles) {
   await page.evaluate(profile=>{const g=window.cityApproachGame;g.scene.stop('TalkScene');g.scene.stop('EscortScene');g.scene.stop('MainScene');
    g.scene.start('TalkScene',{profile,mapKey:'nagoya',npcTextureKey:'npc-prin-student-0',portraitTextureKey:'ai_npc_prin_student_raw'});
   },profile);
   await page.waitForFunction(key=>{const t=window.cityApproachGame.scene.keys.TalkScene;return t?.sys.isActive() && t.profile.key===key && t.choiceButtons?.[0]?.active;},profile.key);
   const index=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;t.time.removeAllEvents();t.lineIndex=t.lines.findIndex(l=>l.concern==='vibe')-1;t.nextLine();t.lineDuration=60000;return ['listen','empathy','tsukkomi','proposal'].indexOf(t.lines[t.lineIndex].correct[0]);});
   const buttons=page.locator('.game-native-buttons[data-scene="TalkScene"] button');
   await buttons.nth(index).tap();
   const state=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;return {gain:t.lastReplyEffect.favor,resolved:t.resolvedConcerns.size,topic:t.topicText.text};});
   assert(state.gain>=20 && state.resolved===1 && state.topic.includes('減点なし'));
   const bounds=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;return [t.topicText,t.lineText,t.feedbackText].map(o=>({text:o.text,x:o.getBounds().x,y:o.getBounds().y,right:o.getBounds().right,bottom:o.getBounds().bottom}));});
   for(const b of bounds) assert(b.x>=-1 && b.y>=0 && b.right<=width+1 && b.bottom<=height+1,`${profile.key} text clipped: ${JSON.stringify(b)}`);
   if(profile.key==='casual' || profile.key==='cautious') await page.screenshot({path:`${output}/${engine}-${profile.key}-${width}.png`});
   await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;t.time.removeAllEvents();t.lineIndex=3;t.favor=60;t.discomfort=10;t.resolvedConcerns=new Set(['safety','vibe','time']);t.nextLine();});
   await buttons.nth(3).tap();
   assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.invitationAccepted),profile.key==='casual',`${profile.key} invitation threshold`);
  }
 }
 // Real native taps through a full conversation, choosing no best-match cards.
 await page.setViewportSize({width:320,height:568});
 await page.evaluate(profile => {
   const g=window.cityApproachGame;
   ['TalkScene','EscortScene','MainScene'].forEach(key=>g.scene.stop(key));
   g.scene.start('TalkScene',{profile,mapKey:'kabukicho',npcTextureKey:'npc-prin-student-0'});
 }, profiles.find(p=>p.key==='cautious'));
 await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TalkScene?.sys.isActive() && window.cityApproachGame.scene.keys.TalkScene.lineIndex===0);
 for(let round=0;round<5;round++) {
   await page.waitForFunction(round=>{const t=window.cityApproachGame.scene.keys.TalkScene;return t.lineIndex===round && !t.choiceLocked;},round);
   const before=await page.evaluate(()=>{
     const t=window.cityApproachGame.scene.keys.TalkScene,l=t.lines[t.lineIndex];
     return {index:l.isClosing?3:l.cards.findIndex(c=>c.safe&&!l.correct.includes(c.key)),guard:t.discomfort,favor:t.favor};
   });
   await page.locator('.game-native-buttons[data-scene="TalkScene"] button').nth(before.index).tap();
   const after=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;return {guard:t.discomfort,favor:t.favor,resolved:t.resolvedConcerns.size,accepted:t.invitationAccepted,result:t.resultShown,topic:t.topicText.text};});
   assert(after.guard<=before.guard && after.favor>=before.favor,'calm replies never cost trust');
   assert.equal(after.resolved,Math.min(round+1,4));
   if(round<4) assert(after.topic.includes('減点なし') && !after.result);
   else assert(after.accepted && after.result,'calm replies alone earn an invitation');
   if(round===1) await page.screenshot({path:`${output}/${engine}-calm-path.png`});
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine}: seven profiles, portrait/landscape taps, attribute effects, and a full calm-reply path`);
 }finally{await browser.close();}
}
}finally{await server.close();}
