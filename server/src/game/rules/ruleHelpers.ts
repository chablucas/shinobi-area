import type { RuleContext } from './types.js'
import type { StatKey } from '../gameEngine.js'

export function cardName(context: RuleContext, slot: string): string { return context.cards[slot]?.name.toLowerCase() ?? '' }
export function hasClan(context: RuleContext, clan: string): boolean { return context.cards.clan?.clans.some((value) => value.toLowerCase() === clan.toLowerCase()) ?? false }
export function percentage(context: RuleContext, ruleId: string, label: string, target: StatKey, value: number): void {
  const before = context.finalStats[target]; const after = Math.max(0, before * (1 + value)); context.finalStats[target] = after
  context.appliedRules.push({ ruleId, label, target, operation: 'percentage', value, before, after })
}
export function points(context: RuleContext, ruleId: string, label: string, target: StatKey, value: number): void {
  const before = context.finalStats[target]; const after = Math.max(0, before + value); context.finalStats[target] = after
  context.appliedRules.push({ ruleId, label, target, operation: 'points', value, before, after })
}
export function setStat(context: RuleContext, ruleId: string, label: string, target: StatKey, value: number): void {
  const before = context.finalStats[target]; context.finalStats[target] = Math.max(0, value)
  context.appliedRules.push({ ruleId, label, target, operation: 'set', value, before, after: context.finalStats[target] })
}