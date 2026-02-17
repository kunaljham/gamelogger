import { UserProvider } from "@/contexts/user-context";
import Nav from "./nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
        <Nav />
        {children}
      </div>
    </UserProvider>
  );
}
