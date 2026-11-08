// Fictional adult NPC balancing. Appearance is a character tag; the current
// schedule and personality determine which reply fits this particular encounter.
const TYPES = {
  casual: { label: '暇なプリン大学生', hint: '軽いノリ◎', startFavor: 12, startGuard: -6, inviteAt: 60, mistake: 14,
    preferred: { banter: 14, plan: 10, style: 6 }, vibe: 'banter', priority: 'freeTime',
    reaction: '噛んでたのバレてる（笑）今日ほんと暇なんよね。' },
  rushed: { label: '予定あり', hint: '短く話す◎', startFavor: -4, startGuard: 8, inviteAt: 76, mistake: 28,
    preferred: { short: 14, care: 4 }, vibe: 'short', priority: 'time',
    reaction: '助かる。短くなら、少し話せるよ。' },
  friends: { label: '友達優先', hint: '予定への配慮◎', startFavor: 0, startGuard: 5, inviteAt: 74, mistake: 26,
    preferred: { respect: 14, short: 6 }, vibe: 'short', priority: 'friend',
    reaction: '友達との予定、気にしてくれるなら話せる。' },
  cautious: { label: '慎重派', hint: '具体的な説明◎', startFavor: -5, startGuard: 10, inviteAt: 78, mistake: 30,
    preferred: { honest: 14, respect: 10 }, vibe: 'honest', priority: 'pace',
    reaction: 'そう言ってくれると少し安心する。' },
  creative: { label: '専門学生', hint: '服・髪の話◎', startFavor: 2, startGuard: 0, inviteAt: 68, mistake: 22,
    preferred: { style: 14, banter: 5 }, vibe: 'style', priority: 'appearance',
    reaction: 'これ自分で選んだ！色合わせ、気づいてくれた？' },
  student: { label: '大学生', hint: '予算への配慮◎', startFavor: 3, startGuard: 0, inviteAt: 68, mistake: 22,
    preferred: { budget: 12, banter: 6 }, vibe: 'banter', priority: 'money',
    reaction: '緊張してたんだ（笑）ちょっと親近感。' },
  neutral: { label: 'マイペース', hint: '話をよく聞こう', startFavor: 0, startGuard: 0, inviteAt: 68, mistake: 22,
    preferred: {}, vibe: 'honest', priority: null, reaction: 'じゃあ、普通に話してみようかな。' },
};

export function encounterFor(profile = {}) {
  const traits = profile.traits || [], style = profile.styleLabel || '';
  let key = 'neutral';
  if (traits.includes('歩くの速い') || profile.situation?.room === 0) key = 'rushed';
  else if (traits.includes('友達といる')) key = 'friends';
  else if (traits.includes('暇') && traits.includes('プリン髪') && (traits.includes('大学生') || style.includes('大学生'))) key = 'casual';
  else if (style === '地雷系' || traits.includes('警戒強め') || traits.includes('夜の警戒')) key = 'cautious';
  else if (style.includes('専門学生')) key = 'creative';
  else if (style.includes('大学生')) key = 'student';
  return { key, ...TYPES[key] };
}

export function replyEffect(profile, line, choiceKey, chain = 0) {
  const type = encounterFor(profile);
  const card = line.cards?.find(c => c.key === choiceKey);
  if (line.correct.includes(choiceKey)) {
    const affinity = type.preferred[card?.strategy] || 0;
    const gain = Math.min(40, 20 + Math.min(9, chain * 3) + affinity);
    return { quality: 'match', favor: gain, guard: -(6 + Math.floor(affinity / 3)), affinity,
      label: affinity ? '好印象 / 減点なし' : '減点なし', reaction: line.reply };
  }
  if (card?.safe) {
    return { quality: 'safe', favor: 16, guard: line.concern === 'vibe' ? 0 : -6, affinity: 0,
      label: '減点なし', reaction: card.reaction || (type.key === 'rushed'
        ? 'うん、少しなら話せるよ。' : 'そっか（笑）じゃあ普通に話そ。') };
  }
  return { quality: 'miss', favor: -5, guard: type.mistake, affinity: 0,
    label: '不安が残った', reaction: line.miss };
}
