import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const syncRequestRef = useRef(0);

  const clearLocalSession = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setProfile(null);
  };

  const sessionIsExpiredLocally = (nextSession) => {
    const expiresAt = nextSession?.expires_at;
    if (!expiresAt) {
      return false;
    }

    return expiresAt * 1000 <= Date.now();
  };

  const loadProfile = async (userId) => {
    if (!userId) {
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  };

  const syncSession = async (nextSession) => {
    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;

    setSession(nextSession ?? null);

    const user = nextSession?.user ?? null;
    if (!user || user.is_anonymous) {
      setProfile(null);
      return null;
    }

    const nextProfile = await loadProfile(user.id);
    if (syncRequestRef.current !== requestId) {
      return null;
    }

    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        await syncSession(currentSession ?? null);
      } catch (error) {
        console.error("Erro ao iniciar autenticação:", error);
        if (mounted) {
          await clearLocalSession();
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(async () => {
        if (!mounted) {
          return;
        }

        try {
          await syncSession(nextSession);
        } catch (error) {
          console.error("Erro no onAuthStateChange:", error);
          if (mounted) {
            await clearLocalSession();
          }
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInAdmin = async (email, password) => {
    setLoading(true);

    try {
      const response = await supabase.auth.signInWithPassword({ email, password });
      if (response.error) {
        return response;
      }

      if (sessionIsExpiredLocally(response.data.session)) {
        await clearLocalSession();
        return {
          ...response,
          error: new Error("O token foi recebido como expirado no relógio deste dispositivo. Verifique a data e a hora do sistema e tente novamente.")
        };
      }

      const nextProfile = await loadProfile(response.data.user?.id);
      if (nextProfile?.role !== "admin") {
        await clearLocalSession();
        return {
          ...response,
          error: new Error("Acesso permitido apenas para administradores.")
        };
      }

      setSession(response.data.session ?? null);
      setProfile(nextProfile);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);

    try {
      const response = await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setProfile(null);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAnonymous: !session?.user,
      isAdmin: Boolean(session?.user && profile?.role === "admin"),
      signInAdmin,
      signOut
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
