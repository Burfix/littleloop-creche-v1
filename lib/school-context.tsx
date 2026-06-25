"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getSchoolBySlug } from "@/lib/db";
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

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    // Resolve tenant from subdomain
    // e.g. pebblestones.littleloop.app → slug = "pebblestones"
    // On localhost or bare domain → use "demo" or env override
    const host = window.location.hostname;
    const parts = host.split(".");

    let resolvedSlug = process.env.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG || "demo";

    // If subdomain present and not "www"
    if (parts.length >= 3 && parts[0] !== "www") {
      resolvedSlug = parts[0];
    }

    setSlug(resolvedSlug);

    getSchoolBySlug(resolvedSlug)
      .then((s) => {
        setSchool(s);
        // Apply school brand colour as CSS custom property
        if (s?.primaryColor) {
          document.documentElement.style.setProperty("--brand", s.primaryColor);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SchoolContext.Provider value={{ school, loading, slug }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
