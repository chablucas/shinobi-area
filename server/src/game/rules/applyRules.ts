import type { RuleContext } from './types.js'
import { cardName, hasClan, percentage, points, setStat } from './ruleHelpers.js'
import { BIJU_GENJUTSU_PENALTY_POINTS, EIGHT_GATES_BONUS, IQ_MASTER_BONUS, OTSUTSUKI_BONUS, PERFECT_NINJUTSU_DEFENSE_REDUCTION, PERFECT_TAIJUTSU_NINJUTSU_BONUS, SENJU_CHAKRA_BONUS, UZUMAKI_CHAKRA_BONUS } from './constants.js'

const activeStats = ['chakra', 'invocation', 'iq', 'ninjutsuAttack', 'ninjutsuDefense', 'genjutsu', 'taijutsu', 'avatar', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'kekkeiGenkai'] as const
const bijuNames = ['shukaku', 'matatabi', 'isobu', 'son gokû', 'son goku', 'kokuô', 'kokuo', 'saiken', 'chômei', 'chomei', 'gyûki', 'gyuki', 'kurama', 'jûbi', 'juubi']
const hasName = (context: RuleContext, slot: string, values: string[]) => values.some((value) => cardName(context, slot).includes(value))
const hasBiju = (context: RuleContext) => hasName(context, 'avatar', bijuNames)

