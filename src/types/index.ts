// Domain models — persisted as JSON nel repo GitHub

export type ThemeName = "parchment" | "tavern" | "forest" | "ice";
export type ThemeMode = "light" | "dark";

export interface User {
  id: string;
  username: string;
  displayName: string;
  /** SHA-256 hash del PIN (lato client, solo per POC) */
  pinHash: string;
  avatar?: string;
  createdAt: string;
  /** XP cumulativo raccolto su tutti gli obiettivi */
  totalXp: number;
  /** Titolo medievale derivato dal livello */
  title?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  /** Nome icona Lucide o preset */
  icon: GroupIcon;
  isPublic: boolean;
  /** Hash del PIN (solo se privato) */
  pinHash?: string;
  ownerId: string;
  createdAt: string;
}

export type GroupIcon =
  | "castle"
  | "swords"
  | "crown"
  | "scroll"
  | "shield"
  | "gem"
  | "flame"
  | "anchor";

export interface Membership {
  userId: string;
  groupId: string;
  joinedAt: string;
}

/** Un obiettivo finale è sempre su scala 0-100 */
export interface Goal {
  id: string;
  groupId: string;
  title: string;
  description: string;
  icon: GoalIcon;
  milestones: Milestone[];
  /** Premio per il raggiungimento di 100 punti */
  finalReward: Reward;
  /** Suggerimenti di azioni ricorrenti con punti */
  actionPresets: ActionPreset[];
  creatorId: string;
  createdAt: string;
  /** Deadline opzionale in ISO */
  deadline?: string;
}

export type GoalIcon =
  | "trophy"
  | "target"
  | "mountain"
  | "scroll"
  | "crown"
  | "book"
  | "dumbbell"
  | "sparkles";

export interface Milestone {
  id: string;
  /** Soglia in punti (1-99) */
  points: number;
  title: string;
  reward: Reward;
}

export interface Reward {
  title: string;
  description: string;
  icon: RewardIcon;
}

export type RewardIcon =
  | "chest"
  | "sword"
  | "shield"
  | "potion"
  | "gem"
  | "crown"
  | "scroll"
  | "medal"
  | "key"
  | "map";

export interface ActionPreset {
  id: string;
  label: string;
  points: number;
}

/** Una voce di log: un utente dichiara cosa ha fatto per avanzare */
export interface ProgressEntry {
  id: string;
  goalId: string;
  userId: string;
  action: string;
  points: number;
  /** Punti totali dell'utente DOPO questa azione (capped a 100) */
  totalAfter: number;
  createdAt: string;
}

/** Vista aggregata usata dal client per leaderboard e progress bar */
export interface GoalParticipantSummary {
  userId: string;
  username: string;
  displayName: string;
  points: number; // 0-100
  lastActivityAt?: string;
  unlockedMilestones: string[];
  finalUnlocked: boolean;
}

export interface RegistrationRequest {
  username: string;
  displayName: string;
  email: string;
  reason: string;
  desiredPin: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  issuedAt: string;
}
