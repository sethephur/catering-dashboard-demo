import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  updateProfile,
  type UserCredential,
  type User,
} from "firebase/auth";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import { getAdminStatus } from "@/data/adminUsers";
import { auth } from "@/utils/firebaseConfig";

type AppUser = Pick<User, "uid" | "email" | "displayName" | "metadata">;

type AuthContextType = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<AppUser>;
  updateEmailAddress: (email: string, currentPassword: string) => Promise<AppUser>;
  updatePasswordValue: (
    newPassword: string,
    currentPassword: string,
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const DEMO_AUTH_STORAGE_KEY = "demo-auth-session-v1";

const toAppUser = (user: User): AppUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  metadata: user.metadata,
});

const buildDemoUser = (overrides?: Partial<AppUser>): AppUser => ({
  uid: overrides?.uid ?? "demo-admin-1",
  email: overrides?.email ?? "demo.admin@example.com",
  displayName: overrides?.displayName ?? "Demo Admin",
  metadata: {
    creationTime:
      overrides?.metadata?.creationTime ?? "2026-03-01T09:00:00-08:00",
    lastSignInTime:
      overrides?.metadata?.lastSignInTime ?? new Date().toISOString(),
  } as User["metadata"],
});

const readStoredDemoUser = (): AppUser | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppUser>;
    return buildDemoUser(parsed);
  } catch {
    return null;
  }
};

