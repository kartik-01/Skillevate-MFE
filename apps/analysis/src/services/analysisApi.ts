// src/services/analysisApi.ts

export type ResumeSkills = {
  strong: string[];
  listed: string[];
};

type ResumeParseResponse = {
  skills?: ResumeSkills;
};

type GapSkill = {
  skill: string;
  importance: string;
  match_type?: string;
};

type MissingSkill = {
  skill: string;
  importance: string;
  category?: string;
};

type GapAnalysisResponse = {
  match_score: number;
  matched_strong: GapSkill[];
  matched_listed: GapSkill[];
  missing_critical: MissingSkill[];
  missing_preferred: MissingSkill[];
};

export type JdSkillsResponse = {
  source?: string;
  role_title?: string;
  role_area?: string;
  company?: string;
  required?: string[];
  preferred?: string[];
};

export type AnalyzeResponse = {
  jd_skills: JdSkillsResponse;
  gap_analysis: GapAnalysisResponse;
};

type WindowWithSkillevateConfig = Window & {
  __SKILLEVATE_ANALYSIS_CONFIG__?: {
    apiBaseUrl?: string;
  };
  __SKILLEVATE_GET_ACCESS_TOKEN__?: () => Promise<string>;
};

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, "");

/** Path under `ANALYSIS_API_PATH_ROOT` (segment has no leading slash). */
const analysisApiRelativePath = (segment: string): string => {
  const root = (process.env.ANALYSIS_API_PATH_ROOT ?? "").trim().replace(/\/+$/, "");
  const seg = segment.replace(/^\/+/, "");
  if (!root) {
    throw new Error(
      "ANALYSIS_API_PATH_ROOT is empty. Set it in Skillevate-MFE/.env (e.g. /api). See .env.example.",
    );
  }
  return `${root}/${seg}`;
};

const API_ROUTES = {
  parseResumeSkills: analysisApiRelativePath("resume/skills"),
  extractText: analysisApiRelativePath("jobs/skills"),
  extractPdf: analysisApiRelativePath("jobs/skills/file"),
  analyzeDirect: analysisApiRelativePath("analysis/gap"),
  analyzeText: analysisApiRelativePath("v1/analyzer/analyze"),
  analyzePdf: analysisApiRelativePath("v1/analyzer/analyze/pdf"),
  saveAnalysis: analysisApiRelativePath("analyses"),
};

const getDefaultInference = (): string => (process.env.ANALYSIS_DEFAULT_INFERENCE ?? "").trim();

const getResumeParserInference = (): string =>
  (process.env.ANALYSIS_RESUME_PARSER_INFERENCE ?? "").trim();

/**
 * Resolves the analyses service origin (no trailing slash).
 *
 * 1. `window.__SKILLEVATE_ANALYSIS_CONFIG__.apiBaseUrl` — optional host override.
 * 2. `process.env.ANALYSIS_API_BASE_URL` — build-time value from `Skillevate-MFE/.env`
 *    via webpack `DefinePlugin` (required for prod; no localhost fallback in code).
 *
 * Do not use `typeof process !== "undefined"` before reading env: in the browser
 * `process` is undefined, but webpack still replaces `process.env.ANALYSIS_API_BASE_URL`
 * with a string literal.
 */
const getRuntimeBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const runtime = (window as WindowWithSkillevateConfig).__SKILLEVATE_ANALYSIS_CONFIG__;
    if (runtime?.apiBaseUrl?.trim()) {
      return normalizeBaseUrl(runtime.apiBaseUrl);
    }
  }

  const fromBuild = process.env.ANALYSIS_API_BASE_URL;
  const trimmed = typeof fromBuild === "string" ? fromBuild.trim() : "";
  if (!trimmed) {
    throw new Error(
      "ANALYSIS_API_BASE_URL is not set. Add it to Skillevate-MFE/.env (or your CI env) and restart the dev server. See .env.example.",
    );
  }
  return normalizeBaseUrl(trimmed);
};

const getAccessToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  const tokenProvider = (window as WindowWithSkillevateConfig).__SKILLEVATE_GET_ACCESS_TOKEN__;
  if (!tokenProvider) return null;

  try {
    const token = await tokenProvider();
    return token || null;
  } catch {
    return null;
  }
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const token = await getAccessToken();
  const headers = new Headers(init.headers ?? undefined);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrl = getRuntimeBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const payloadText = await response.text();
  const parsed = payloadText ? (JSON.parse(payloadText) as unknown) : null;

  if (!response.ok) {
    const detail =
      typeof parsed === "object" &&
      parsed !== null &&
      "detail" in parsed &&
      typeof (parsed as { detail?: unknown }).detail === "string"
        ? (parsed as { detail: string }).detail
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }

  return parsed as T;
};

