import { getCardKnowledgeBySlug, getCardKnowledgeById } from './cardKnowledge.js'
import { applyRules } from './rules/applyRules.js'
import type { AppliedRule, Card, CombatPermissions, ValidationError, RuleContext } from './rules/types.js'

export const STAT_KEYS = ['chakra', 'invocation', 'iq', 'ninjutsuAttack', 'ninjutsuDefense', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'clan', 'speed', 'kekkeiGenkai'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type CombatStats = Record<StatKey, number>
export type CardSelection = string | { slug?: string; id?: number; name?: string; clans?: string[]; stats?: Partial<CombatStats> }
export type ShinobiSlots = Record<string, CardSelection | null | undefined>
export type ShinobiBuild = ShinobiSlots | { slots: ShinobiSlots }
export type CombatResult = { baseStats: CombatStats; finalStats: CombatStats; appliedRules: AppliedRule[]; permissions: CombatPermissions; validationErrors: ValidationError[]; total: number }
export type FightPlayer = 'player1' | 'player2' | 'player3'
export type CategoryFightResult = {
  category: string
  player1: { card: string; value: number }
  player2: { card: string; value: number }
  player3?: { card: string; value: number }
  winner: FightPlayer | 'draw'
}
export type FightResult = {
  winner: FightPlayer | 'draw'
  player1: CombatResult
  player2: CombatResult
  player3?: CombatResult
  player1Total: number
  player2Total: number
  player3Total?: number
  scores: { player1: number; player2: number; player3?: number }
  categories: CategoryFightResult[]
}

// shinobi-card-stats.json reste la source des statistiques numériques utilisées ici (via cardKnowledge)
const categoryStats: Record<string, StatKey[]> = { chakra: ['chakra'], invocation: ['invocation'], iq: ['iq'], ninjutsu: ['ninjutsuAttack', 'ninjutsuDefense'], genjutsu: ['genjutsu'], taijutsu: ['taijutsu'], avatar: ['avatar'], body: ['body'], fuinjutsu: ['fuinjutsu'], 'fūinjutsu': ['fuinjutsu'], senjutsu: ['senjutsu'], kenjutsu: ['kenjutsu'], vitesse: ['speed'], speed: ['speed'], 'kekkei-genkai': ['kekkeiGenkai'], kekkeigenkai: ['kekkeiGenkai'], 'kekkei-mora': [], kekkeimora: [] }
const fightCategories = ['chakra', 'invocation', 'iq', 'ninjutsu', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'clan', 'vitesse', 'kekkei-genkai', 'kekkei-mora']

function emptyStats(): CombatStats { return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as CombatStats }
function slotsOf(build: ShinobiBuild): ShinobiSlots { const slots = (build as { slots?: unknown }).slots; return slots && typeof slots === 'object' ? slots as ShinobiSlots : build as ShinobiSlots }
function findCard(selection: CardSelection): Card | undefined {
  if (typeof selection !== 'string' && selection.stats) return { id: selection.id ?? -1, name: selection.name ?? '', slug: selection.slug ?? '', clans: selection.clans ?? [], stats: { ...emptyStats(), ...selection.stats } }
  const raw = typeof selection === 'string' ? getCardKnowledgeBySlug(selection) : (selection.slug ? getCardKnowledgeBySlug(selection.slug) : undefined) ?? (selection.id ? getCardKnowledgeById(selection.id) : undefined)
  return raw as Card | undefined
}

function prepare(build: ShinobiBuild): { baseStats: CombatStats; cards: Partial<Record<string, Card>>; errors: ValidationError[] } {
  const baseStats = emptyStats(); const selected: Partial<Record<string, Card>> = {}; const errors: ValidationError[] = []
  for (const [category, selection] of Object.entries(slotsOf(build))) {
    if (!selection) continue
    const card = findCard(selection)
    if (!card) { errors.push({ ruleId: 'unknown-card', message: `Carte inconnue dans le slot ${category}.` }); continue }
    selected[category.toLowerCase()] = card
    for (const key of categoryStats[category.toLowerCase()] ?? []) baseStats[key] += card.stats[key] ?? 0
  }
  baseStats.clan = 0
  return { baseStats, cards: selected, errors }
}
function defaultPermissions(): CombatPermissions { return { sharingan: false, rinnegan: false, byakugan: false, tenseigan: false, otsutsuki: false, uzumaki: false } }
function contextFor(build: ShinobiBuild): RuleContext { const prepared = prepare(build); return { build, cards: prepared.cards, baseStats: prepared.baseStats, finalStats: { ...prepared.baseStats }, permissions: defaultPermissions(), appliedRules: [], validationErrors: prepared.errors } }
function resultOf(context: RuleContext): CombatResult { return { baseStats: { ...context.baseStats }, finalStats: { ...context.finalStats, clan: 0 }, appliedRules: context.appliedRules, permissions: context.permissions, validationErrors: context.validationErrors, total: calculateTotal(context.finalStats) } }

export function calculateCombat(build: ShinobiBuild, opponent?: RuleContext): CombatResult { const context = contextFor(build); applyRules(context, opponent); return resultOf(context) }
export function calculateFinalStats(build: ShinobiBuild): CombatStats { return calculateCombat(build).finalStats }
export function calculateTotal(stats: CombatStats): number { return STAT_KEYS.filter((key) => key !== 'clan').reduce((total, key) => total + Math.max(0, stats[key]), 0) }
function cardNameFor(build: ShinobiBuild, category: string): string {
  const selection = slotsOf(build)[category]
  return typeof selection === 'string' ? selection : selection?.name ?? selection?.slug ?? 'Aucune carte'
}
function categoryValue(result: CombatResult, category: string): number {
  const keys = categoryStats[category.toLowerCase()] ?? []
  return keys.reduce((total, key) => total + Math.max(0, result.finalStats[key]), 0)
}
function categoryWinner(values: number[]): FightPlayer | 'draw' {
  const highest = Math.max(...values)
  if (values.filter((value) => value === highest).length !== 1) return 'draw'
  return (`player${values.indexOf(highest) + 1}`) as FightPlayer
}
export function simulateFight(player1: ShinobiBuild, player2: ShinobiBuild, player3?: ShinobiBuild): FightResult {
  const builds = [player1, player2, player3].filter((build): build is ShinobiBuild => Boolean(build))
  const contexts = builds.map(contextFor)
  contexts.forEach((context, index) => applyRules(context, contexts.filter((_, opponentIndex) => opponentIndex !== index)))
  const results = contexts.map(resultOf)
  const invalid = results.some((result) => result.validationErrors.length > 0)
  const categories = fightCategories.filter((category) => builds.some((build) => slotsOf(build)[category]))
    .map((category) => {
      const entries = results.map((result, index) => ({ card: cardNameFor(builds[index]!, category), value: categoryValue(result, category) }))
      const winner = invalid ? 'draw' : categoryWinner(entries.map((entry) => entry.value))
      return { category, player1: entries[0]!, player2: entries[1]!, ...(entries[2] ? { player3: entries[2] } : {}), winner }
    })
  const scores = { player1: 0, player2: 0, ...(player3 ? { player3: 0 } : {}) }
  for (const category of categories) if (category.winner !== 'draw') scores[category.winner] += 1
  const scoreValues = Object.values(scores)
  const highestScore = Math.max(...scoreValues)
  const winner = invalid || scoreValues.filter((score) => score === highestScore).length !== 1
    ? 'draw'
    : (Object.entries(scores).find(([, score]) => score === highestScore)?.[0] as FightPlayer)
  return {
    winner,
    player1: results[0]!,
    player2: results[1]!,
    ...(results[2] ? { player3: results[2], player3Total: results[2].total } : {}),
    player1Total: results[0]!.total,
    player2Total: results[1]!.total,
    scores,
    categories,
  }
}
