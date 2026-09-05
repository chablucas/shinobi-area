import type { CombatStats, ShinobiBuild } from '../gameEngine.js'

export type Card = {
  id: number
  name: string
  slug: string
  clans: string[]
  stats: CombatStats
  powerIds?: string[]
  physicalTraitIds?: string[]
  transformationIds?: string[]
  avatars?: Array<{ id: string; type: string; name: string }>
}
export type RuleOperation = 'percentage' | 'points' | 'set'
export type AppliedRule = { ruleId: string; label: string; target: string; operation: RuleOperation; value: number; before: number; after: number }
export type CombatPermissions = { sharingan: boolean; rinnegan: boolean; byakugan: boolean; tenseigan: boolean; otsutsuki: boolean; uzumaki: boolean }
export type ValidationError = { ruleId: string; message: string }
export type RuleContext = { build: ShinobiBuild; cards: Partial<Record<string, Card>>; baseStats: CombatStats; finalStats: CombatStats; permissions: CombatPermissions; appliedRules: AppliedRule[]; validationErrors: ValidationError[] }