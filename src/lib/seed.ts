/**
 * Seed bundlato: usato come fallback quando il repo remoto non è ancora
 * disponibile (prima pubblicazione) o se raw.githubusercontent ritorna 404.
 *
 * Vite include i JSON come moduli statici. Tenerli qui evita che la build
 * dell'app "rompa" se il repo non è ancora pubblicato.
 */

import type { Goal, Group, Membership, ProgressEntry, User } from "@/types";
import usersSeed from "../../data/users.json";
import groupsSeed from "../../data/groups.json";
import goalsSeed from "../../data/goals.json";
import membershipsSeed from "../../data/memberships.json";
import progressSeed from "../../data/progress.json";

export const SEED = {
  "users.json": usersSeed as unknown as User[],
  "groups.json": groupsSeed as unknown as Group[],
  "goals.json": goalsSeed as unknown as Goal[],
  "memberships.json": membershipsSeed as unknown as Membership[],
  "progress.json": progressSeed as unknown as ProgressEntry[],
} as const;

export type SeedPath = keyof typeof SEED;
