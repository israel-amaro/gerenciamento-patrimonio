import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const ensurePublicSession = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.session ?? null;
  };

  const loadProfile = async (user) => {
    if (!user || user.is_anonymous) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    setProfile(data ?? null);
    return data ?? null;
  };

  const syncSession = async (incomingSession) => {
    let nextSession = incomingSession;

    if (!nextSession) {
      nextSession = await ensurePublicSession();
    }

    setSession(nextSession);

    const currentUser = nextSession?.user ?? null;

    if (!currentUser) {
      setProfile(null);
      return;
    }

    if (currentUser.is_anonymous) {
      setProfile(null);
      return;
    }

    const nextProfile = await loadProfile(currentUser);

    if (nextProfile?.role !== "admin") {
      await supabase.auth.signOut({ scope: "local" });
      const publicSession = await ensurePublicSession();
      setSession(publicSession);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        if (!mounted) return;

        await syncSession(currentSession);
      } catch (error) {
        console.error("Erro ao iniciar autenticação:", error);
        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      try {
        setLoading(true);
        await syncSession(nextSession);
      } catch (error) {
        console.error("Erro no onAuthStateChange:", error);
        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInAdmin = async (email, password) => {
    setLoading(true);

    const response = await supabase.auth.signInWithPassword({ email, password });

    if (response.error) {
      setLoading(false);
      return response;
    }

    return response;
  };

  const signOut = async () => {
    setLoading(true);
    return supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAnonymous: Boolean(session?.user?.is_anonymous),
      isAdmin: Boolean(
        session?.user &&
          !session.user.is_anonymous &&
          profile?.role === "admin"
      ),
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