import { encounterFor } from './encounter-rules.js?v=20261108-cast1';

export const WALK_REPLY_KEYS = ['explain', 'evade', 'check', 'spark'];
export const WALK_QUESTION_X = [650, 1300, 1950, 2630];
const card = (key, tag, line, strategy, reaction, kind = 'reply') => ({ key, tag, line, strategy, reaction, kind });
const TOPICS = {
  casual: ['なんか、退屈しない話してよ（笑）', 'じゃあ、お互いの第一印象を一個ずつ', 'plan', 'いいね（笑）じゃあ、そっちから！', '今のところ、道案内より会話が得意', 'banter', '自分で言うんだ（笑）嫌いじゃない。'],
  rushed: ['あと、どのくらいで着くの？', 'あと少し。帰る時間には合わせよう', 'short', 'それなら安心。時間は守ってね。', 'あと三分くらい。無理ならここまで', 'short', '具体的に言ってくれると助かる。'],
  friends: ['友達から連絡きたんだけど…', '先に返していいよ。ここで待つね', 'respect', 'ありがとう。ちょっと返信するね。', '友達との約束を優先していいよ', 'respect', 'そう言ってくれるの、ありがたい。'],
  cautious: ['ほんとに、途中で帰ってもいい？', 'もちろん。気が変わったら言ってね', 'honest', 'うん。それなら、自分で決められる。', '帰りたくなったら、その場で帰ろう', 'respect', '分かった。ちゃんと聞いてくれるんだね。'],
  creative: ['服とか髪、どんなのが好き？', '自分で選んだ感じが出てるといいね', 'style', 'そういうの、分かってくれるんだ。', '今日の髪と服、色の組み合わせが好き', 'style', 'そこ気づいた？今日ちょっと考えた！'],
  student: ['今日、あまりお金使えなくて', '料金は先に見て、一緒に決めよう', 'budget', 'うん。先に分かるなら助かる。', '予算を超えるなら、今日はやめよう', 'budget', 'ありがと。無理しなくていいんだね。'],
  neutral: ['普段は、どんなところで遊ぶの？', 'カフェとか。そっちはどんな所が好き？', 'honest', '私は静かなカフェが好きかな。', '今日は、君の好きな場所も聞きたい', 'honest', 'じゃあ、今度おすすめを教えるね。'],
};

export function walkQuestion(profile, index) {
  const type = encounterFor(profile);
  let text, cards;
  if (index === 0) {
    text = 'どこ行くんですか？';
    cards = [
      card('explain', '安心', 'ラブホテルに行かない？嫌ならやめよう', 'honest', '分かった。行くかは話してから決めたいな。', 'clear'),
      card('evade', '流す', 'まあまあまあ', null, '', 'evade'),
      card('check', '確認', '嫌なら、ここでやめようか？', 'respect', '', 'stop'),
      card('spark', '軽いノリ', 'ラブホのお誘い。断っても気まずくしないよ', 'banter', type.key === 'casual' ? '言い方（笑）でも、ちゃんと言ってくれるんだね。' : '行き先を先に言ってくれるなら安心。', 'clear'),
    ];
  } else if (index === 1) {
    text = 'こうやって声かけるの、慣れてる？';
    const safe = type.key === 'rushed'
      ? ['慣れてないよ。短く話そう', 'short', 'じゃあ、少しだけ話してみよう。']
      : type.key === 'friends'
        ? ['慣れてないよ。友達の予定は優先で', 'respect', '予定も気にしてくれるなら安心。']
        : ['慣れてないよ。普通に話そう', 'honest', 'そっか。普通に話すなら気楽だね。'];
    cards = [
      card('explain', '素直に', ...safe),
      card('evade', '流す', 'まあまあまあ', null, '', 'evade'),
      card('check', '冗談', '今も一回噛んだ（笑）そっちは？', 'banter', '噛んでたのバレてるよ（笑）'),
      card('spark', '褒める', 'その服、色の合わせ方いいね', 'style', 'これ自分で選んだ！気づいてくれた？'),
    ];
  } else if (index === 2) {
    const [question, safe, strategy, reaction, clever, cleverStrategy, cleverReaction] = TOPICS[type.key];
    text = question;
    cards = [
      card('explain', '聞いて返す', safe, strategy, reaction),
      card('evade', '流す', 'まあまあまあ', null, '', 'evade'),
      card('check', '口説く', '話してたら、もう少し一緒にいたくなった', 'banter', 'そういうこと、さらっと言うね（笑）'),
      card('spark', 'ひと工夫', clever, cleverStrategy, cleverReaction),
    ];
  } else {
    text = 'ここ、ラブホテルですよね？';
    cards = [
      card('explain', '確認', 'そう。今から入る？嫌ならやめよう', 'honest', 'うん、入ろう。気が変わったら帰るね。', 'clear'),
      card('evade', '流す', 'まあまあまあ', null, '', 'evade'),
      card('check', '確認', 'ここまでにする？無理しなくていいよ', 'respect', '', 'stop'),
      card('spark', '気持ちを伝える', 'もう少し話したい。ここに入る？', 'respect', 'うん。もう少し話そう。嫌になったら帰るね。', 'clear'),
    ];
  }
  return { x: WALK_QUESTION_X[index], index, text, cards, final: index === 3,
    playerLines: Object.fromEntries(cards.map(c => [c.key, c.line])) };
}

export function walkReplyEffect(profile, question, key) {
  const type = encounterFor(profile), choice = question.cards.find(c => c.key === key);
  if (!choice || choice.kind === 'evade') return { gain: 0, match: false, label: '不安が残った', reaction: '' };
  const match = (type.preferred[choice.strategy] || 0) >= 10;
  const offTopic = question.index === 1 && key === 'spark' && ['rushed', 'cautious'].includes(type.key);
  return {
    gain: offTopic ? 4 : match ? 18 : key === 'explain' ? 8 : 10,
    match, label: offTopic ? '今はその話より…' : match ? '相性◎ 話が弾んだ！' : key === 'explain' ? '安心してくれた' : '自然に話せた',
    reaction: offTopic ? '服の話より、今は聞いたことに答えてほしいな。'
      : !match && key === 'check' && question.index === 1 ? 'ちょっと緊張してるんだね。ゆっくりでいいよ。' : choice.reaction,
  };
}
