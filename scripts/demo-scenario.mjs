// Dialogue used only by Playwright's recording routes. Normal play imports none of this.
export const scenario = {
  id: 'conversation-story-1',
  title: '今日の授業、これ？',
  companion: '21歳のプリン髪大学生',
  talk: [
    ['safety', 'なに、ナンパ？（笑）', 'そう。声かけたけど\n第一声もうなくなった', '準備してから来て（笑）'],
    ['freeTime', '誰にでも言ってそう。', '誰にでもこんな滑り方してたら\nもう帰ってる', '滑った自覚はあるんだ（笑）'],
    ['vibe', '今日、大学サボったんだよね。', '俺に声かけられたところで\n出席にしとこ', '何の授業（笑）'],
    ['pressure', '何の授業になるの、それ（笑）', '会話の実習。先生、\n採点は甘めでお願いします', 'いつの間に先生になってる（笑）'],
    ['closing', 'そろそろ行こうかな。', 'もうちょい話したい\nそこまで一緒に歩かない？', 'ちょっとならいいよ。'],
  ],
  walk: [
    ['で、どこ行くんですか？', 'evade', 'まあまあまあ', 'いや、そこは答えて（笑）'],
    ['目的地ないの？（笑）', 'explain', 'まだ決めてない。今、話す方に集中してた', 'それはちょっと嬉しいけど（笑）'],
    ['さっきの出席、ちゃんとつけてよ？', 'spark', 'つけた。今のところ皆勤賞', 'まだ一回しか会ってない（笑）'],
    ['え、ここホテルじゃん。', 'explain', 'うん。二人でゆっくりしたいなって。どう？', 'んー、ちょっと迷う。'],
    ['ちょっと急じゃない？', 'explain', 'そっか。ここで少し話そ。急がなくていいよ', 'うん……。'],
    ['……', 'explain', '君の嫌がることはしないよ。嫌なことしたら、いつでも帰っていいから', 'うん。じゃあ、入ろっか。'],
  ],
  goalQuote: '今日の授業、これ？（笑）',
};

export function storyTalkLines() {
  return scenario.talk.map(([concern,text,answer,reply],index) => {
    const isClosing=index===4, key=isClosing?'proposal':'listen';
    const alternatives=isClosing
      ? ['じゃあ、今日はここまでにしよう','またどこかで会ったら話そう','もう少しここで話さない？']
      : ['そうなんだ。もう少し聞かせて','ちょっと緊張してきた（笑）','どんな返事が来るか考えてた'];
    const keys=['listen','empathy','tsukkomi','proposal'];
    let next=0;
    return {concern,text,reply,isClosing,weak:true,cue:'会話の実習',correct:[key],miss:'ちょっと話がずれたかも。',
      cards:keys.map(k=>({key:k,text:k===key?answer:alternatives[next++],strategy:k===key?'banter':'honest',demoPick:k===key,safe:k===key}))};
  });
}

// Intercept text modules in this browser only, leaving the shipped game untouched.
export async function installDemoScenario(page) {
  const replace=(source,from,to)=>{
    if(!source.includes(from))throw new Error(`Scenario source anchor missing: ${from.slice(0,70)}`);
    return source.replace(from,to);
  };
  await page.route(/\/(conversation-flips|escort-conversation|goal-costumes|scenes\/TalkScene|scenes\/EscortScene)\.js(?:\?|$)/,async route=>{
    const response=await route.fetch();
    let source=await response.text();
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/conversation-flips.js')) {
      source=replace(source,'export function buildFlipLines(', 'function originalBuildFlipLines(');
      source+=`\nexport function buildFlipLines(profile,mapKey,shuffle) { return ${JSON.stringify(storyTalkLines())}; }\n`;
    } else if(path.endsWith('/escort-conversation.js')) {
      source=replace(source,'export function walkQuestion(', 'function originalWalkQuestion(');
      source+=`\nexport function walkQuestion(profile,index) {
        const question=originalWalkQuestion(profile,index);
        const [text,key,line,reaction]=${JSON.stringify(scenario.walk)}[index];
        question.text=text;
        const choice=question.cards.find(c=>c.key===key);
        Object.assign(choice,{line,reaction});
        question.playerLines[key]=line;
        return question;
      }\n`;
    } else if(path.endsWith('/TalkScene.js')) {
      source=replace(source,'ラブホ同行成立！','一緒に散歩へ！');
      source=replace(source,'行き先を確認して、二人でラブホテルへ向かう。','もう少し話しながら、二人で街を歩く。');
      source=source.replaceAll('ラブホテルへ歩く','一緒に歩く').replaceAll('不安 ${','会話 ${');
    } else if(path.endsWith('/EscortScene.js')) {
      source=replace(source,'えー、気になるんだけど（笑）',scenario.walk[0][3]);
      const anchor='this.replyTimer = this.time.delayedCall(3000, () => this.closeConversation());';
      source=replace(source,anchor,`if(question.final) {
        const fullReply=this.dialogueBody;
        this.dialogueBody=\`あなた「\${choice.line}」\\n相手「……」\`;
        this.layoutConversation();
        this.time.delayedCall(1800,()=>{ this.dialogueBody=fullReply; this.layoutConversation(); });
      }
      this.replyTimer = this.time.delayedCall(question.final ? 6000 : 3600, () => this.closeConversation());`);
    } else if(path.endsWith('/goal-costumes.js')) {
      source=replace(source,'うさ耳、ちょっと気に入ったかも。',scenario.goalQuote);
    }
    await route.fulfill({response,body:source});
  });
}
