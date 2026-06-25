"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";

export default function RootPage() {
  const { appUser, loading: authLoading } = useAuth();
  const { loading: schoolLoading } = useSchool();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || schoolLoading) return;

    if (!appUser) {
      router.replace("/login");
      return;
    }

    switch (appUser.role) {
      case "parent":
        router.replace("/parent");
        break;
      case "teacher":
        router.replace("/teacher");
        break;
      case "owner":
        router.replace("/owner");
        break;
      case "superadmin":
        router.replace("/admin");
        break;
      default:
        router.replace("/login");
    }
  }, [appUser, authLoading, schoolLoading, router]);

  return (
    <div className="page-loader">
      <div className="spinner" />
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
    </div>
  );
}
