/**
 * Typed HTTP client for the Skillevate User microservice.
 *
 * Endpoints (see Skillevate-User/README.md):
 *   POST   /api/users/sync                          -> upsert from Auth0 profile
 *   GET    /api/users/{auth0_sub}                   -> fetch profile
 *   PATCH  /api/users/{auth0_sub}/preferences       -> update theme / language / notifications
 *   DELETE /api/users/{auth0_sub}                   -> delete account
 *
 * The client tolerates two operating modes:
 *   - Anonymous: no bearer token attached (User service has auth disabled).
 *   - Authenticated: a bearer token is attached when one can be obtained.
 *
 * It never throws on a missing token; that's a recoverable, expected state in
 * dev. Network errors and non-2xx responses raise `UserServiceError`.
 */

/**
 * Base URL of the User microservice. Injected at build time by webpack's
 * `DefinePlugin` from `Skillevate-MFE/.env` (key `USER_SERVICE_URL`).
 *
 * If the build wasn't given a value, every call below short-circuits with a
 * clear error — we deliberately don't fall back to localhost so missing
 * configuration fails loudly instead of silently hitting a wrong host.
 */
const USER_SERVICE_URL: string =
  typeof process !== "undefined" && process.env && process.env.USER_SERVICE_URL
    ? process.env.USER_SERVICE_URL
    : "";

function assertConfigured(): void {
  if (!USER_SERVICE_URL) {
    throw new UserServiceError(
      "USER_SERVICE_URL is not configured. Set it in Skillevate-MFE/.env and restart the dev server.",
      0,
    );
  }
}

export type ThemePreference = "light" | "dark" | "system";

export interface NotificationPreferences {
  email: boolean;
  in_app: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  language: string;
  notifications: NotificationPreferences;
}

export interface SkillevateUser {
  auth0_sub: string;
  email?: string | null;
  email_verified?: boolean | null;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  nickname?: string | null;
  picture?: string | null;
  locale?: string | null;
  auth0_updated_at?: string | null;
  preferences: UserPreferences;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Subset of `useAuth0().user` we forward to the backend. */
export interface Auth0ProfilePayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  picture?: string;
  locale?: string;
  updated_at?: string;
}

export interface UserPreferencesPatch {
  theme?: ThemePreference;
  language?: string;
  notifications?: NotificationPreferences;
}

export class UserServiceError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "UserServiceError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  bearerToken?: string;
}

async function request<T>({ method, path, body, bearerToken }: RequestOptions): Promise<T> {
  assertConfigured();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  let response: Response;
  try {
    response = await fetch(`${USER_SERVICE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkError) {
    throw new UserServiceError(
      `Network error contacting User service at ${USER_SERVICE_URL}: ${
        (networkError as Error).message
      }`,
      0,
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let payload: unknown;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload === "object" && (payload as { detail?: unknown }).detail) ||
      payload ||
      response.statusText;
    throw new UserServiceError(
      `User service ${method} ${path} failed (${response.status}): ${
        typeof detail === "string" ? detail : JSON.stringify(detail)
      }`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

function encodeSub(auth0Sub: string): string {
  return encodeURIComponent(auth0Sub);
}

/** POST /api/users/sync — idempotent upsert from Auth0 claims. */
export function syncUser(
  profile: Auth0ProfilePayload,
  bearerToken?: string,
): Promise<SkillevateUser> {
  return request<SkillevateUser>({
    method: "POST",
    path: "/api/users/sync",
    body: profile,
    bearerToken,
  });
}

/** GET /api/users/{auth0_sub} */
export function getUser(auth0Sub: string, bearerToken?: string): Promise<SkillevateUser> {
  return request<SkillevateUser>({
    method: "GET",
    path: `/api/users/${encodeSub(auth0Sub)}`,
    bearerToken,
  });
}

/** PATCH /api/users/{auth0_sub}/preferences */
export function updatePreferences(
  auth0Sub: string,
  patch: UserPreferencesPatch,
  bearerToken?: string,
): Promise<SkillevateUser> {
  return request<SkillevateUser>({
    method: "PATCH",
    path: `/api/users/${encodeSub(auth0Sub)}/preferences`,
    body: patch,
    bearerToken,
  });
}

/** DELETE /api/users/{auth0_sub} */
export function deleteUser(auth0Sub: string, bearerToken?: string): Promise<void> {
  return request<void>({
    method: "DELETE",
    path: `/api/users/${encodeSub(auth0Sub)}`,
    bearerToken,
  });
}
