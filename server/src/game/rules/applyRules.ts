import type { RuleContext } from './types.js'
import { rules as combatRules, type CombatRule, type RuleCondition, type RuleEffect } from '../../services/gameDataService.js'
import type { StatKey } from '../gameEngine.js'

const activeStats: StatKey[] = [
  'chakra',
  'invocation',
  'iq',
  'ninjutsuAttack',
  'ninjutsuDefense',
  'genjutsu',
  'taijutsu',
  'avatar',
  'body',
  'fuinjutsu',
  'senjutsu',
  'kenjutsu',
  'speed',
  'kekkeiGenkai',
]

function getSlotCard(ctx: RuleContext, slotName: string) {
  const normSlot = slotName.toLowerCase().replace(/-/g, '')
  for (const [key, card] of Object.entries(ctx.cards)) {
    if (key.toLowerCase().replace(/-/g, '') === normSlot) {
      return card
    }
  }
  return undefined
}

function extractFieldValue(ctx: RuleContext, slotName: string, field: string): unknown {
  const normSlot = slotName.toLowerCase()
  if (normSlot === 'all' || normSlot === 'any') {
    const values: unknown[] = []
    for (const key of Object.keys(ctx.cards)) {
      const v = extractFieldValue(ctx, key, field)
      if (v !== undefined) {
        if (Array.isArray(v)) values.push(...v)
        else values.push(v)
      }
    }
    return values
  }

  const card = getSlotCard(ctx, slotName)

  if (field === 'card') {
    return card !== undefined
  }

  if (!card) {
    if (field === 'baseScore' || field === 'finalScore') return 0
    if (field === 'defenseFinal') return ctx.finalStats.ninjutsuDefense
    return undefined
  }

  if (field === 'card.slug') return card.slug
  if (field === 'card.clans') return card.clans ?? []
  if (field === 'card.powerIds') return card.powerIds ?? []
  if (field === 'card.physicalTraitIds') return card.physicalTraitIds ?? []
  if (field === 'card.transformationIds') return card.transformationIds ?? []
  if (field === 'selectedAvatar.id') {
    return card.avatars?.map((a) => a.id) ?? []
  }
  if (field === 'selectedAvatar.type') {
    return card.avatars?.map((a) => a.type) ?? []
  }
  if (field === 'baseScore') {
    const statKey = normSlot as StatKey
    if (statKey in ctx.baseStats) return ctx.baseStats[statKey]
    if (normSlot === 'ninjutsu') return ctx.baseStats.ninjutsuAttack
    return card.stats[statKey] ?? 0
  }
  if (field === 'finalScore') {
    const statKey = normSlot as StatKey
    if (statKey in ctx.finalStats) return ctx.finalStats[statKey]
    if (normSlot === 'ninjutsu') return ctx.finalStats.ninjutsuAttack
    return ctx.finalStats[statKey] ?? 0
  }
  if (field === 'defenseFinal') {
    return ctx.finalStats.ninjutsuDefense
  }

  return undefined
}

function evalSingleCondition(
  cond: RuleCondition,
  selfCtx: RuleContext,
  opponentCtxs: RuleContext[]
): boolean {
  const targetCtxs = cond.side === 'SELF' ? [selfCtx] : opponentCtxs

  if (targetCtxs.length === 0) {
    return false
  }

  return targetCtxs.some((ctx) => {
    const actualValue = extractFieldValue(ctx, cond.slot, cond.field)

    if (cond.operator === 'NOT_EQUALS_PATH') {
      let pathValue: unknown = undefined
      if (typeof cond.value === 'string') {
        const parts = cond.value.split('.')
        if (parts[0] === 'self' && parts[1] === 'slots') {
          const targetSlot = parts[2]
          const targetField = parts.slice(3).join('.')
          pathValue = extractFieldValue(selfCtx, targetSlot!, targetField)
        }
      }
      return actualValue !== pathValue
    }

    if (cond.operator === 'EXISTS') {
      return Boolean(actualValue) === Boolean(cond.value)
    }

    if (cond.operator === 'EQUALS') {
      if (Array.isArray(actualValue)) {
        return actualValue.includes(cond.value)
      }
      return actualValue === cond.value
    }

    if (cond.operator === 'NOT_EQUALS') {
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(cond.value)
      }
      return actualValue !== cond.value
    }

    if (cond.operator === 'IN') {
      const allowed = Array.isArray(cond.value) ? cond.value : [cond.value]
      if (Array.isArray(actualValue)) {
        return actualValue.some((val) => allowed.includes(val))
      }
      return allowed.includes(actualValue)
    }

    if (cond.operator === 'NOT_IN') {
      const disallowed = Array.isArray(cond.value) ? cond.value : [cond.value]
      if (Array.isArray(actualValue)) {
        return !actualValue.some((val) => disallowed.includes(val))
      }
      return !disallowed.includes(actualValue)
    }

    if (cond.operator === 'CONTAINS') {
      if (Array.isArray(actualValue)) {
        return actualValue.includes(cond.value)
      }
      return actualValue === cond.value
    }

    if (cond.operator === 'NOT_CONTAINS') {
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(cond.value)
      }
      return actualValue !== cond.value
    }

    if (cond.operator === 'CONTAINS_ANY') {
      const targets = Array.isArray(cond.value) ? cond.value : [cond.value]
      if (Array.isArray(actualValue)) {
        return targets.some((t) => actualValue.includes(t))
      }
      return targets.includes(actualValue)
    }

    if (cond.operator === 'GREATER_THAN') {
      return Number(actualValue) > Number(cond.value)
    }

    if (cond.operator === 'GREATER_OR_EQUAL') {
      return Number(actualValue) >= Number(cond.value)
    }

    if (cond.operator === 'LESS_THAN') {
      return Number(actualValue) < Number(cond.value)
    }

    if (cond.operator === 'LESS_OR_EQUAL') {
      return Number(actualValue) <= Number(cond.value)
    }

    return false
  })
}

