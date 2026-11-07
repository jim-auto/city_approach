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
const casualVibe = vibeFor(casual);
const banter = casualVibe.cards.find(c=>c.strategy==='banter').key;
assert.equal(replyEffect(casual,casualVibe,banter).favor,34);
assert.equal(replyEffect(rushed,vibeFor(rushed),banter).favor,4);
assert.equal(replyEffect(rushed,vibeFor(rushed),banter).guard,2);
assert.equal(replyEffect(cautious,vibeFor(cautious),'listen').favor,34);
assert.equal(replyEffect(creative,vibeFor(creative),'proposal').favor,34);
const friendLine=linesFor(friends).find(l=>l.concern==='friend');
assert.equal(replyEffect(friends,friendLine,friendLine.correct[0]).favor,34);
const safe=linesFor(casual)[0], miss=safe.cards.find(c=>!safe.correct.includes(c.key)).key;
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
   assert(state.gain>=20 && state.resolved===1 && state.topic.includes('好感+'));
   const bounds=await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;return [t.topicText,t.lineText,t.feedbackText].map(o=>({text:o.text,x:o.getBounds().x,y:o.getBounds().y,right:o.getBounds().right,bottom:o.getBounds().bottom}));});
   for(const b of bounds) assert(b.x>=-1 && b.y>=0 && b.right<=width+1 && b.bottom<=height+1,`${profile.key} text clipped: ${JSON.stringify(b)}`);
   if(profile.key==='casual' || profile.key==='cautious') await page.screenshot({path:`${output}/${engine}-${profile.key}-${width}.png`});
   await page.evaluate(()=>{const t=window.cityApproachGame.scene.keys.TalkScene;t.time.removeAllEvents();t.lineIndex=3;t.favor=60;t.discomfort=10;t.resolvedConcerns=new Set(['safety','vibe','time']);t.nextLine();});
   await buttons.nth(3).tap();
   assert.equal(await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.invitationAccepted),profile.key==='casual',`${profile.key} invitation threshold`);
  }
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine}: seven adult profiles, portrait/landscape, native taps, attribute feedback and different invitation thresholds`);
 }finally{await browser.close();}
}
}finally{await server.close();}
