"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LandingPage } from "@/app/components/landing/LandingPage";

export default function RootPage() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !appUser) return;
    const routes: Record<string, string> = {
      parent: "/parent",
      teacher: "/teacher",
      owner: "/owner",
      superadmin: "/admin",
    };
    router.replace(routes[appUser.role] ?? "/login");
  }, [appUser, authLoading, router]);

  return <LandingPage />;
}
