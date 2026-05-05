import type { JdSkillsResponse } from "./analysisApi";

type AnalysisGap = {
  name: string;
  priority: "High" | "Medium";
  match: string;
};

type AnalysisForRecommendation = {
  gaps: AnalysisGap[];
};

type BuildRecommendationRequestArgs = {
  analysis: AnalysisForRecommendation;
  jdSkills: JdSkillsResponse | null;
  jobDescription: string;
  maxResults?: number;
  language?: string;
};

export type RecommendationSkillRequest = {
  skill: string;
  preferences: string[];
};

export type RecommendationRequestBody = {
  skills: RecommendationSkillRequest[];
  max_results: number;
  language: string;
};

const RECOMMENDATION_REQUEST_STORAGE_KEY = "skillevate-recommendation-request-v1";

function readStoredRequests(): Record<string, RecommendationRequestBody> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_REQUEST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RecommendationRequestBody>) : {};
  } catch {
    return {};
  }
}

function preferencesForGap(gap: AnalysisGap, jdSkills: JdSkillsResponse | null, jobDescription: string): string[] {
  const fromMatch = gap.match
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const roleHints = [jdSkills?.role_title, jdSkills?.role_area, jdSkills?.company]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const jdHint = jobDescription.trim() ? ["job-description-context"] : [];

  return [
    gap.priority === "High" ? "priority-high" : "priority-medium",
    ...fromMatch,
    ...roleHints,
    ...jdHint,
  ].slice(0, 12);
}

export function buildRecommendationRequestFromAnalysis({
  analysis,
  jdSkills,
  jobDescription,
  maxResults = 10,
  language = "en",
}: BuildRecommendationRequestArgs): RecommendationRequestBody {
  const skills = analysis.gaps.map((gap) => ({
    skill: gap.name.toLowerCase().replace(/\s+/g, " ").trim(),
    preferences: preferencesForGap(gap, jdSkills, jobDescription),
  }));

  return {
    skills,
    max_results: maxResults,
    language,
  };
}

export function saveRecommendationRequestForResume(resumeId: string, body: RecommendationRequestBody) {
  if (typeof window === "undefined" || !resumeId) return;
  const stored = readStoredRequests();
  stored[resumeId] = body;
  window.localStorage.setItem(RECOMMENDATION_REQUEST_STORAGE_KEY, JSON.stringify(stored));
}

export function removeRecommendationRequestForResume(resumeId: string) {
  if (typeof window === "undefined" || !resumeId) return;
  const stored = readStoredRequests();
  delete stored[resumeId];
  window.localStorage.setItem(RECOMMENDATION_REQUEST_STORAGE_KEY, JSON.stringify(stored));
}

export function getRecommendationRequestForResume(resumeId: string): RecommendationRequestBody | null {
  return readStoredRequests()[resumeId] ?? null;
}