export function applyRules(context: RuleContext, opponent?: RuleContext): void {
  const iq = context.cards.iq?.stats.iq
  if (iq === 100) for (const target of activeStats) percentage(context, 'iq-master', 'Bonus IQ maître', target, IQ_MASTER_BONUS)

  const clan = context.cards.clan
  if (hasClan(context, 'UZUMAKI')) { context.permissions.uzumaki = true; percentage(context, 'clan-uzumaki-chakra', 'Bonus du clan Uzumaki', 'chakra', UZUMAKI_CHAKRA_BONUS) }
  if (hasClan(context, 'SENJU')) percentage(context, 'clan-senju-chakra', 'Bonus du clan Senju', 'chakra', SENJU_CHAKRA_BONUS)
  if (hasClan(context, 'OTSUTSUKI')) { context.permissions.sharingan = true; context.permissions.rinnegan = true; context.permissions.otsutsuki = true; percentage(context, 'clan-otsutsuki', 'Bonus du clan Ôtsutsuki', 'chakra', OTSUTSUKI_BONUS); percentage(context, 'clan-otsutsuki', 'Bonus du clan Ôtsutsuki', 'body', OTSUTSUKI_BONUS); percentage(context, 'clan-otsutsuki', 'Bonus du clan Ôtsutsuki', 'speed', OTSUTSUKI_BONUS) }
  if (clan?.clans.some((value) => value.toLowerCase() === 'uchiwa')) context.permissions.sharingan = true
  if (context.permissions.sharingan && context.permissions.uzumaki) context.permissions.rinnegan = true
  context.finalStats.clan = 0

  if (hasName(context, 'ninjutsu', ['minato', 'tobirama'])) percentage(context, 'ninjutsu-speed', 'Vitesse de Minato ou Tobirama', 'speed', 0.25)
  if (context.baseStats.taijutsu === 100) {
    percentage(context, 'taijutsu-master-ninjutsu', 'Bonus Taijutsu à 100', 'ninjutsuAttack', PERFECT_TAIJUTSU_NINJUTSU_BONUS)
    if (opponent?.baseStats.ninjutsuDefense === 100) points(context, 'perfect-defense-taijutsu', 'Réduction du bonus Taijutsu', 'ninjutsuAttack', -(context.baseStats.ninjutsuAttack * PERFECT_TAIJUTSU_NINJUTSU_BONUS / 2))
  }
  if (hasName(context, 'taijutsu', ['guy 8 portes'])) {
    percentage(context, 'guy-eight-gates', 'Bonus des Huit Portes', 'taijutsu', EIGHT_GATES_BONUS)
    if (opponent?.baseStats.ninjutsuDefense === 100) points(context, 'perfect-defense-eight-gates', 'Réduction du bonus des Huit Portes', 'taijutsu', -(context.baseStats.taijutsu * EIGHT_GATES_BONUS / 2))
  }
  if (context.baseStats.genjutsu === 100 && opponent && hasName(opponent, 'avatar', ['hachibi', 'gyûki', 'gyuki', 'kurama', 'jûbi', 'juubi'])) points(context, 'genjutsu-biju-counter', 'Contre Genjutsu contre un Bijû', 'genjutsu', -BIJU_GENJUTSU_PENALTY_POINTS)
  if (context.baseStats.ninjutsuDefense === 100 && opponent) percentage(opponent, 'perfect-defense-ninjutsu', 'Défense Ninjutsu parfaite', 'ninjutsuAttack', -PERFECT_NINJUTSU_DEFENSE_REDUCTION)

  const avatar = cardName(context, 'avatar')
  if (avatar.includes('shukaku')) percentage(context, 'biju-shukaku', 'Bonus de Shukaku', 'fuinjutsu', 0.25)
  if (avatar.includes('matatabi')) percentage(context, 'biju-matatabi', 'Bonus de Matatabi', 'speed', 0.25)
  if (avatar.includes('isobu')) percentage(context, 'biju-isobu', 'Bonus d’Isobu', 'genjutsu', 0.25)
  if (avatar.includes('son gok') || avatar.includes('son gokû')) percentage(context, 'biju-son-goku', 'Bonus de Son Gokû', 'kekkeiGenkai', 0.25)
  if (avatar.includes('koku')) percentage(context, 'biju-kokuo', 'Bonus de Kokuô', 'taijutsu', 0.25)
  if (avatar.includes('saiken')) { percentage(context, 'biju-saiken', 'Bonus de Saiken', 'ninjutsuAttack', 0.25); percentage(context, 'biju-saiken', 'Bonus de Saiken', 'ninjutsuDefense', 0.25) }
  if (avatar.includes('chomei') || avatar.includes('chômei')) percentage(context, 'biju-chomei', 'Bonus de Chômei', 'body', 0.25)
  if (avatar.includes('gyûki') || avatar.includes('gyuki') || avatar.includes('hachibi')) percentage(context, 'biju-hachibi', 'Bonus de Gyûki', 'iq', 0.5)
  if (avatar.includes('kurama')) percentage(context, 'biju-kurama', 'Bonus de Kurama', 'senjutsu', 0.5)
  if (avatar.includes('kcm2') && hasName(context, 'senjutsu', ['naruto'])) setStat(context, 'kurama-kcm2-senjutsu', 'Senjutsu de Kurama KCM2', 'senjutsu', 100)
  if (avatar.includes('jûbi') || avatar.includes('juubi')) { if (context.baseStats.chakra < 70) context.validationErrors.push({ ruleId: 'juubi-chakra', message: 'Le Jûbi nécessite au moins 70 points de Chakra.' }); if (!hasName(context, 'avatar', ['juubito', 'juubidara', 'jûbito', 'jûbidara'])) context.validationErrors.push({ ruleId: 'juubi-avatar', message: 'Le Jûbi nécessite Jûbito ou Jûbidara dans le slot Avatar.' }) }

  if (hasName(context, 'body', ['marque', 'curse mark']) && hasName(context, 'avatar', ['susanoo'])) percentage(context, 'body-avatar-susanoo', 'Marque maudite et Susanoo', 'avatar', 0.1)
  if (hasName(context, 'fuinjutsu', ['karin', 'mito', 'kushina']) && opponent && hasBiju(opponent)) { percentage(context, 'fuinjutsu-biju-ninjutsu', 'Fûinjutsu contre un Bijû', 'ninjutsuAttack', 0.25); percentage(context, 'fuinjutsu-biju-ninjutsu', 'Fûinjutsu contre un Bijû', 'ninjutsuDefense', 0.25) }
  if (context.cards.senjutsu && opponent && (hasClan(opponent, 'OTSUTSUKI') || opponent.cards.body?.clans.some((value) => value.toLowerCase() === 'otsutsuki'))) { percentage(context, 'senjutsu-otsutsuki', 'Senjutsu contre Ôtsutsuki', 'ninjutsuAttack', 0.25); percentage(context, 'senjutsu-otsutsuki', 'Senjutsu contre Ôtsutsuki', 'ninjutsuDefense', 0.25) }
  const kenjutsuBonuses: [string, string, number][] = [['kisame', 'chakra', 0.1], ['itachi', 'ninjutsuAttack', 0.1], ['ginkaku', 'ninjutsuAttack', 0.1], ['kinkaku', 'ninjutsuAttack', 0.1], ['tenten', 'ninjutsuAttack', 0.05], ['madara', 'ninjutsuAttack', 0.15]]
  for (const [name, target, value] of kenjutsuBonuses) if (cardName(context, 'kenjutsu') === name || (name === 'madara' && cardName(context, 'kenjutsu') === 'madara')) { percentage(context, `kenjutsu-${name}`, `Bonus de Kenjutsu ${name}`, target as typeof activeStats[number], value); if (target === 'ninjutsuAttack') percentage(context, `kenjutsu-${name}`, `Bonus de Kenjutsu ${name}`, 'ninjutsuDefense', value) }
  if (hasName(context, 'kekkei-mora', ['hamura'])) { percentage(context, 'mora-hamura', 'Kekkei Môra de Hamura', 'chakra', 0.25); percentage(context, 'mora-hamura', 'Kekkei Môra de Hamura', 'ninjutsuAttack', 0.25); percentage(context, 'mora-hamura', 'Kekkei Môra de Hamura', 'ninjutsuDefense', 0.25) }
  if (hasName(context, 'kekkei-mora', ['toneri'])) { percentage(context, 'mora-toneri', 'Kekkei Môra de Toneri', 'chakra', 0.1); percentage(context, 'mora-toneri', 'Kekkei Môra de Toneri', 'ninjutsuAttack', 0.1); percentage(context, 'mora-toneri', 'Kekkei Môra de Toneri', 'ninjutsuDefense', 0.1) }
  if (opponent && hasName(context, 'kekkei-mora', ['sasuke']) && hasName(opponent, 'taijutsu', ['guy 8 portes'])) percentage(context, 'sasuke-guy-counter', 'Sasuke contre Guy Huit Portes', 'kekkeiGenkai', -0.5)
  if (!context.permissions.sharingan && hasName(context, 'ninjutsu', ['uchiwa'])) { percentage(context, 'sharingan-required', 'Technique Uchiwa sans Sharingan', 'ninjutsuAttack', -0.5); percentage(context, 'sharingan-required', 'Technique Uchiwa sans Sharingan', 'ninjutsuDefense', -0.5) }
}