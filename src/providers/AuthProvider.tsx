import React, { useState, createContext, useContext, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { supabase } from '~/src/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type Auth = {
  isAuthenticated: boolean;
  session: Session | null;
  user?: User;
  setSession: (session: Session | null) => void;
};

const AuthContext = createContext<Auth>({
  isAuthenticated: false,
  session: null,
  setSession: () => {},
});

export default function AuthProvider({ children }: any) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionState(session);
      setIsReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionState(session);
    });

    return () => {
      if (listener && typeof listener.subscription?.unsubscribe === "function") {
        listener.subscription.unsubscribe();
      }
    };
  }, []);

  if (!isReady) {
    return <ActivityIndicator />;
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user, isAuthenticated: !!session?.user, setSession: setSessionState }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
