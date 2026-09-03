export type CombatStats = {
  chakra: number
  invocation: number
  iq: number
  ninjutsuAttack: number
  ninjutsuDefense: number
  genjutsu: number
  taijutsu: number
  avatar: number
  body: number
  fuinjutsu: number
  senjutsu: number
  kenjutsu: number
  clan: number
  speed: number
  kekkeiGenkai: number
  sensory: number
}

export type CombatComposition = { slots: Record<string, string> }
export type CombatPermissions = { sharingan: boolean; rinnegan: boolean; byakugan: boolean; tenseigan: boolean; otsutsuki: boolean; uzumaki: boolean }
export type AppliedRule = { ruleId: string; label: string; target: string; operation: 'percentage' | 'points' | 'set'; value: number; before: number; after: number }
export type CombatPlayerResult = { baseStats: CombatStats; finalStats: CombatStats; total: number; appliedRules: AppliedRule[]; permissions: CombatPermissions; validationErrors: Array<{ ruleId: string; message: string }> }
export type CombatResult = { winner: 'player1' | 'player2' | 'draw'; player1: CombatPlayerResult; player2: CombatPlayerResult; player1Total: number; player2Total: number }