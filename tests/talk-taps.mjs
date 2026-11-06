import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startTestServer } from './helpers.mjs';
const server = await startTestServer();
const results = [];
const output = 'test-results/talk-taps';
await mkdir(output, {recursive:true});
try {
for (const engine of (process.env.TAP_BROWSERS || 'chromium,webkit').split(',')) {
 const browser = await ({chromium, webkit}[engine]).launch();
 try {
 for (const [width,height] of [[320,568],[390,844],[568,320],[844,390]]) {
  const page = await browser.newPage({viewport:{width,height},hasTouch:true,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(()=>window.cityApproachGame?.scene.keys.TitleScene?.startText?.active);
  await page.evaluate(()=>window.cityApproachGame.scene.keys.TitleScene.scene.start('MainScene'));
  await page.waitForFunction(()=>window.cityApproachGame.scene.keys.MainScene?.npcs?.length);
  await page.evaluate(()=>{const g=window.cityApproachGame;const m=g.scene.keys.MainScene;const n=m.npcs[0];m.scene.start('TalkScene',{profile:n.profile,npcTextureKey:n.sprite.texture.key,portraitTextureKey:n.portraitTextureKey});});
  await page.waitForFunction(()=>window.cityApproachGame.scene.keys.TalkScene?.choiceButtons?.[0]?.active);
  for(let index=0;index<4;index++) for(const [name,fx,fy] of [['center',.5,.5],['top-left',.08,.12],['top-right',.92,.12],['bottom-left',.08,.88],['bottom-right',.92,.88]]) {
   const before = await page.evaluate(({index,fx,fy})=>{
    const t=window.cityApproachGame.scene.keys.TalkScene;
    t.time.removeAllEvents();t.tweens.killAll();t.choiceLocked=false;t.resultShown=false;t.lineIndex=0;t.lineStartedAt=t.time.now;t.lineDuration=60000;
    t.favor=50;t.discomfort=20;t.responseChain=0;t.invitationAccepted=false;t.resolvedConcerns=new Set();
    t.choiceButtons.forEach(b=>b.setScale(1));
    t.nativeButtons?.sync();
    const b=t.choiceButtons[index], r=t.game.canvas.getBoundingClientRect();
    return { x:r.x+(b.x+b.buttonWidth*fx)*r.width/t.scale.width,y:r.y+(b.y+b.buttonHeight*fy)*r.height/t.scale.height,
      hit:{x:b.input.hitArea.x,y:b.input.hitArea.y,width:b.input.hitArea.width,height:b.input.hitArea.height},origin:[b.displayOriginX,b.displayOriginY]};
   },{index,fx,fy});
   await page.touchscreen.tap(before.x,before.y);
   const accepted=await page.evaluate(()=>window.cityApproachGame.scene.keys.TalkScene.choiceLocked);
   results.push({engine,width,height,index,name,accepted,hit:before.hit,origin:before.origin});
   console.log(`${accepted?'PASS':'MISS'} ${engine} ${width}x${height} card${index} ${name}`);
  }
  // Test progression without manually advancing the scene or its clock.
  const first = await page.evaluate(() => {
    const t = window.cityApproachGame.scene.keys.TalkScene;
    t.time.removeAllEvents(); t.tweens.killAll(); t.lineIndex = -1; t.favor = 50; t.discomfort = 20;
    t.resolvedConcerns = new Set(); t.responseChain = 0; t.invitationAccepted = false; t.nextLine();
    return ['listen','empathy','tsukkomi','proposal'].indexOf(t.lines[0].correct[0]);
  });
  const buttons = page.locator('.game-native-buttons[data-scene="TalkScene"] button');
  if (engine === 'chromium') {
    const box = await buttons.nth(first).boundingBox();
    const touch = await page.context().newCDPSession(page);
    const point = {id: 7, x: box.x + box.width / 2, y: box.y + box.height / 2};
    await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{...point,x: point.x + 3,y: point.y + 2}]});
    await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await touch.detach();
  } else await buttons.nth(first).tap();
  assert(await buttons.nth(first).isDisabled(), 'accepted answer must be locked against double taps');
  await page.waitForFunction(() => {
    const t = window.cityApproachGame.scene.keys.TalkScene;
    return t.lineIndex === 1 && !t.choiceLocked;
  });
  const second = await page.evaluate(() => ['listen','empathy','tsukkomi','proposal'].indexOf(window.cityApproachGame.scene.keys.TalkScene.lines[1].correct[0]));
  await buttons.nth(second).press('Enter');
  assert(await page.evaluate(() => window.cityApproachGame.scene.keys.TalkScene.choiceLocked), 'keyboard activation');
  await page.screenshot({path:`${output}/${engine}-${width}.png`});
  await page.evaluate(() => window.cityApproachGame.scene.keys.TalkScene.showFinal(true));
  await buttons.nth(4).tap();
  await page.waitForFunction(() => window.cityApproachGame.scene.keys.EscortScene?.player?.active);
  assert.equal(await page.locator('.game-native-buttons[data-scene="TalkScene"]').count(), 0, 'old tap targets removed');
  assert.equal(await page.locator('.game-native-buttons[data-scene="EscortScene"]').count(), 1, 'one escort overlay');
  console.log(`PASS ${engine} ${width}x${height} progression, keyboard, and cleanup`);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 } finally {await browser.close();}
}
await writeFile(`${output}/report.json`,JSON.stringify(results,null,2));
assert(results.every(r=>r.accepted),`${results.filter(r=>!r.accepted).length} visible card taps missed`);
} finally {await server.close();}
