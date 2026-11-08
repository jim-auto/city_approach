// Preferences belong to each fictional character, independently of her outfit or schedule.
export const PREFERENCES = [
  { key: 'open', label: 'フィーリング重視' },
  { key: 'no-oji', label: 'オジはNG' },
  { key: 'tall-oji', label: 'オジも高身長ならOK' },
  { key: 'tall', label: '高身長が好み' },
  { key: 'looks', label: 'ガチイケが好み' },
  { key: 'oji', label: 'オジが好み' },
];
export function compatibilityFor(profile = {}, player = {}) {
  const preference = PREFERENCES.find(p => p.key === profile.preferenceKey) || PREFERENCES[0];
  const oji = player.difficulty === 'hard', tall = player.height !== 'short';
  let eligible = true, rateMod = 0, favorMod = 0, inviteMod = 0;
  let reaction = 'まずは普通に話してみよう。';
  if (preference.key === 'no-oji' && oji) {
    eligible = false; reaction = 'ごめん、年上の人は恋愛対象じゃないんだ。';
  } else if (preference.key === 'tall-oji' && oji) {
    eligible = tall;
    reaction = tall ? '年上でも、背が高い人はタイプかも。' : '年上なら、背が高い人がタイプなんだ。';
    if (tall) { rateMod = .1; favorMod = 10; inviteMod = -4; }
  } else if (preference.key === 'tall') {
    rateMod = tall ? .1 : -.08; favorMod = tall ? 8 : -6; inviteMod = tall ? -3 : 3;
    reaction = tall ? '背が高い人、けっこう好きなんだよね。' : '背はタイプと違うけど、少し話してみよ。';
  } else if (preference.key === 'looks') {
    const match = player.difficulty === 'easy';
    rateMod = match ? .1 : -.08; favorMod = match ? 10 : -6; inviteMod = match ? -3 : 3;
    reaction = match ? '顔、ちょっとタイプかも（笑）' : 'まずは話してみないと分からないかな。';
  } else if (preference.key === 'oji') {
    rateMod = oji ? .16 : -.06; favorMod = oji ? 12 : -4; inviteMod = oji ? -5 : 2;
    reaction = oji ? '年上の落ち着いた感じ、好きなんだよね。' : '普段は年上が好きだけど、話してみよ。';
  }
  return { preference, eligible, rateMod, favorMod, inviteMod, reaction,
    label: !eligible ? '恋愛対象外' : rateMod > 0 ? '好みが合う' : rateMod < 0 ? '会話次第' : '会話から' };
}
