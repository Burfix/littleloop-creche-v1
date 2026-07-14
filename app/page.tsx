"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSchool } from "@/lib/db";
import { getSchoolLaunchStatus } from "@/lib/school-launch";
import { LandingPage } from "@/app/components/landing/LandingPage";

export default function RootPage() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !appUser) return;

    if (appUser.role === "owner") {
      // Owners land on the Welcome screen exactly once. Once they've seen
      // it (tracked via hasSeenOnboardingWelcome, set by the onboarding
      // screen itself), every subsequent login goes straight to /owner —
      // the checklist there already covers "still mid-setup," so Welcome
      // isn't needed again.
      if (appUser.hasSeenOnboardingWelcome || !appUser.schoolId) {
        router.replace("/owner");
        return;
      }

      let cancelled = false;
      (async () => {
        const school = await getSchool(appUser.schoolId!);
        const status = await getSchoolLaunchStatus(appUser.schoolId!, school, appUser);
        if (cancelled) return;
        // Schools that were already fully set up before this flow existed
        // skip Welcome entirely — an owner who finished setup months ago
        // shouldn't see a "let's get started" greeting.
        router.replace(status.isComplete ? "/owner" : "/onboarding");
      })();
      return () => { cancelled = true; };
    }

    const routes: Record<string, string> = {
      parent: "/parent",
      teacher: "/teacher",
      superadmin: "/admin",
    };
    router.replace(routes[appUser.role] ?? "/login");
  }, [appUser, authLoading, router]);

  return <LandingPage />;
}