export const parseResumeSkills = async (file: File): Promise<ResumeSkills> => {
  const resumeInference = getResumeParserInference();
  if (!resumeInference) {
    throw new Error(
      "ANALYSIS_RESUME_PARSER_INFERENCE is empty. Set it in Skillevate-MFE/.env (see .env.example).",
    );
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("inference", resumeInference);
  formData.append("enrich", "false");

  const response = await request<ResumeParseResponse>(API_ROUTES.parseResumeSkills, {
    method: "POST",
    body: formData,
  });

  if (!response.skills) {
    throw new Error("Resume parser returned no skills.");
  }

  return {
    strong: response.skills.strong ?? [],
    listed: response.skills.listed ?? [],
  };
};

export const extractJdText = async (jdText: string): Promise<JdSkillsResponse> => {
  const inference = getDefaultInference();
  if (!inference) {
    throw new Error(
      "ANALYSIS_DEFAULT_INFERENCE is empty. Set it in Skillevate-MFE/.env (see .env.example).",
    );
  }
  return request<JdSkillsResponse>(API_ROUTES.extractText, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jd_text: jdText,
      inference,
    }),
  });
};

export const extractJdFile = async (file: File): Promise<JdSkillsResponse> => {
  const inference = getDefaultInference();
  if (!inference) {
    throw new Error(
      "ANALYSIS_DEFAULT_INFERENCE is empty. Set it in Skillevate-MFE/.env (see .env.example).",
    );
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("inference", inference);

  return request<JdSkillsResponse>(API_ROUTES.extractPdf, {
    method: "POST",
    body: formData,
  });
};

export const analyzeDirect = async (
  resumeSkills: ResumeSkills,
  jdSkills: JdSkillsResponse
): Promise<AnalyzeResponse> => {
  return request<AnalyzeResponse>(API_ROUTES.analyzeDirect, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resume_skills: resumeSkills,
      jd_skills: jdSkills,
    }),
  });
};

// ── Persistence (MongoDB Atlas via backend `analyses` collection) ────────────

export type AnalysisGapItem = {
  skill: string;
  preferences: string[];
};

export type SaveAnalysisPayload = {
  user_id: string;
  /** Server forces this to true regardless of input. Kept optional for symmetry. */
  is_latest?: boolean;
  resume_metadata: {
    filename: string;
    /** ISO 8601 timestamp. */
    upload_date: string;
  };
  jd_metadata: {
    title: string;
    raw_text: string;
  };
  results: {
    /** 0..100 integer. */
    match_score: number;
    gaps: AnalysisGapItem[];
    /** Server forces []; the field is owned by another microservice. */
    recommendations?: never[];
  };
};

export type SaveAnalysisResponse = {
  id: string;
  user_id: string;
  is_latest: boolean;
};

/**
 * Persists a successful gap-analysis run to the backend `analyses` collection.
 * The server demotes prior `is_latest` rows for the same `user_id` and inserts
 * the new document with `is_latest=true`.
 */
export const saveAnalysis = async (
  payload: SaveAnalysisPayload,
): Promise<SaveAnalysisResponse> => {
  return request<SaveAnalysisResponse>(API_ROUTES.saveAnalysis, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

// ── Legacy Routes (Kept for backward compatibility if needed) ────────────────

export const analyzeWithJdText = async (jdText: string, resumeSkills: ResumeSkills): Promise<AnalyzeResponse> => {
  const inference = getDefaultInference();
  if (!inference) {
    throw new Error(
      "ANALYSIS_DEFAULT_INFERENCE is empty. Set it in Skillevate-MFE/.env (see .env.example).",
    );
  }
  return request<AnalyzeResponse>(API_ROUTES.analyzeText, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jd_text: jdText,
      inference,
      resume_skills: resumeSkills,
    }),
  });
};

export const analyzeWithJdFile = async (file: File, resumeSkills: ResumeSkills): Promise<AnalyzeResponse> => {
  const inference = getDefaultInference();
  if (!inference) {
    throw new Error(
      "ANALYSIS_DEFAULT_INFERENCE is empty. Set it in Skillevate-MFE/.env (see .env.example).",
    );
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("inference", inference);
  formData.append("resume_skills", JSON.stringify(resumeSkills));

  return request<AnalyzeResponse>(API_ROUTES.analyzePdf, {
    method: "POST",
    body: formData,
  });
};
