"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getSchoolBySlug, getSchool } from "@/lib/db";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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
        let s = await getSchoolBySlug(resolvedSlug);

        // Fallback: no school found by slug (e.g. superadmin impersonating on root domain)
        // Load school from the authenticated user's schoolId instead
        if (!s) {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const userSnap = await getDoc(doc(db, "users", uid));
            const schoolId = userSnap.data()?.schoolId as string | undefined;
            if (schoolId) s = await getSchool(schoolId);
          }
        }

        setSchool(s);
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
