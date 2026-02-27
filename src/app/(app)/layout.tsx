import { Suspense } from "react";
import { UserProvider } from "@/contexts/user-context";
import Nav from "./nav";
import DemoBanner from "./demo-banner";
import PasskeyPrompt from "./passkey-prompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
        <DemoBanner />
        {/* No fallback needed: prompt is optional and renders after hydration */}
        <Suspense>
          <PasskeyPrompt />
        </Suspense>
        <Nav />
        {children}
      </div>
    </UserProvider>
  );
}
