import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
const ADMIN_EMAIL = "admin@findes.com";

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

    const nextProfile =
      data ??
      (user.email === ADMIN_EMAIL
        ? {
            id: user.id,
            email: user.email,
            full_name: "Admin Findes",
            role: "admin"
          }
        : null);

    setProfile(nextProfile);
    return nextProfile;
  };

  const syncSession = async (incomingSession) => {
    setSession(incomingSession);

    const currentUser = incomingSession?.user ?? null;

    if (!currentUser) {
      setProfile(null);
      return;
    }

    if (currentUser.is_anonymous) {
      setProfile(null);
      return;
    }

    const nextProfile = await loadProfile(currentUser);
    return nextProfile;
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

    try {
      const response = await supabase.auth.signInWithPassword({ email, password });

      if (response.error) {
        return response;
      }

      const nextProfile =
        (await loadProfile(response.data.user)) ??
        (response.data.user?.email === ADMIN_EMAIL
          ? {
              id: response.data.user.id,
              email: response.data.user.email,
              full_name: "Admin Findes",
              role: "admin"
            }
          : null);

      if (nextProfile?.role !== "admin") {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
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
      const response = await supabase.auth.signOut();
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
      isAdmin: Boolean(
        session?.user &&
          (profile?.role === "admin" || session.user.email === ADMIN_EMAIL)
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
