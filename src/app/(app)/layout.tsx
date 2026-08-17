"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/lib/auth-context";
import { WeekProvider } from "@/lib/week-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = pathname || "/";
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <WeekProvider>
      <SidebarProvider>
        <div className="flex min-h-svh w-full">
          <AppSidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </SidebarProvider>
    </WeekProvider>
  );
}