const persistDemoUser = (user: AppUser | null) => {
  if (typeof window === "undefined") return;

  if (!user) {
    window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(user));
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() =>
    DEMO_MODE_ENABLED ? readStoredDemoUser() : null,
  );
  const [isLoading, setIsLoading] = useState(!DEMO_MODE_ENABLED);
  const [isAdmin, setIsAdmin] = useState(DEMO_MODE_ENABLED ? true : false);
  const [isAdminLoading, setIsAdminLoading] = useState(!DEMO_MODE_ENABLED);

  const syncAdminState = async (nextUser: User | null) => {
    if (DEMO_MODE_ENABLED) {
      setIsAdmin(nextUser !== null);
      setIsAdminLoading(false);
      return;
    }

    if (!nextUser) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }

    setIsAdminLoading(true);

    try {
      const status = await getAdminStatus();
      setIsAdmin(status.isAdmin);
    } catch {
      const tokenResult = await nextUser.getIdTokenResult(true);
      setIsAdmin(tokenResult.claims.admin === true);
    } finally {
      setIsAdminLoading(false);
    }
  };

  const requireCurrentDemoUser = () => {
    if (!user) {
      throw new Error("You must be signed in to update your account.");
    }

    return user;
  };

  const requireCurrentFirebaseUser = () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must be signed in to update your account.");
    }

    return currentUser;
  };

  const refreshCurrentUser = async () => {
    if (DEMO_MODE_ENABLED) {
      const currentUser = requireCurrentDemoUser();
      const refreshedUser = buildDemoUser({
        ...currentUser,
        metadata: {
          ...currentUser.metadata,
          lastSignInTime: new Date().toISOString(),
        } as User["metadata"],
      });
      setUser(refreshedUser);
      persistDemoUser(refreshedUser);
      setIsAdmin(true);
      setIsAdminLoading(false);
      return refreshedUser;
    }

    const currentUser = requireCurrentFirebaseUser();
    await reload(currentUser);
    const refreshedUser = auth.currentUser;
    setUser(refreshedUser ? toAppUser(refreshedUser) : null);
    await refreshedUser?.getIdToken(true);
    await syncAdminState(refreshedUser);

    if (!refreshedUser) {
      throw new Error("Your session expired. Sign in again and retry.");
    }

    return refreshedUser;
  };

  const requireCurrentPassword = (currentPassword: string) => {
    if (!currentPassword.trim()) {
      throw new Error("Enter your current password first.");
    }
  };

  const reauthenticateFirebaseUser = async (currentPassword: string) => {
    requireCurrentPassword(currentPassword);
    const currentUser = requireCurrentFirebaseUser();
    const email = currentUser.email?.trim();

    if (!email) {
      throw new Error("This account does not have an email address.");
    }

    const credential = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    return currentUser;
  };

  useEffect(() => {
    if (DEMO_MODE_ENABLED) {
      setIsLoading(false);
      setIsAdminLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser ? toAppUser(nextUser) : null);
      setIsLoading(false);
      await syncAdminState(nextUser);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    if (DEMO_MODE_ENABLED) {
      const normalizedEmail = email.trim().toLowerCase() || "demo.admin@example.com";
      const localPart = normalizedEmail.split("@")[0] || "demo";
      const displayName = localPart
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const demoUser = buildDemoUser({
        uid: normalizedEmail === "demo.admin@example.com" ? "demo-admin-1" : `demo-${localPart}`,
        email: normalizedEmail,
        displayName: displayName || "Demo User",
        metadata: {
          creationTime: "2026-03-01T09:00:00-08:00",
          lastSignInTime: new Date().toISOString(),
        } as User["metadata"],
      });
      setUser(demoUser);
      setIsAdmin(true);
      setIsLoading(false);
      setIsAdminLoading(false);
      persistDemoUser(demoUser);
      void password;
      return demoUser;
    }

    setIsLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential: UserCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      setUser(toAppUser(credential.user));
      setIsAdminLoading(true);
      return toAppUser(credential.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (DEMO_MODE_ENABLED) {
      setUser(null);
      setIsAdmin(false);
      setIsLoading(false);
      setIsAdminLoading(false);
      persistDemoUser(null);
      return;
    }

    setIsLoading(true);
    setIsAdminLoading(true);

    try {
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
      setIsAdminLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (DEMO_MODE_ENABLED) {
      if (!email.trim()) {
        throw new Error("Enter your email address first.");
      }
      return;
    }

    await sendPasswordResetEmail(auth, email.trim());
  };

  const updateDisplayName = async (displayName: string) => {
    if (DEMO_MODE_ENABLED) {
      const currentUser = requireCurrentDemoUser();
      const nextUser = buildDemoUser({
        ...currentUser,
        displayName: displayName.trim(),
        metadata: {
          ...currentUser.metadata,
          lastSignInTime: new Date().toISOString(),
        } as User["metadata"],
      });
      setUser(nextUser);
      persistDemoUser(nextUser);
      return nextUser;
    }

    const currentUser = requireCurrentFirebaseUser();
    await updateProfile(currentUser, { displayName: displayName.trim() });
    return refreshCurrentUser();
  };

  const updateEmailAddress = async (email: string, currentPassword: string) => {
    if (DEMO_MODE_ENABLED) {
      requireCurrentPassword(currentPassword);
      const currentUser = requireCurrentDemoUser();
      const nextUser = buildDemoUser({
        ...currentUser,
        email: email.trim(),
        metadata: {
          ...currentUser.metadata,
          lastSignInTime: new Date().toISOString(),
        } as User["metadata"],
      });
      setUser(nextUser);
      persistDemoUser(nextUser);
      return nextUser;
    }

    const currentUser = await reauthenticateFirebaseUser(currentPassword.trim());
    await firebaseUpdateEmail(currentUser, email.trim());
    return refreshCurrentUser();
  };

  const updatePasswordValue = async (
    newPassword: string,
    currentPassword: string,
  ) => {
    if (DEMO_MODE_ENABLED) {
      void newPassword;
      requireCurrentPassword(currentPassword);
      return;
    }

    const currentUser = await reauthenticateFirebaseUser(currentPassword.trim());
    await firebaseUpdatePassword(currentUser, newPassword);
    await refreshCurrentUser();
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      isAdmin,
      isAdminLoading,
      login,
      logout,
      resetPassword,
      updateDisplayName,
      updateEmailAddress,
      updatePasswordValue,
    }),
    [isAdmin, isAdminLoading, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
