import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, User } from "@/types";
import { findUserByUsername } from "@/lib/db";
import { sha256 } from "@/lib/utils";

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      loading: false,
      error: null,
      async login(username, pin) {
        set({ loading: true, error: null });
        try {
          const user = await findUserByUsername(username.trim());
          if (!user) {
            set({ loading: false, error: "Utente non trovato nel regno." });
            return false;
          }
          const hash = await sha256(pin);
          if (hash !== user.pinHash) {
            set({ loading: false, error: "PIN errato, cavaliere." });
            return false;
          }
          const session: AuthSession = {
            userId: user.id,
            username: user.username,
            issuedAt: new Date().toISOString(),
          };
          set({ session, user, loading: false, error: null });
          return true;
        } catch (err) {
          console.error(err);
          set({ loading: false, error: "Il corvo non è riuscito a consegnare il messaggio. Riprova." });
          return false;
        }
      },
      logout() {
        set({ session: null, user: null });
      },
      setUser(user) {
        set({ user });
      },
    }),
    {
      name: "goalquest:auth",
      partialize: (s) => ({ session: s.session, user: s.user }),
    }
  )
);
