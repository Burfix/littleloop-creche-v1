"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getSchoolBySlug, getSchool } from "@/lib/db";
import { resolveTenantSlugFromHost } from "@/lib/tenant";
import { useAuth } from "@/lib/auth-context";
import type { School } from "@/lib/types";

interface SchoolContextValue {
  school: School | null;
  loading: boolean;
  slug: string;
}

const SchoolContext = createContext<SchoolContextValue>({
  school: null,
  loading: true,
  slug: "",
});

export function SchoolProvider({
  children,
  initialSlug = "",
  initialSchool = null,
}: {
  children: React.ReactNode;
  initialSlug?: string;
  initialSchool?: School | null;
}) {
  const [school, setSchool] = useState<School | null>(initialSchool);
  const [loading, setLoading] = useState(!initialSchool);
  const [slug, setSlug] = useState(initialSlug);
  const { appUser, loading: authLoading } = useAuth();

  useEffect(() => {
    const resolvedSlug = initialSlug || resolveTenantSlugFromHost(window.location.host);

    if (initialSchool && initialSchool.slug === resolvedSlug) {
      if (initialSchool.primaryColor) {
        document.documentElement.style.setProperty("--brand", initialSchool.primaryColor);
      }
      setLoading(false);
      return;
    }

    // Wait until auth context has resolved before attempting school lookup
    if (authLoading) return;

    void (async () => {
      try {
        setSlug(resolvedSlug);
        let s = await getSchoolBySlug(resolvedSlug);

        // Fallback: root domain / no subdomain (e.g. Vercel preview URL or
        // superadmin impersonating). Load school from authenticated user profile.
        if (!s && appUser?.schoolId) {
          s = await getSchool(appUser.schoolId);
        }

        setSchool(s);
        if (s?.primaryColor) {
          document.documentElement.style.setProperty("--brand", s.primaryColor);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [initialSchool, initialSlug, appUser, authLoading]);

  return (
    <SchoolContext.Provider value={{ school, loading, slug }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
