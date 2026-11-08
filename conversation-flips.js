import { encounterFor } from "./encounter-rules.js?v=20261108-ending1";
// Each hand contains concrete replies. Slots change so the answer is read, not memorised.
const KEYS = ['listen', 'empathy', 'tsukkomi', 'proposal'];
const CONCERNS = {
  safety: { cue: '初対面の警戒', text: '知らない人について行くの、ちょっと怖いかも。',
    answer: '人の多い所で話そう\n嫌ならここまでで大丈夫', reply: 'それなら安心。まずここで話そ。',
    wrong: ['俺、絶対いい人だから！', 'そんなに警戒しなくても（笑）', 'とりあえずついてきて'], miss: '「大丈夫」だけだと、何が安心なのか分からないよ。' },
  time: { cue: '帰る時間', text: 'あと20分で電車なんだけど、間に合うかな。',
    answer: '駅の近くで5分だけ\n時間になったら解散しよう', reply: '5分ならいける。電車は逃したくないしね。',
    wrong: ['終電までまだあるでしょ', '楽しかったら時間忘れるよ', '次の電車でよくない？'], miss: 'その電車に乗りたいんだけどな……。' },
  friend: { cue: '友達との約束', text: '友達が戻ってきたら、私がいないと困るし。',
    answer: 'ここで待っていよう\n友達が来たらそっち優先で', reply: 'ありがとう。あ、友達また遅れるって（笑）',
    wrong: ['友達にはあとでLINEすれば？', '二人の方が楽しくない？', '少しくらい探してくれるよ'], miss: '友達との約束も大事にしたいんだよね。' },
  money: { cue: 'お金の不安', text: '今月ピンチでさ。高い料金だったら無理だよ？',
    answer: '先に料金を確認しよう\n予算が合わなきゃやめよう', reply: '先に分かると助かる。入る前に見よう。',
    wrong: ['値段なんて気にしないで', '俺に任せれば大丈夫', 'せっかくだし高級店いこう'], miss: '入ってから高かった、は困るんだよ。' },
  destination: { cue: '行き先が見えない', text: 'で、結局どこに行こうとしてるんですか？',
    answer: 'ラブホテルのことだよ\n場所と料金を先に見よう', reply: '行き先は分かった。行くかはもう少し考えたい。',
    wrong: ['まあまあまあ、着けば分かる', '秘密の場所。期待してて', '細かいことは気にしない！'], miss: '行き先が分からないまま歩くのは不安だよ。' },
  pace: { cue: '距離感', text: '連絡先って、もう？ まだほとんど話してないし。',
    answer: 'まだ交換しなくていいよ\nまずは普通に話そう', reply: 'うん。好きな音楽の話とかならしたい。',
    wrong: ['交換くらい普通でしょ', 'じゃあインスタだけ教えて', '俺のこと信用してないの？'], miss: '交換するかは、もう少し話して決めたいな。' },
  fatigue: { cue: '疲れている', text: '今日ずっと立ってて、もう足が限界……。',
    answer: 'そこのベンチで休もう\n無理して歩かなくていいよ', reply: '助かる〜。この靴、見た目だけで選んだ（笑）',
    wrong: ['歩けば逆に元気出るよ', 'あと15分だけ頑張って', '俺も疲れてるから一緒だね'], miss: '今はほんとに歩くのしんどいんだって。' },
  pressure: { cue: '断りづらさ', text: 'ちょっと話したら、絶対どこか行かなきゃだめ？',
    answer: 'ここで話すだけでもいいよ\n行くかどうかは後で決めよう', reply: 'それなら気楽。じゃあちょっとだけ。',
    wrong: ['ここまで話したんだし行こう', 'そんなつれないこと言わないで', 'ノリで決めちゃおうよ'], miss: '話すのと、ついて行くのは別だよね。' },
};

