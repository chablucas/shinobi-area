import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCombat, calculateFinalStats, calculateTotal, simulateFight, type CombatStats } from '../src/game/gameEngine.js'

const zeroStats = (): CombatStats => ({ chakra: 0, invocation: 0, iq: 0, ninjutsuAttack: 0, ninjutsuDefense: 0, genjutsu: 0, taijutsu: 0, avatar: 0, body: 0, fuinjutsu: 0, senjutsu: 0, kenjutsu: 0, clan: 0, speed: 0, kekkeiGenkai: 0, kekkeiMora: 0 })
function card(name: string, stats: Partial<CombatStats> = {}, clans: string[] = []): object { return { name, slug: name.toLowerCase().replaceAll(' ', '-'), clans, stats: { ...zeroStats(), ...stats } } }
function build(slots: Record<string, object | string>): { slots: Record<string, object | string> } { return { slots } }
const iq100 = card('IQ 100', { iq: 100 })
const iq99 = card('IQ 99', { iq: 99 })
const neutral = card('Neutral', { chakra: 80, invocation: 80, iq: 80, ninjutsuAttack: 80, ninjutsuDefense: 80, genjutsu: 80, taijutsu: 80, avatar: 80, body: 80, fuinjutsu: 80, senjutsu: 80, kenjutsu: 80, speed: 80, kekkeiGenkai: 80 })
const defense100 = card('Defense parfaite', { ninjutsuDefense: 100 })
const genjutsu100 = card('Genjutsu parfait', { genjutsu: 100 })
const biju = (name: string) => card(name, { avatar: 40 })

