"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUser } from "@/lib/db";
import type { AppUser } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setError(null);

      if (user) {
        try {
          const profile = await getUser(user.uid);
          if (!profile) {
            // Firebase Auth user exists but no Firestore document — sign them out
            console.error("Auth user has no Firestore profile:", user.uid);
            await firebaseSignOut(auth);
            setAppUser(null);
            setError("Account setup incomplete. Please contact your school administrator.");
          } else {
            setAppUser(profile);
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setAppUser(null);
          setError("Could not load your account. Please check your connection and try again.");
        }
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAppUser(null);
    setError(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, error, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
