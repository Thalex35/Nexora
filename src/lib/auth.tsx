import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { isAuthorizedUserId } from "@/lib/single-user";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authorized: boolean;
  accessDenied: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  authorized: false,
  accessDenied: false,
  signOut: async () => {},
});

function isAuthorized(user: User | null): user is User {
  return !!user && isAuthorizedUserId(user.id);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    function applySession(nextSession: Session | null) {
      if (nextSession && !isAuthorized(nextSession.user)) {
        setSession(null);
        setAccessDenied(true);
        window.setTimeout(() => {
          void supabase.auth.signOut().then(({ error }) => {
            if (error) console.error("[Auth] Unable to clear an unauthorized session:", error);
          });
        }, 0);
      } else {
        setSession(nextSession);
        if (nextSession) setAccessDenied(false);
      }
      setLoading(false);
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session: current }, error }) => {
        if (error) {
          console.error("[Auth] Unable to load the current session:", error);
          applySession(null);
          return;
        }
        applySession(current);
      })
      .catch((error: unknown) => {
        console.error("[Auth] Unable to load the current session:", error);
        applySession(null);
      });

    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        authorized: !!session && isAuthorized(session.user),
        accessDenied,
        signOut: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          setAccessDenied(false);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