test('1. IQ 100 applique +5% sauf Body, Vitesse et Clan', () => {
  const stats = calculateFinalStats(build({ iq: iq100, chakra: neutral, invocation: neutral, ninjutsu: neutral, genjutsu: neutral, taijutsu: neutral, avatar: neutral, body: neutral, fuinjutsu: neutral, senjutsu: neutral, kenjutsu: neutral, 'kekkei-genkai': neutral, sensory: neutral, vitesse: neutral, clan: neutral }))
  assert.equal(stats.chakra, 84); assert.equal(stats.body, 80); assert.equal(stats.speed, 80); assert.equal(stats.clan, 0); assert.equal(stats.ninjutsuAttack, 84); assert.equal(stats.ninjutsuDefense, 84)
})
test('2. IQ 99 ne déclenche aucun bonus', () => assert.equal(calculateFinalStats(build({ iq: iq99, chakra: neutral })).chakra, 80))
test('3. une défense Ninjutsu à 100 réduit de 20% l attaque adverse', () => assert.equal(simulateFight(build({ ninjutsu: defense100 }), build({ ninjutsu: card('Attaque', { ninjutsuAttack: 80 }) })).player2.finalStats.ninjutsuAttack, 64))
test('4. la défense parfaite fonctionne dans les deux sens', () => { const result = simulateFight(build({ ninjutsu: defense100 }), build({ ninjutsu: defense100 })); assert.equal(result.player1.finalStats.ninjutsuAttack, 0); assert.equal(result.player2.finalStats.ninjutsuAttack, 0) })
test('5. Minato en Ninjutsu donne +25% de Vitesse', () => assert.equal(calculateFinalStats(build({ ninjutsu: card('Minato'), vitesse: card('Vitesse', { speed: 80 }) })).speed, 100))
test('6. Tobirama en Ninjutsu donne +25% de Vitesse', () => assert.equal(calculateFinalStats(build({ ninjutsu: card('Tobirama'), vitesse: card('Vitesse', { speed: 80 }) })).speed, 100))
test('7. Guy 8 Portes obtient son bonus', () => assert.equal(calculateFinalStats(build({ taijutsu: card('Guy 8 Portes', { taijutsu: 100 }) })).taijutsu, 150))
test('8. la défense parfaite réduit de moitié le bonus des Huit Portes', () => assert.equal(simulateFight(build({ taijutsu: card('Guy 8 Portes', { taijutsu: 100 }) }), build({ ninjutsu: defense100 })).player1.finalStats.taijutsu, 125))
for (const [name] of [['Hachibi'], ['Kurama'], ['Jûbi']] as const) test(`9-11. Genjutsu 100 perd 15 contre ${name}`, () => assert.equal(simulateFight(build({ genjutsu: genjutsu100 }), build({ avatar: biju(name) })).player1.finalStats.genjutsu, 85))
const bijuBonuses: Array<[string, string, keyof CombatStats, number]> = [['Shukaku', 'fuinjutsu', 'fuinjutsu', 25], ['Matatabi', 'vitesse', 'speed', 25], ['Isobu', 'genjutsu', 'genjutsu', 25], ['Son Gokû', 'kekkei-genkai', 'kekkeiGenkai', 25], ['Kokuô', 'taijutsu', 'taijutsu', 25], ['Saiken', 'ninjutsu', 'ninjutsuAttack', 25], ['Chômei', 'body', 'body', 25], ['Gyûki', 'iq', 'iq', 50], ['Kurama', 'senjutsu', 'senjutsu', 50]]
for (const [name, slot, target, increase] of bijuBonuses) test(`12-13. bonus de ${name}`, () => { const base = 80; const stats = calculateFinalStats(build({ avatar: biju(name), [slot]: card('Base', { [target]: base }) })); assert.equal(stats[target], base * (1 + increase / 100)) })
test('14. Kurama KCM2 avec Naruto Senjutsu fixe Senjutsu à 100', () => assert.equal(calculateFinalStats(build({ avatar: card('Kurama KCM2'), senjutsu: card('Naruto KCM2', { senjutsu: 70 }) })).senjutsu, 100))
test('15. Jûbi refusé avec moins de 70 Chakra', () => assert.ok(calculateCombat(build({ avatar: card('Jûbi'), chakra: card('Chakra', { chakra: 69 }) })).validationErrors.some((error) => error.ruleId === 'juubi-chakra')))
test('16. Jûbi refusé sans Jûbito ou Jûbidara', () => assert.ok(calculateCombat(build({ avatar: card('Jûbi'), chakra: card('Chakra', { chakra: 70 }) })).validationErrors.some((error) => error.ruleId === 'juubi-avatar')))
for (const name of ['Karin', 'Mito', 'Kushina']) test(`17. ${name} donne +25% Ninjutsu contre un Bijû`, () => { const result = simulateFight(build({ fuinjutsu: card(name), ninjutsu: card('Ninjutsu', { ninjutsuAttack: 80, ninjutsuDefense: 80 }) }), build({ avatar: biju('Kurama') })); assert.equal(result.player1.finalStats.ninjutsuAttack, 100); assert.equal(result.player1.finalStats.ninjutsuDefense, 100) })
test('18. Senjutsu donne +25% Ninjutsu contre Ôtsutsuki', () => { const result = simulateFight(build({ senjutsu: card('Naruto', { senjutsu: 80 }), ninjutsu: card('Ninjutsu', { ninjutsuAttack: 80, ninjutsuDefense: 80 }) }), build({ clan: card('Clan', {}, ['OTSUTSUKI']) })); assert.equal(result.player1.finalStats.ninjutsuAttack, 100) })
for (const [name, target, value] of [['Kisame', 'chakra', 88], ['Itachi', 'ninjutsuAttack', 88], ['Ginkaku', 'ninjutsuAttack', 88], ['Kinkaku', 'ninjutsuAttack', 88], ['Tenten', 'ninjutsuAttack', 84], ['Madara', 'ninjutsuAttack', 92]] as const) test(`19. bonus Kenjutsu de ${name}`, () => assert.equal(calculateFinalStats(build({ kenjutsu: card(name), [target === 'chakra' ? 'chakra' : 'ninjutsu']: card('Base', { [target]: 80 }) }))[target], value))
test('20. Madara Prime ne reçoit pas le bonus de Madara de base', () => assert.equal(calculateFinalStats(build({ kenjutsu: card('Madara Prime'), ninjutsu: card('Base', { ninjutsuAttack: 80 }) })).ninjutsuAttack, 80))
test('21. une technique Uchiwa sans clan Uchiwa perd 50%', () => assert.equal(calculateFinalStats(build({ ninjutsu: card('Technique Uchiwa', { ninjutsuAttack: 80, ninjutsuDefense: 80 }) })).ninjutsuAttack, 40))
test('22. le clan Uzumaki donne +25% Chakra', () => assert.equal(calculateFinalStats(build({ clan: card('Uzumaki', {}, ['UZUMAKI']), chakra: card('Base', { chakra: 80 }) })).chakra, 100))
test('23. le clan Senju donne +10% Chakra', () => assert.equal(calculateFinalStats(build({ clan: card('Senju', {}, ['SENJU']), chakra: card('Base', { chakra: 80 }) })).chakra, 88))
test('24. le clan Ôtsutsuki donne +35% Chakra, Body et Vitesse', () => { const stats = calculateFinalStats(build({ clan: card('Otsutsuki', {}, ['OTSUTSUKI']), chakra: card('C', { chakra: 80 }), body: card('B', { body: 80 }), vitesse: card('V', { speed: 80 }) })); assert.equal(stats.chakra, 108); assert.equal(stats.body, 108); assert.equal(stats.speed, 108) })
test('25. Ôtsutsuki autorise Sharingan et Rinnegan', () => { const result = calculateCombat(build({ clan: card('Otsutsuki', {}, ['OTSUTSUKI']) })); assert.equal(result.permissions.sharingan, true); assert.equal(result.permissions.rinnegan, true) })
test('26. Uchiwa + Uzumaki autorise le Rinnegan', () => { const result = calculateCombat(build({ clan: card('Double clan', {}, ['UCHIWA', 'UZUMAKI']) })); assert.equal(result.permissions.rinnegan, true) })
test('27. Hamura en Kekkei Môra donne +25% Chakra et Ninjutsu', () => { const stats = calculateFinalStats(build({ 'kekkei-mora': card('Hamura'), chakra: card('C', { chakra: 80 }), ninjutsu: card('N', { ninjutsuAttack: 80, ninjutsuDefense: 80 }) })); assert.equal(stats.chakra, 100); assert.equal(stats.ninjutsuAttack, 100) })
test('28. Toneri en Kekkei Môra donne +10% Chakra et Ninjutsu', () => { const stats = calculateFinalStats(build({ 'kekkei-mora': card('Toneri'), chakra: card('C', { chakra: 80 }), ninjutsu: card('N', { ninjutsuAttack: 80, ninjutsuDefense: 80 }) })); assert.equal(stats.chakra, 88); assert.equal(stats.ninjutsuAttack, 88) })
test('29. Sasuke en Kekkei Môra perd 50% contre Guy 8 Portes', () => { const result = simulateFight(build({ 'kekkei-mora': card('Sasuke'), 'kekkei-genkai': card('KG', { kekkeiGenkai: 80 }) }), build({ taijutsu: card('Guy 8 Portes', { taijutsu: 100 }) })); assert.equal(result.player1.finalStats.kekkeiGenkai, 40) })
test('30. Kekkei Genkai, Kekkei Môra et Ninjutsu restent séparés', () => { const stats = calculateFinalStats(build({ 'kekkei-genkai': card('KG', { kekkeiGenkai: 80 }), 'kekkei-mora': card('Mora'), ninjutsu: card('N', { ninjutsuAttack: 70, ninjutsuDefense: 60 }) })); assert.equal(stats.kekkeiGenkai, 80); assert.equal(stats.ninjutsuAttack, 70); assert.equal(stats.ninjutsuDefense, 60) })
test('31. stats.clan reste égal à zéro', () => assert.equal(calculateFinalStats(build({ clan: card('Clan', { clan: 99 }) })).clan, 0))
test('32. le slot Clan est exclu du total', () => { const stats = calculateFinalStats(build({ clan: card('Clan', { clan: 99 }) })); assert.equal(calculateTotal(stats), 0) })
test('sensory ne participe jamais au total', () => { const stats = calculateFinalStats(build({ chakra: card('Sensory fixture', { chakra: 10, sensory: 100 } as Partial<CombatStats>), clan: card('Clan') })); assert.equal(calculateTotal(stats), 10) })
test('33. aucune statistique finale ne devient négative', () => assert.ok(Object.values(calculateFinalStats(build({ ninjutsu: card('Uchiwa', { ninjutsuAttack: 0, ninjutsuDefense: 0 }) }))).every((value) => value >= 0)))
test('34. chaque règle déclenchée est tracée', () => { const result = calculateCombat(build({ clan: card('Uzumaki', {}, ['UZUMAKI']), chakra: card('C', { chakra: 80 }) })); assert.ok(result.appliedRules.some((rule) => rule.ruleId === 'clan-uzumaki-chakra')) })
test('35. une composition invalide ne lance pas le combat', () => { const result = simulateFight(build({ chakra: 'unknown-card' }), build({ chakra: 'neutral' })); assert.equal(result.winner, 'draw'); assert.ok(result.player1.validationErrors.length > 0) })
test('36. le gagnant est déterminé sur le score final, pas sur les catégories', () => {
  const result = simulateFight(
    build({ chakra: card('P1', { chakra: 794.95 }), ninjutsu: card('N1', { ninjutsuAttack: 0, ninjutsuDefense: 0 }), genjutsu: card('G1', { genjutsu: 0 }), taijutsu: card('T1', { taijutsu: 0 }), avatar: card('A1', { avatar: 0 }), body: card('B1', { body: 0 }), fuinjutsu: card('F1', { fuinjutsu: 0 }), senjutsu: card('S1', { senjutsu: 0 }), kenjutsu: card('K1', { kenjutsu: 0 }), iq: card('IQ1', { iq: 0 }), invocation: card('I1', { invocation: 0 }), 'kekkei-genkai': card('KG1', { kekkeiGenkai: 0 }), vitesse: card('V1', { speed: 0 }) }),
    build({ chakra: card('P2', { chakra: 787.9499999999999 }), ninjutsu: card('N2', { ninjutsuAttack: 0, ninjutsuDefense: 0 }), genjutsu: card('G2', { genjutsu: 0 }), taijutsu: card('T2', { taijutsu: 0 }), avatar: card('A2', { avatar: 0 }), body: card('B2', { body: 0 }), fuinjutsu: card('F2', { fuinjutsu: 0 }), senjutsu: card('S2', { senjutsu: 0 }), kenjutsu: card('K2', { kenjutsu: 0 }), iq: card('IQ2', { iq: 0 }), invocation: card('I2', { invocation: 0 }), 'kekkei-genkai': card('KG2', { kekkeiGenkai: 0 }), vitesse: card('V2', { speed: 0 }) }),
  )
  assert.equal(result.winner, 'player1')
  assert.equal(result.player1Total, 794.95)
  assert.equal(result.player2Total, 787.9499999999999)
})

