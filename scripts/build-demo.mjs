import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const dir='test-results/demo';
const take=JSON.parse(await readFile(`${dir}/take.json`,'utf8'));
const marks=Object.fromEntries(take.marks.map(m=>[m.name,m.time]));
assert(['goal','question-3','reaction-3','question-4','reaction-4','reaction-5','arrival-walk'].every(key=>Number.isFinite(marks[key])), 'Record a successful six-question take before building the demo');
const approach=take.marks.filter(m=>m.name.startsWith('approach-')).at(-1).time;
const cuts=[
  [approach-1.3,approach+.65,'街で声をかける。\nそこから始まる会話ゲーム。'],
  [marks.talk+.3,marks['talk-reaction']+1.25,'相手の不安に、どう返す？\n4枚のフリップからタップ。'],
  [marks.walk+.15,Math.min(marks['question-0']-.15,marks.walk+2.4),'連れ出したあとも、\n歩きながら会話は続く。'],
  [marks['question-0']+.15,marks['reaction-0']+2.25,'「まあまあまあ」で流す。\nでも、連発すると同行終了。'],
  [marks['question-3']+.15,marks['reaction-3']+2.1,'入口で「まだ迷ってる（笑）」\nここでも、返しを選ぶ。'],
  [marks['question-4']+.15,marks['reaction-4']+1.8,'料金？ 終電？ 友達？\n相手ごとの迷いに返す。'],
  [Math.max(marks['arrival-walk']+.15,marks.goal-1.65),marks.goal+.45,'入口でも、気持ちを確認。\n二人で決めて、ゴールへ。'],
  [marks.goal+.55,marks.goal+3.9,'ホテルの客室で、記念CG。\nラストは黒バニー。'],
];
const font='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
const regular='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
const textFiles={brand:'CITY APPROACH',hook:'その返し、\nアリ？ ナシ？',badge:'実プレイ / ダイジェスト',sub:'「まあまあまあ」は何回まで通じる？',cta:'スマホ・ブラウザですぐ遊べる',url:'jim-auto.github.io/city_approach/'};
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
ffmpeg(['-i','assets/demo.mp4','-an','-c:v','libvpx-vp9','-crf','34','-b:v','0','-row-mt','1','-threads','2','assets/demo.webm']);
ffmpeg(['-ss','3','-i','assets/demo.mp4','-frames:v','1','-update','1',`${dir}/hero-preview.png`]);
await writeFile('assets/demo.json',JSON.stringify({
  description:'Actual browser play, recorded with Playwright and edited into chronological excerpts. No game state or outcomes were altered.',
  width:1100,height:800,duration:Number(offset.toFixed(2)),gifFps:10,gifWidth:480,gifHeight:800,
  clips:cuts.map(([start,end,caption])=>({start,end,caption})),
  capture:'npm run demo:record',edit:'npm run demo:build',
},null,2)+'\n');
console.log(`Edited ${offset.toFixed(2)} seconds`);
for(const name of ['demo.gif','demo.mp4','demo.webm'])console.log(name,((await stat(`assets/${name}`)).size/1024/1024).toFixed(2)+' MiB');
