import cardStatsData from '../data/shinobi-card-stats.json' with { type: 'json' }
import { applyRules } from './rules/applyRules.js'
import type { AppliedRule, Card, CombatPermissions, ValidationError, RuleContext } from './rules/types.js'

export const STAT_KEYS = ['chakra', 'invocation', 'iq', 'ninjutsuAttack', 'ninjutsuDefense', 'genjutsu', 'taijutsu', 'avatar', 'body', 'fuinjutsu', 'senjutsu', 'kenjutsu', 'clan', 'speed', 'kekkeiGenkai'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type CombatStats = Record<StatKey, number>
export type CardSelection = string | { slug?: string; id?: number; name?: string; clans?: string[]; stats?: Partial<CombatStats> }
export type ShinobiSlots = Record<string, CardSelection | null | undefined>
export type ShinobiBuild = ShinobiSlots | { slots: ShinobiSlots }
export type CombatResult = { baseStats: CombatStats; finalStats: CombatStats; appliedRules: AppliedRule[]; permissions: CombatPermissions; validationErrors: ValidationError[]; total: number }
export type FightResult = { winner: 'player1' | 'player2' | 'draw'; player1: CombatResult; player2: CombatResult; player1Total: number; player2Total: number }

type RawCard = { id: number; name: string; slug: string; clans: string[]; stats: Record<string, number> }
const cards = cardStatsData as RawCard[]
const bySlug = new Map(cards.map((card) => [card.slug, card]))
const byId = new Map(cards.map((card) => [card.id, card]))
const categoryStats: Record<string, StatKey[]> = { chakra: ['chakra'], invocation: ['invocation'], iq: ['iq'], ninjutsu: ['ninjutsuAttack', 'ninjutsuDefense'], genjutsu: ['genjutsu'], taijutsu: ['taijutsu'], avatar: ['avatar'], body: ['body'], fuinjutsu: ['fuinjutsu'], 'fūinjutsu': ['fuinjutsu'], senjutsu: ['senjutsu'], kenjutsu: ['kenjutsu'], vitesse: ['speed'], speed: ['speed'], 'kekkei-genkai': ['kekkeiGenkai'], kekkeigenkai: ['kekkeiGenkai'], 'kekkei-mora': [], kekkeimora: [] }

function emptyStats(): CombatStats { return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as CombatStats }
function slotsOf(build: ShinobiBuild): ShinobiSlots { const slots = (build as { slots?: unknown }).slots; return slots && typeof slots === 'object' ? slots as ShinobiSlots : build as ShinobiSlots }
function findCard(selection: CardSelection): Card | undefined {
  if (typeof selection !== 'string' && selection.stats) return { id: selection.id ?? -1, name: selection.name ?? '', slug: selection.slug ?? '', clans: selection.clans ?? [], stats: { ...emptyStats(), ...selection.stats } }
  const raw = typeof selection === 'string' ? bySlug.get(selection) : (selection.slug ? bySlug.get(selection.slug) : undefined) ?? (selection.id ? byId.get(selection.id) : undefined)
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
export function simulateFight(player1: ShinobiBuild, player2: ShinobiBuild): FightResult {
  const context1 = contextFor(player1); const context2 = contextFor(player2); applyRules(context1, context2); applyRules(context2, context1)
  const result1 = resultOf(context1); const result2 = resultOf(context2); const invalid = result1.validationErrors.length > 0 || result2.validationErrors.length > 0
  return { winner: invalid ? 'draw' : result1.total === result2.total ? 'draw' : result1.total > result2.total ? 'player1' : 'player2', player1: result1, player2: result2, player1Total: result1.total, player2Total: result2.total }
}
