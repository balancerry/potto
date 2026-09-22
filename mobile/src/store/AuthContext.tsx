import {
  clearPendingSignup,
  readPendingSignup,
} from "@/lib/auth/pending-signup";
import {
  friendlyAuthError,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/auth/validation";
import { MOBILE_AUTH_CALLBACK, supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Profile = {
  id: string;
  name: string;
  email: string | null;
};

type Ok = { ok: true };
type Fail = { ok: false; error: string };
type Result = Ok | Fail;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<Result>;
  startSignup: (input: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<Result>;
  signInWithMagicLink: (email: string) => Promise<Result>;
  requestPasswordReset: (email: string) => Promise<Result>;
  establishPassword: (input: {
    password: string;
    confirmPassword: string;
    name?: string;
  }) => Promise<Result>;
  updatePassword: (input: {
    password: string;
    confirmPassword: string;
  }) => Promise<Result>;
  completePendingSignupIfNeeded: () => Promise<"done" | "need_password">;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email };
}

function parseAuthUrl(url: string): {
  code?: string;
  access_token?: string;
  refresh_token?: string;
} {
  try {
    const parsed = Linking.parse(url);
    const q = (parsed.queryParams ?? {}) as Record<string, string | undefined>;
    const hash = url.includes("#") ? url.split("#")[1]! : "";
    const hashParams = new URLSearchParams(hash);
    return {
      code: q.code ?? hashParams.get("code") ?? undefined,
      access_token:
        q.access_token ?? hashParams.get("access_token") ?? undefined,
      refresh_token:
        q.refresh_token ?? hashParams.get("refresh_token") ?? undefined,
    };
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const p = await fetchProfile(user.id);
      setProfile(
        p ?? {
          id: user.id,
          name:
            (user.user_metadata?.name as string | undefined) ??
            user.email?.split("@")[0] ??
            "User",
          email: user.email ?? null,
        },
      );
    } catch {
      setProfile({
        id: user.id,
        name: (user.user_metadata?.name as string | undefined) ?? "User",
        email: user.email ?? null,
      });
    }
  }, []);

  const handleAuthUrl = useCallback(
    async (url: string) => {
      const { code, access_token, refresh_token } = parseAuthUrl(url);
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
      } else {
        return;
      }
      await refreshProfile();
    },
    [refreshProfile],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          try {
            await refreshProfile();
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }

      try {
        const initial = await Linking.getInitialURL();
        if (
          initial &&
          (initial.includes("auth/callback") || initial.includes("code="))
        ) {
          await handleAuthUrl(initial);
        }
      } catch {
        console.log("Failed to handle initial auth URL");
        /* surfaced on auth screens */
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession?.user) {
          void refreshProfile();
        } else {
          setProfile(null);
        }
      },
    );

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("auth/callback") || url.includes("code=")) {
        void handleAuthUrl(url).catch(() => undefined);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, [handleAuthUrl, refreshProfile]);

  const establishPassword = useCallback(
    async (input: {
      password: string;
      confirmPassword: string;
      name?: string;
    }): Promise<Result> => {
      const pErr = validatePassword(input.password);
      if (pErr) return { ok: false, error: pErr };
      const cErr = validatePasswordConfirm(
        input.password,
        input.confirmPassword,
      );
      if (cErr) return { ok: false, error: cErr };

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return {
          ok: false,
          error:
            "Please open the verification link again, then set your password.",
        };

      const displayName =
        input.name?.trim() ||
        (typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name.trim()
          : "") ||
        null;

      const { error: authErr } = await supabase.auth.updateUser({
        password: input.password,
        data: displayName ? { name: displayName } : undefined,
      });
      if (authErr) return { ok: false, error: friendlyAuthError(authErr) };

      if (displayName) {
        const { error: profileErr } = await supabase
          .from("users")
          .update({ name: displayName, email: user.email ?? null })
          .eq("id", user.id);
        if (profileErr)
          return { ok: false, error: friendlyAuthError(profileErr) };
      }

      await clearPendingSignup();
      await refreshProfile();
      return { ok: true };
    },
    [refreshProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      establishPassword,

      async signInWithPassword(email, password) {
        const eErr = validateEmail(email);
        if (eErr) return { ok: false, error: eErr };
        if (!password) return { ok: false, error: "Enter your password" };
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        if (error) return { ok: false, error: friendlyAuthError(error) };
        await refreshProfile();
        return { ok: true };
      },

      async startSignup({ name, email, password, confirmPassword }) {
        const nErr = validateDisplayName(name);
        if (nErr) return { ok: false, error: nErr };
        const eErr = validateEmail(email);
        if (eErr) return { ok: false, error: eErr };
        const pErr = validatePassword(password);
        if (pErr) return { ok: false, error: pErr };
        const cErr = validatePasswordConfirm(password, confirmPassword);
        if (cErr) return { ok: false, error: cErr };

        const normalized = normalizeEmail(email);
        const trimmedName = name.trim();
        const { data: registered, error: checkErr } = await supabase.rpc(
          "email_registered",
          {
            p_email: normalized,
          },
        );
        if (checkErr) return { ok: false, error: friendlyAuthError(checkErr) };
        if (registered) {
          return {
            ok: false,
            error:
              "An account with this email already exists. Sign in instead.",
          };
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalized,
          password,
          options: { data: { name: trimmedName } },
        });
        if (error) return { ok: false, error: friendlyAuthError(error) };

        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: normalized,
            password,
          });
          if (signInErr)
            return { ok: false, error: friendlyAuthError(signInErr) };
        }

        clearPendingSignup();
        await refreshProfile();
        return { ok: true };
      },

      async signInWithMagicLink(email) {
        const eErr = validateEmail(email);
        if (eErr) return { ok: false, error: eErr };
        const redirectTo = `${MOBILE_AUTH_CALLBACK}?next=${encodeURIComponent("/auth/set-password")}`;
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizeEmail(email),
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        if (error) return { ok: false, error: friendlyAuthError(error) };
        return { ok: true };
      },

      async requestPasswordReset(email) {
        const eErr = validateEmail(email);
        if (eErr) return { ok: false, error: eErr };
        const redirectTo = `${MOBILE_AUTH_CALLBACK}?next=${encodeURIComponent("/auth/reset-password")}`;
        const { error } = await supabase.auth.resetPasswordForEmail(
          normalizeEmail(email),
          { redirectTo },
        );
        if (error) return { ok: false, error: friendlyAuthError(error) };
        return { ok: true };
      },

      async updatePassword({ password, confirmPassword }) {
        const pErr = validatePassword(password);
        if (pErr) return { ok: false, error: pErr };
        const cErr = validatePasswordConfirm(password, confirmPassword);
        if (cErr) return { ok: false, error: cErr };
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { ok: false, error: friendlyAuthError(error) };
        return { ok: true };
      },

      async completePendingSignupIfNeeded() {
        const pending = await readPendingSignup();
        if (!pending) return "need_password";
        const result = await establishPassword({
          password: pending.password,
          confirmPassword: pending.password,
          name: pending.name,
        });
        return result.ok ? "done" : "need_password";
      },

      async signOut() {
        await clearPendingSignup();
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
      },
    }),
    [session, profile, loading, refreshProfile, establishPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