function evalActivation(rule: CombatRule, selfCtx: RuleContext, opponentCtxs: RuleContext[]): boolean {
  const act = rule.activation
  if (!act) return true

  if (act.all && act.all.length > 0) {
    const allPass = act.all.every((cond) => evalSingleCondition(cond, selfCtx, opponentCtxs))
    if (!allPass) return false
  }

  if (act.any && act.any.length > 0) {
    const anyPass = act.any.some((cond) => evalSingleCondition(cond, selfCtx, opponentCtxs))
    if (!anyPass) return false
  }

  if (act.none && act.none.length > 0) {
    const anyInNonePass = act.none.some((cond) => evalSingleCondition(cond, selfCtx, opponentCtxs))
    if (anyInNonePass) return false
  }

  if (act.anyFailure && act.anyFailure.length > 0) {
    const failurePass = act.anyFailure.some((cond) => evalSingleCondition(cond, selfCtx, opponentCtxs))
    if (!failurePass) return false
  }

  return true
}

function applyEffect(
  effect: RuleEffect,
  rule: CombatRule,
  selfCtx: RuleContext,
  opponentCtxs: RuleContext[]
): void {
  const targetCtxs = effect.side === 'SELF' ? [selfCtx] : opponentCtxs
  if (effect.value === null) return

  for (const ctx of targetCtxs) {
    const targets: StatKey[] = []
    if (effect.stat === 'allStats' || effect.slot === 'ALL') {
      targets.push(...activeStats)
    } else if (effect.stat === 'ninjutsu') {
      targets.push('ninjutsuAttack', 'ninjutsuDefense')
    } else if (effect.stat in ctx.finalStats) {
      targets.push(effect.stat as StatKey)
    }

    for (const target of targets) {
      const before = ctx.finalStats[target]
      let after = before

      if (effect.operation === 'PERCENT_ADD') {
        const percent = effect.value / 100
        after = Math.max(0, before * (1 + percent))
        ctx.finalStats[target] = after
        ctx.appliedRules.push({
          ruleId: rule.id,
          label: rule.name,
          target,
          operation: 'percentage',
          value: percent,
          before,
          after,
        })
      } else if (effect.operation === 'POINT_ADD') {
        after = Math.max(0, before + effect.value)
        ctx.finalStats[target] = after
        ctx.appliedRules.push({
          ruleId: rule.id,
          label: rule.name,
          target,
          operation: 'points',
          value: effect.value,
          before,
          after,
        })
      } else if (effect.operation === 'SET_FINAL') {
        after = Math.max(0, effect.value)
        ctx.finalStats[target] = after
        ctx.appliedRules.push({
          ruleId: rule.id,
          label: rule.name,
          target,
          operation: 'set',
          value: effect.value,
          before,
          after,
        })
      } else if (effect.operation === 'DISABLE_POWER') {
        ctx.validationErrors.push({
          ruleId: rule.id,
          message: `${rule.name} invalide.`,
        })
      }
    }
  }
}

export function applyRules(context: RuleContext, opponents?: RuleContext | RuleContext[]): void {
  const opponentList = Array.isArray(opponents) ? opponents : opponents ? [opponents] : []

  // Step 1: Update permissions from Clan card
  const clanCard = context.cards.clan
  if (clanCard) {
    const clansLower = (clanCard.clans ?? []).map((c) => c.toLowerCase())
    if (clansLower.includes('uzumaki')) context.permissions.uzumaki = true
    if (clansLower.includes('otsutsuki')) {
      context.permissions.sharingan = true
      context.permissions.rinnegan = true
      context.permissions.otsutsuki = true
    }
    if (clansLower.includes('uchiwa')) {
      context.permissions.sharingan = true
    }
  }
  if (context.permissions.sharingan && context.permissions.uzumaki) {
    context.permissions.rinnegan = true
  }
  context.finalStats.clan = 0

  // Step 2: Evaluate rules from classic.json
  const enabledRules = combatRules.filter((r) => r.enabled !== false)

  const phases = ['VALIDATION_PENALTY', 'MODIFIER']

  for (const phase of phases) {
    const phaseRules = enabledRules.filter((r) => r.phase === phase).sort((a, b) => b.priority - a.priority)

    const triggeredRules: CombatRule[] = []

    for (const rule of phaseRules) {
      if (evalActivation(rule, context, opponentList)) {
        triggeredRules.push(rule)
      }
    }

    // Handle stacking group filtering for MAX_IN_GROUP
    const finalRulesToApply: CombatRule[] = []
    const groupBestRuleMap = new Map<string, CombatRule>()

    for (const rule of triggeredRules) {
      if (rule.stacking && rule.stacking.mode === 'MAX_IN_GROUP') {
        const group = rule.stacking.group
        const currentBest = groupBestRuleMap.get(group)
        if (!currentBest || rule.priority > currentBest.priority) {
          groupBestRuleMap.set(group, rule)
        }
      } else {
        finalRulesToApply.push(rule)
      }
    }

    for (const bestRule of groupBestRuleMap.values()) {
      finalRulesToApply.push(bestRule)
    }

    // Sort final rules to apply by priority descending
    finalRulesToApply.sort((a, b) => b.priority - a.priority)

    for (const rule of finalRulesToApply) {
      for (const effect of rule.effects) {
        applyEffect(effect, rule, context, opponentList)
      }
    }
  }
}
