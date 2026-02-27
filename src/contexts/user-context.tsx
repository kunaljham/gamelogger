"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types/user";

interface UserContextValue {
  user: User | null;
  loading: boolean;
  isDemoUser: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (res.status === 401) {
            // Session cookie exists but the backend session is expired/invalid.
            // Call logout to clear the HttpOnly cookie via Set-Cookie header
            // (document.cookie can't touch HttpOnly cookies), then redirect.
            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`,
              { method: "POST", credentials: "include" }
            ).catch(() => {});
            setLoading(false);
            router.replace("/login");
            return;
          }
          setLoading(false);
          return;
        }
        const data: User = await res.json();

        // If the user hasn't set their name yet, redirect to onboarding.
        // Keep loading=true so pages show skeletons until navigation completes.
        if (!data.name) {
          router.replace("/complete-profile");
          return;
        }

        setUser(data);
      } catch {
        // If the fetch fails, user stays null — pages can handle that
      }
      setLoading(false);
    };
    fetchUser();
  }, [router]);

  const signOut = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Even if the API call fails, still redirect
    }
    router.push("/");
  };

  return (
    <UserContext.Provider value={{ user, loading, isDemoUser: user?.email === "demo@gamelogger.app", signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