const STRATEGIES = { safety: 'honest', time: 'short', friend: 'respect', money: 'budget', destination: 'honest', pace: 'respect', fatigue: 'care', pressure: 'respect', freeTime: 'banter', appearance: 'style' };
const EXTRA = {
  freeTime: { cue: '暇を持て余している', text: '今日、講義休講になってめっちゃ暇なんよね。',
    answer: 'じゃあ少し散歩しよ\n飽きたらそこで解散で', reply: 'いいね。駅でずっとスマホ見てるのも飽きた（笑）',
    wrong: ['暇なら絶対ついてきてよ', '大学の課題、今からやれば？', 'じゃあ何時間でも大丈夫だね'], miss: '暇だけど、何でもいいわけじゃないよ（笑）' },
  appearance: { cue: '髪と服のこだわり', text: '次の髪色どうしようかなって、ずっと迷ってる。',
    answer: '服に合わせて選ぶの？\n次はどんな色が気になる？', reply: 'そう、服との組み合わせ考えちゃう。実はね……',
    wrong: ['今の髪、早く染め直した方がいいよ', '俺の好みの色にしてよ', '髪はいいから、連絡先教えて'], miss: '自分の好きな感じを一緒に話したかったんだよね。' },
};
const VIBE_CARDS = [
  { strategy: 'honest', text: '普通に話してみたくて\n嫌ならここまでで大丈夫' },
  { strategy: 'banter', text: '慣れてたら今ごろ\nこんなに噛んでない（笑）' },
  { strategy: 'short', text: '予定あったら邪魔しないよ\n一言だけでも大丈夫' },
  { strategy: 'style', text: '服の色合わせ気になって\n自分で選んだの？' },
];

export function buildFlipLines(profile, mapKey, shuffle) {
  const type = encounterFor(profile), traits = profile.traits || [];
  const priority = type.priority || (traits.includes('待ち合わせ') ? 'friend'
    : traits.includes('スマホ') ? 'pace' : mapKey === 'kabukicho' ? 'destination' : 'fatigue');
  const rest = shuffle(Object.keys(CONCERNS).filter(key => !['safety', priority].includes(key)));
  const selected = ['safety', priority, 'vibe', rest[0]];
  return [...selected.map(id => {
    if (id === 'vibe') {
      const hand = shuffle(VIBE_CARDS.map(card => ({ ...card })));
      return { concern: 'vibe', cue: '相手に合うノリ', weak: true, text: 'なんか喋り慣れてそうだけど、いつもこんな感じ？',
        reply: type.reaction, miss: '', correct: hand.flatMap((c, i) => c.strategy === type.vibe ? [KEYS[i]] : []),
        cards: hand.map((card, i) => ({ ...card, key: KEYS[i] })) };
    }
    const c = CONCERNS[id] || EXTRA[id];
    const hand = shuffle([{ text: c.answer, hit: true, strategy: STRATEGIES[id] }, ...c.wrong.map(text => ({ text, hit: false, strategy: 'pushy' }))]);
    return { ...c, concern: id, weak: true, correct: hand.flatMap((card, i) => card.hit ? [KEYS[i]] : []),
      cards: hand.map((card, i) => ({ ...card, key: KEYS[i] })) };
  }), { concern: 'closing', isClosing: true, cue: '二人で次の予定', text: 'ちょっと安心したかも。このあと、どうしようか？', weak: true,
    correct: ['proposal'], reply: 'うん、行ってみよう。場所は一緒に確認したい。', miss: '最後も、私の都合を聞いてほしいな。', cards: [
      { key: 'listen', strategy: 'stall', text: 'ずっとここで話し続けよう' }, { key: 'empathy', strategy: 'pushy', text: 'せっかくだし予定は忘れよう' },
      { key: 'tsukkomi', strategy: 'pushy', text: 'もう俺に任せちゃいなよ' },
      { key: 'proposal', strategy: 'honest', text: 'ラブホテルで二人で過ごす？\n嫌なら今日はここまでで' },
    ] }];
}
