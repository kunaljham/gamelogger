import { UserProvider } from "@/contexts/user-context";
import Nav from "./nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
        <Nav />
        {children}
      </div>
    </UserProvider>
  );
}
