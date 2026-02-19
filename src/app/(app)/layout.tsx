import { UserProvider } from "@/contexts/user-context";
import Nav from "./nav";
import DemoBanner from "./demo-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
        <DemoBanner />
        <Nav />
        {children}
      </div>
    </UserProvider>
  );
}
