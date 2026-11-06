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
  money: { cue: 'お金の不安', text: '今月ピンチでさ。高いお店とかは無理だよ？',
    answer: '先にメニュー見よう\n予算が合わなきゃ別の所へ', reply: '値段分かると助かる。ここのココアよさそう。',
    wrong: ['値段なんて気にしないで', '俺に任せれば大丈夫', 'せっかくだし高級店いこう'], miss: '入ってから高かった、は困るんだよ。' },
  destination: { cue: '行き先が見えない', text: 'で、結局どこに行こうとしてるんですか？',
    answer: '駅前のカフェだよ\n場所とメニューを見せるね', reply: 'そこなんだ。分かる場所でよかった。',
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

export function buildFlipLines(profile, mapKey, shuffle) {
  const priority = profile.traits.includes('友達といる') || profile.traits.includes('待ち合わせ') ? 'friend'
    : profile.traits.includes('歩くの速い') ? 'time'
    : profile.traits.includes('スマホ') ? 'pace' : mapKey === 'kabukicho' ? 'destination' : 'fatigue';
  const rest = shuffle(Object.keys(CONCERNS).filter(key => !['safety', priority].includes(key)));
  const selected = ['safety', priority, ...rest.slice(0, 2)];
  return [...selected.map(id => {
    const c = CONCERNS[id];
    const hand = shuffle([{ text: c.answer, hit: true }, ...c.wrong.map(text => ({ text, hit: false }))]);
    return { ...c, concern: id, weak: true, correct: hand.flatMap((card, i) => card.hit ? [KEYS[i]] : []),
      cards: hand.map((card, i) => ({ ...card, key: KEYS[i] })) };
  }), { concern: 'closing', isClosing: true, cue: '二人で次の予定', text: 'ちょっと安心したかも。このあと、どうしようか？', weak: true,
    correct: ['proposal'], reply: 'うん、少しだけなら。行き先は一緒に確認しようね。', miss: '最後も、私の都合を聞いてほしいな。', cards: [
      { key: 'listen', text: 'ずっとここで話し続けよう' }, { key: 'empathy', text: 'せっかくだし予定は忘れよう' },
      { key: 'tsukkomi', text: 'もう俺に任せちゃいなよ' }, { key: 'proposal', text: '少し休んでいく？\n予定があればここで解散で' },
    ] }];
}
