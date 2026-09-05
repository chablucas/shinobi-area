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
  kekkeiMora: number
}

export type CombatComposition = { slots: Record<string, string> }
export type CombatPermissions = { sharingan: boolean; rinnegan: boolean; byakugan: boolean; tenseigan: boolean; otsutsuki: boolean; uzumaki: boolean }
export type AppliedRule = { ruleId: string; label: string; target: string; operation: 'percentage' | 'points' | 'set'; value: number; before: number; after: number }
export type CombatPlayerResult = { baseStats: CombatStats; finalStats: CombatStats; total: number; appliedRules: AppliedRule[]; permissions: CombatPermissions; validationErrors: Array<{ ruleId: string; message: string }> }
export type CombatParticipant = { card: string; value: number }
export type CombatCategoryResult = { category: string; player1: CombatParticipant; player2: CombatParticipant; player3?: CombatParticipant; winner: 'player1' | 'player2' | 'player3' | 'draw' }
export type CombatResult = {
  resolutionMode: 'manual' | 'simulation'
  winner: 'player1' | 'player2' | 'player3' | 'draw'
  player1: CombatPlayerResult
  player2: CombatPlayerResult
  player3?: CombatPlayerResult
  player1Total: number
  player2Total: number
  player3Total?: number
  scores: { player1: number; player2: number; player3?: number }
  categories: CombatCategoryResult[]
}