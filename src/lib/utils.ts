import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "or ora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} giorni fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Titoli derivati dall'XP totale — servono solo per il flavour.
 * Soglie arbitrarie, da rivedere con la telemetria reale.
 */
export function titleForXp(xp: number): string {
  if (xp < 50) return "Novizio";
  if (xp < 150) return "Scudiero";
  if (xp < 350) return "Cavaliere";
  if (xp < 700) return "Paladino";
  if (xp < 1200) return "Campione";
  if (xp < 2000) return "Eroe del Regno";
  return "Leggenda";
}

export function levelForXp(xp: number): number {
  // Livello cresce con sqrt(xp/25) arrotondato in giù +1
  return Math.max(1, Math.floor(Math.sqrt(xp / 25)) + 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
