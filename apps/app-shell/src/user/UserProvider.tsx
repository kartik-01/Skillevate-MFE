/**
 * Authenticated-user context for the Skillevate frontend.
 *
 * Responsibilities:
 *   1. After Auth0 login, mirror the user into the Skillevate User service via
 *      `POST /api/users/sync`. This is idempotent — 201 on first login, 200
 *      on subsequent ones — so we just call it once per `auth0_sub` change.
 *   2. Expose the synced user (including server-stored `preferences`) and a
 *      `updatePreferences` mutator to the rest of the app.
 *   3. Tolerate a missing access token (when Auth0 has no API audience set)
 *      and a temporarily unreachable backend without breaking the UI.
 *
 * Components inside this provider can call `useUser()`. Components outside
 * the authenticated tree should not — `useUser()` throws if used without a
 * provider.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";

import {
  Auth0ProfilePayload,
  SkillevateUser,
  syncUser,
  updatePreferences as patchPreferences,
  UserPreferencesPatch,
  UserServiceError,
} from "./userService";

export type UserSyncStatus = "idle" | "syncing" | "synced" | "error";

interface UserContextValue {
  user: SkillevateUser | null;
  status: UserSyncStatus;
  error: string | null;
  refresh: () => Promise<void>;
  updatePreferences: (patch: UserPreferencesPatch) => Promise<SkillevateUser | null>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

function toAuth0Payload(auth0User: Record<string, unknown> | undefined): Auth0ProfilePayload | null {
  if (!auth0User || typeof auth0User.sub !== "string") return null;
  return {
    sub: auth0User.sub,
    email: typeof auth0User.email === "string" ? auth0User.email : undefined,
    email_verified:
      typeof auth0User.email_verified === "boolean" ? auth0User.email_verified : undefined,
    name: typeof auth0User.name === "string" ? auth0User.name : undefined,
    given_name: typeof auth0User.given_name === "string" ? auth0User.given_name : undefined,
    family_name: typeof auth0User.family_name === "string" ? auth0User.family_name : undefined,
    nickname: typeof auth0User.nickname === "string" ? auth0User.nickname : undefined,
    picture: typeof auth0User.picture === "string" ? auth0User.picture : undefined,
    locale: typeof auth0User.locale === "string" ? auth0User.locale : undefined,
    updated_at: typeof auth0User.updated_at === "string" ? auth0User.updated_at : undefined,
  };
}

interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const { isAuthenticated, user: auth0User, getAccessTokenSilently } = useAuth0();

  const [user, setUser] = useState<SkillevateUser | null>(null);
  const [status, setStatus] = useState<UserSyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Track which auth0_sub we've already synced so we don't fire duplicate
  // requests when React re-renders or the Auth0 SDK re-emits the same user.
  const lastSyncedSubRef = useRef<string | null>(null);

  const tryGetToken = useCallback(async (): Promise<string | undefined> => {
    try {
      return await getAccessTokenSilently();
    } catch {
      // Most common cause: no `audience` configured on Auth0Provider, which
      // means there's no API to issue access tokens for. The User service
      // currently runs without JWT verification, so a missing token is fine.
      return undefined;
    }
  }, [getAccessTokenSilently]);

  const sync = useCallback(async () => {
    const profile = toAuth0Payload(auth0User as Record<string, unknown> | undefined);
    if (!profile) return;

    setStatus("syncing");
    setError(null);
    try {
      const token = await tryGetToken();
      const synced = await syncUser(profile, token);
      setUser(synced);
      setStatus("synced");
      lastSyncedSubRef.current = profile.sub;
    } catch (err) {
      const message =
        err instanceof UserServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      // eslint-disable-next-line no-console
      console.warn("[user] sync failed:", message);
      setError(message);
      setStatus("error");
    }
  }, [auth0User, tryGetToken]);

  // Run the sync once per `auth0_sub` transition; clear state on logout.
  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      setStatus("idle");
      setError(null);
      lastSyncedSubRef.current = null;
      return;
    }
    const sub = (auth0User as { sub?: string } | undefined)?.sub;
    if (!sub) return;
    if (lastSyncedSubRef.current === sub) return;
    sync();
  }, [isAuthenticated, auth0User, sync]);

  const refresh = useCallback(async () => {
    lastSyncedSubRef.current = null;
    await sync();
  }, [sync]);

  const updatePreferences = useCallback<UserContextValue["updatePreferences"]>(
    async (patch) => {
      const sub = user?.auth0_sub;
      if (!sub) return null;
      try {
        const token = await tryGetToken();
        const updated = await patchPreferences(sub, patch, token);
        setUser(updated);
        return updated;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[user] updatePreferences failed:", err);
        throw err;
      }
    },
    [user?.auth0_sub, tryGetToken],
  );

  const value = useMemo<UserContextValue>(
    () => ({ user, status, error, refresh, updatePreferences }),
    [user, status, error, refresh, updatePreferences],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (ctx === undefined) {
    throw new Error("useUser() must be used inside a <UserProvider>");
  }
  return ctx;
}

/** Convenience hook for consumers that only care about preferences mutation. */
export function useUpdatePreferences(): UserContextValue["updatePreferences"] {
  return useUser().updatePreferences;
}
