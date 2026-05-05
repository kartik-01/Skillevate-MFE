/**
 * Bridges the existing `ThemeProvider` (which only knows "light" | "dark" and
 * persists to localStorage) with the user-scoped preferences served by the
 * Skillevate User microservice.
 *
 * Behaviour:
 *   - On the first successful sync, hydrate `ThemeProvider` from
 *     `user.preferences.theme`. If the backend says "system" we resolve the
 *     concrete theme from `prefers-color-scheme` so the UI has something
 *     definite to render.
 *   - When the user toggles the theme afterwards, push the change back via
 *     `PATCH /api/users/{sub}/preferences`. Backend writes are guarded so we
 *     don't echo the value we just received from the server.
 *   - The backend is treated as an enhancement: failures are swallowed (with
 *     a console warning) so the app keeps working offline / pre-login.
 *
 * This component renders nothing.
 */

import { useEffect, useRef } from "react";

import { useTheme } from "../landing/components/ThemeProvider";
import { useUser } from "./UserProvider";

type ConcreteTheme = "light" | "dark";

function resolveSystemTheme(): ConcreteTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function SyncedThemeBridge(): null {
  const { user, status, updatePreferences } = useUser();
  const { theme, setTheme } = useTheme();

  // The last theme value that we know the backend has stored. Used to debounce
  // PATCH calls (don't re-send the value we just received) and to gate the
  // first push-to-backend until *after* we've hydrated from the backend.
  const lastSyncedRef = useRef<ConcreteTheme | null>(null);

  // 1. Hydrate ThemeProvider from the backend on (re)sync.
  useEffect(() => {
    if (status !== "synced" || !user) return;

    const remote = user.preferences.theme;
    const resolved: ConcreteTheme = remote === "system" ? resolveSystemTheme() : remote;

    lastSyncedRef.current = resolved;
    if (resolved !== theme) {
      setTheme(resolved);
    }
    // We intentionally only react to user identity changes here; reacting to
    // `theme` would create an infinite loop with the push effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.auth0_sub]);

  // 2. Push local theme changes back to the backend.
  useEffect(() => {
    if (!user) return;
    if (lastSyncedRef.current === null) return; // not hydrated yet
    if (theme === lastSyncedRef.current) return;

    lastSyncedRef.current = theme as ConcreteTheme;
    updatePreferences({ theme: theme as ConcreteTheme }).catch(() => {
      // updatePreferences already logs; nothing else to do here.
    });
  }, [theme, user, updatePreferences]);

  return null;
}
