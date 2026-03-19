"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase";

interface AuthContextValue {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signOut: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  readonly children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = useCallback(async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
