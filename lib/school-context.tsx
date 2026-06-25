"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getSchoolBySlug } from "@/lib/db";
import { resolveTenantSlugFromHost } from "@/lib/tenant";
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

  useEffect(() => {
    const resolvedSlug = initialSlug || resolveTenantSlugFromHost(window.location.host);

    if (initialSchool && initialSchool.slug === resolvedSlug) {
      if (initialSchool.primaryColor) {
        document.documentElement.style.setProperty("--brand", initialSchool.primaryColor);
      }
      return;
    }

    void Promise.resolve()
      .then(async () => {
        setSlug(resolvedSlug);
        const s = await getSchoolBySlug(resolvedSlug);
        setSchool(s);
        // Apply school brand colour as CSS custom property
        if (s?.primaryColor) {
          document.documentElement.style.setProperty("--brand", s.primaryColor);
        }
      })
      .finally(() => setLoading(false));
  }, [initialSchool, initialSlug]);

  return (
    <SchoolContext.Provider value={{ school, loading, slug }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
