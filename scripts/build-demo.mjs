import assert from 'node:assert/strict';
import { scenario } from './demo-scenario.mjs';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const dir='test-results/demo';
const take=JSON.parse(await readFile(`${dir}/take.json`,'utf8'));
assert.equal(take.scenario,scenario.id,'Record the current GIF scenario before building');
const marks=Object.fromEntries(take.marks.map(m=>[m.name,m.time]));
const required = ['goal','walk','talk-result','final-answer',
  ...Array.from({length:5}, (_, i) => [`talk-question-${i}`,`talk-reaction-${i}`]).flat(),
  ...Array.from({length:6}, (_, i) => [`question-${i}`,`reaction-${i}`]).flat()];
assert(required.every(key=>Number.isFinite(marks[key])), 'Record the complete conversation and all six walking exchanges before editing');
const approach=take.marks.filter(m=>m.name.startsWith('approach-')).at(-1).time;
const walkCaptions = [
  '「まあまあまあ」で流す。\n返答とリアクションまで見せる。',
  '「目的地ないの？」には、\nちゃんと答え直す。',
  'さっきの冗談が、また話題に。\n会話がひと続きになる。',
  'ホテルが見えてきた。\nここで初めて、お誘い。',
  '「ちょっと急じゃない？」\nここで一度、立ち止まる。',
  '無言の相手に、気持ちを伝える。\n返事を待ってからゴールへ。',
];
const cuts=[
  [approach-1.3,approach+.8,'街で声をかける。\nそこから始まる会話ゲーム。'],
  // Keep the conversation and its invitation in one uninterrupted shot.
  [marks['talk-question-0'],marks.walk+.15,'会話から、お誘いまで。\nやり取りを飛ばさず見せる。'],
  [marks.walk+.15,Math.min(marks['question-0']-.1,marks.walk+1.9),'二人で歩き出す。\nこのあとも会話は続く。'],
  ...walkCaptions.map((caption, i) => [marks[`question-${i}`],
    i===5 ? marks.goal+.45 : marks[`reaction-${i}`]+3.4,caption]),
  [marks.goal+.45,marks.goal+4,'ホテルの客室で、記念CG。\nラストは黒バニー。'],
];
for(let i=0;i<cuts.length;i++) {
  assert(cuts[i][1]>cuts[i][0], `clip ${i} must have positive duration`);
  if(i) assert(cuts[i][0]>=cuts[i-1][1]-.001, `clip ${i} must follow the preceding shot`);
}
const font='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
const regular='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
const textFiles={brand:'CITY APPROACH',hook:'その返し、\nアリ？ ナシ？',badge:'GIF用シナリオ / ブラウザ操作で撮影',sub:'「まあまあまあ」は何回まで通じる？',cta:'スマホ・ブラウザですぐ遊べる',url:'jim-auto.github.io/city_approach/'};
for(const [name,text] of Object.entries(textFiles))await writeFile(`${dir}/${name}.txt`,text);
const draw=(name,x,y,size,color='ffffff',bold=true,extra='')=>
  `drawtext=fontfile='${bold?font:regular}':textfile='${dir}/${name}.txt':x=${x}:y=${y}:fontsize=${size}:fontcolor=0x${color}:line_spacing=16${extra}`;
const trim=cuts.map(([start,end],i)=>`[s${i}]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[c${i}]`);
let offset=0;
const captions=[];
for(let i=0;i<cuts.length;i++){
  await writeFile(`${dir}/phase-${i}.txt`,cuts[i][2]);
  const end=offset+cuts[i][1]-cuts[i][0];
  captions.push(draw(`phase-${i}`,48,470,27,'e0e8f3',false,`:enable='between(t,${offset},${end-.001})'`));
  offset=end;
}
const filter=[
  `[0:v]split=${cuts.length}${cuts.map((_,i)=>`[s${i}]`).join('')}`,
  ...trim,
  `${cuts.map((_,i)=>`[c${i}]`).join('')}concat=n=${cuts.length}:v=1:a=0,fps=24,pad=1100:800:620:0:color=0x090e1a,setsar=1`,
].join(';')+','+[
  'drawbox=x=618:y=0:w=2:h=800:color=0x72ddd2:t=fill',
  'drawbox=x=48:y=410:w=516:h=2:color=0x303d53:t=fill',
  'drawbox=x=48:y=730:w=516:h=2:color=0x303d53:t=fill',
  draw('badge',48,42,16,'aab7ca',false),draw('brand',48,89,28,'72ddd2'),
  draw('hook',44,155,64),draw('sub',48,355,22,'ffb5d4'),...captions,
  draw('cta',48,655,24,'72ddd2'),draw('url',48,750,20,'aab7ca',false),
].join(',')+'[out]';
await writeFile(`${dir}/edit.ffscript`,filter);
function ffmpeg(args){execFileSync('ffmpeg',['-hide_banner','-loglevel','warning','-y',...args],{stdio:'inherit'});}
ffmpeg(['-i',take.video,'-filter_complex_threads','1','-filter_complex_script',`${dir}/edit.ffscript`,
  '-map','[out]','-an','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','assets/demo.mp4']);
ffmpeg(['-i','assets/demo.mp4','-vf','crop=480:800:620:0,fps=10,split[a][b];[a]palettegen=stats_mode=diff:max_colors=128[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
  '-filter_complex_threads','1','-loop','0','assets/demo.gif']);
ffmpeg(['-i','assets/demo.mp4','-an','-c:v','libvpx-vp9','-cpu-used','4','-crf','34','-b:v','0','-row-mt','1','-threads','2','assets/demo.webm']);
ffmpeg(['-ss','3','-i','assets/demo.mp4','-frames:v','1','-update','1',`${dir}/hero-preview.png`]);
await writeFile('assets/demo.json',JSON.stringify({
  description:'GIF dialogue scenario recorded through actual Playwright browser inputs. Recording-only module routes replace dialogue and reaction timing; normal game files, success rates and scoring rules are unchanged. All conversations and the final silence, reassurance and affirmative reply are included.',
  scenario:scenario.id,scenarioSource:'scripts/demo-scenario.mjs',finalConfirmation:{silentQuestion:true,answerAfterReassurance:true},
  width:1100,height:800,duration:Number(offset.toFixed(2)),gifFps:10,gifWidth:480,gifHeight:800,
  initialConversation:{start:cuts[1][0],end:cuts[1][1],rounds:5,uninterrupted:true},
  walkingExchanges:6,
  clips:cuts.map(([start,end,caption])=>({start,end,caption})),
  capture:'npm run demo:record',edit:'npm run demo:build',
},null,2)+'\n');
console.log(`Edited ${offset.toFixed(2)} seconds`);
for(const name of ['demo.gif','demo.mp4','demo.webm'])console.log(name,((await stat(`assets/${name}`)).size/1024/1024).toFixed(2)+' MiB');
