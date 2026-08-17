"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const ADMIN_EMAILS = ['nirupam@lyzr.ai', 'ani@lyzr.ai', 'vaibhav@lyzr.ai', 'pranamya@lyzr.ai'];
const ALLOWED_DOMAINS = ['lyzr.ai'];

function mapUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      const mapped = mapUser(firebaseUser);
      setUser(mapped);
      setIsAdmin(!!mapped?.email && ADMIN_EMAILS.includes(mapped.email));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (e: any) {
      return { error: e.message || "Sign in failed" };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'lyzr.ai' });
      const result = await signInWithPopup(auth, provider);
      // Check domain
      const email = result.user.email || '';
      const domain = email.split('@')[1]?.toLowerCase();
      if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(domain)) {
        await firebaseSignOut(auth);
        return { error: `Only ${ALLOWED_DOMAINS.join(', ')} emails are allowed.` };
      }
      return { error: null };
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return { error: null };
      return { error: e.message || "Google sign in failed" };
    }
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<{ error: string | null }> => {
    try {
      const domain = email.split('@')[1]?.toLowerCase();
      if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(domain)) {
        return { error: `Only ${ALLOWED_DOMAINS.join(', ')} emails are allowed.` };
      }
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      return { error: null };
    } catch (e: any) {
      return { error: e.message || "Sign up failed" };
    }
  };

  const signOutFn = async () => {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, loading, isAdmin, signIn, signInWithGoogle, signUp, signOut: signOutFn }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