test('37. égalités exactes restent des égalités et les scores supérieurs gagnent', () => {
  assert.equal(simulateFight(build({ chakra: card('P1', { chakra: 800 }) }), build({ chakra: card('P2', { chakra: 800 }) })).winner, 'draw')
  assert.equal(simulateFight(build({ chakra: card('P1', { chakra: 799 }) }), build({ chakra: card('P2', { chakra: 800 }) })).winner, 'player2')
})

test('38. les valeurs canonique de Vitesse/Kekkei Genkai/Kekkei Mōra restent numériques', () => {
  const stats = calculateFinalStats(build({ vitesse: card('V', { speed: 78 }), 'kekkei-genkai': card('KG', { kekkeiGenkai: 65 }), 'kekkei-mora': card('KM', { kekkeiMora: 92 }) }))
  assert.equal(stats.speed, 78)
  assert.equal(stats.kekkeiGenkai, 65)
  assert.equal(stats.kekkeiMora, 92)
})

test('Minato dans un autre slot ne donne pas de Vitesse', () => assert.equal(calculateFinalStats(build({ body: card('Minato'), vitesse: card('V', { speed: 80 }) })).speed, 80))
test('Tobirama dans un autre slot ne donne pas de Vitesse', () => assert.equal(calculateFinalStats(build({ body: card('Tobirama'), vitesse: card('V', { speed: 80 }) })).speed, 80))
for (const name of ['Madara Prime', 'Madara Vieux', 'Jûbidara']) test(`${name} ne déclenche pas le bonus Madara`, () => assert.equal(calculateFinalStats(build({ kenjutsu: card(name), ninjutsu: card('N', { ninjutsuAttack: 80 }) })).ninjutsuAttack, 80))
test('Hamura hors Kekkei Môra ne donne pas son bonus', () => assert.equal(calculateFinalStats(build({ body: card('Hamura'), chakra: card('C', { chakra: 80 }) })).chakra, 80))
test('Toneri hors Kekkei Môra ne donne pas son bonus', () => assert.equal(calculateFinalStats(build({ body: card('Toneri'), chakra: card('C', { chakra: 80 }) })).chakra, 80))
test('un Uchiwa dans un autre slot ne remplace pas le clan Uchiwa', () => { const result = calculateCombat(build({ body: card('Sasuke'), ninjutsu: card('Technique Uchiwa', { ninjutsuAttack: 80 }) })); assert.equal(result.permissions.sharingan, false); assert.equal(result.finalStats.ninjutsuAttack, 40) })
test('un Avatar non-Bijû ne déclenche pas Karin', () => { const result = simulateFight(build({ fuinjutsu: card('Karin'), ninjutsu: card('N', { ninjutsuAttack: 80 }) }), build({ avatar: card('Avatar normal') })); assert.equal(result.player1.finalStats.ninjutsuAttack, 80) })
test('Kekkei Môra ne donne aucun Ninjutsu automatique', () => { const stats = calculateFinalStats(build({ 'kekkei-mora': card('Môra'), ninjutsu: card('N', { ninjutsuAttack: 70, ninjutsuDefense: 60 }), 'kekkei-genkai': card('KG', { kekkeiGenkai: 50 }) })); assert.equal(stats.ninjutsuAttack, 70); assert.equal(stats.ninjutsuDefense, 60); assert.equal(stats.kekkeiGenkai, 50) })
