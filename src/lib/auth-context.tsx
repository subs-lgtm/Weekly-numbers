"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
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
  signInWithMicrosoft: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const ADMIN_EMAILS = ['nirupam@lyzr.ai', 'ani@lyzr.ai', 'vaibhav@lyzr.ai', 'pranamya@lyzr.ai'];
const ALLOWED_DOMAINS = ['lyzr.ai'];
// The org's Microsoft/Entra tenant uses a different domain (lyzr.com) than
// its Google Workspace (lyzr.ai) — confirmed live in open-controller-agent
// (9 Oct 2026) after a real sign-in was rejected for exactly this reason.
const MS_ALLOWED_DOMAINS = ['lyzr.com'];

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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Mint the wnd_session cookie the global API proxy gate checks
      // (src/proxy.ts) BEFORE exposing `user` via setUser below — every
      // dashboard component watches `user`/`loading` and fires its own
      // /api/* fetches the instant it goes non-null, so setUser running
      // first would race the cookie and 401 (the exact bug this ordering
      // fixes, first found and fixed the same way in the sibling Skott repo).
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
        } catch {
          // Non-critical for the client's own state, but subsequent API
          // calls will 401 until this succeeds — logged server-side only.
        }
      } else {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }

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

  const signInWithMicrosoft = async (): Promise<{ error: string | null }> => {
    try {
      const auth = getFirebaseAuth();
      const provider = new OAuthProvider('microsoft.com');
      // Scopes "openid profile email" are implicit for the microsoft.com
      // OAuth provider; a tenant hint keeps consumer Microsoft accounts
      // out of the picker, same role as Google's `hd` param above.
      provider.setCustomParameters({ tenant: 'organizations' });
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || '';
      const domain = email.split('@')[1]?.toLowerCase();
      if (MS_ALLOWED_DOMAINS.length && !MS_ALLOWED_DOMAINS.includes(domain)) {
        await firebaseSignOut(auth);
        return { error: `Only ${MS_ALLOWED_DOMAINS.join(', ')} emails are allowed.` };
      }
      return { error: null };
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return { error: null };
      return { error: e.message || "Microsoft sign in failed" };
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
    <Ctx.Provider value={{ user, loading, isAdmin, signIn, signInWithGoogle, signInWithMicrosoft, signUp, signOut: signOutFn }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
