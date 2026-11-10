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
// Hero structure: approach → one reply → walking hook → hesitation → answer → payoff.
// Readable excerpts at normal speed; the complete take remains in test-results/demo.
const cuts=[
  [approach-.45,approach+.55,'街で声をかける。\nここから始まる。'],
  [marks['talk-reaction-0']-1.2,marks['talk-reaction-0']+1.7,'「めちゃくちゃタイプです！」\n返しを選んで、距離が縮まる。'],
  [marks.walk+.25,marks.walk+1.85,'連れ出したら、横スクロール。\n歩いている間も会話は続く。'],
  [marks['reaction-0']-1.1,marks['reaction-0']+2.1,'「まあまあまあ」\n流しすぎると、どうなる？'],
  [marks['question-3']-2.7,marks['question-3']-.1,'街を抜けて、ホテルへ。\n最後まで相手の反応を見よう。'],
  [marks['reaction-5']-.65,marks['final-answer']+2.55,'無言の相手に、気持ちを伝える。\n返事を待ってから、ゴールへ。'],
  [marks.goal+.3,marks.goal+3.65,'ホテルの客室で、ゴール！\nスマホ・ブラウザですぐ遊べる。'],
];
const heroDuration=cuts.reduce((total,[start,end])=>total+end-start,0);
assert(heroDuration>=18 && heroDuration<=22,'Keep the README hero within 18–22 seconds');
for(let i=0;i<cuts.length;i++) {
  assert(cuts[i][1]>cuts[i][0], `clip ${i} must have positive duration`);
  if(i) assert(cuts[i][0]>=cuts[i-1][1]-.001, `clip ${i} must follow the preceding shot`);
}
const font='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
const regular='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
const textFiles={brand:'CITY APPROACH',hook:'その返し、\nアリ？ ナシ？',badge:'約20秒 / プレイの見どころ',sub:'「まあまあまあ」は何回まで通じる？',cta:'スマホ・ブラウザですぐ遊べる',url:'jim-auto.github.io/city_approach/',endingHook:'その返し、アリ？ ナシ？',endingCta:'タップして遊ぶ'};
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
const endingStart=offset-(cuts.at(-1)[1]-cuts.at(-1)[0]);
const endingEnable=":enable='gte(t,"+endingStart.toFixed(3)+")'";
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
  // Replace the long take's callback and score footer with the hero's play invitation.
  `drawbox=x=620:y=608:w=480:h=192:color=0x090e1a:t=fill${endingEnable}`,
  draw('endingHook','620+(480-text_w)/2',642,24,'ffffff',true,endingEnable),
  draw('endingCta','620+(480-text_w)/2',694,24,'72ddd2',true,endingEnable),
  draw('url','620+(480-text_w)/2',754,14,'aab7ca',false,endingEnable),
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
  description:'GIF dialogue scenario recorded through actual Playwright browser inputs. Recording-only module routes replace dialogue and reaction timing; normal game files, success rates and scoring rules are unchanged. The hero uses short chronological excerpts at normal speed, retaining the final silence, reassurance and affirmative reply. An edited play invitation replaces the ending score footer.',
  scenario:scenario.id,scenarioSource:'scripts/demo-scenario.mjs',finalConfirmation:{silentQuestion:true,answerAfterReassurance:true},
  width:1100,height:800,duration:Number(offset.toFixed(2)),gifFps:10,gifWidth:480,gifHeight:800,
  purpose:'README hero teaser',targetDurationSeconds:20,playbackSpeed:1,
  initialConversation:{start:cuts[1][0],end:cuts[1][1],rounds:1,uninterrupted:false},
  walkingExchanges:2,endingOverlay:'Play invitation over the score footer',
  clips:cuts.map(([start,end,caption])=>({start,end,caption})),
  capture:'npm run demo:record',edit:'npm run demo:build',
},null,2)+'\n');
console.log(`Edited ${offset.toFixed(2)} seconds`);
for(const name of ['demo.gif','demo.mp4','demo.webm'])console.log(name,((await stat(`assets/${name}`)).size/1024/1024).toFixed(2)+' MiB');
