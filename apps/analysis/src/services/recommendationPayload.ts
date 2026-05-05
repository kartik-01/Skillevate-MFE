import type { JdSkillsResponse } from "./analysisApi";

/**
 * Contract for the learning / recommendation backend (curated by another module).
 * Analysis owns writing this payload to localStorage after a successful gap analysis.
 *
 * Storage key: `RECOMMENDATION_REQUEST_STORAGE_KEY` — value is a JSON object:
 * `Record<resumeId, RecommendationRequestBody>`
 */
export type RecommendationSkill = {
  skill: string;
  preferences: string[];
};

export type RecommendationRequestBody = {
  skills: RecommendationSkill[];
  max_results: number;
  language: string;
};

export const RECOMMENDATION_REQUEST_STORAGE_KEY = "skillevate-recommendation-request-v1";

type AnalysisResultLike = {
  verifiedStrongSkills: string[];
  verifiedListedSkills: string[];
  criticalGaps: string[];
  preferredGaps: string[];
};

function cleanSkillLabel(s: string): string {
  return s.replace(/\s*\(Listed\)\s*$/i, "").replace(/\s*\(Strong\)\s*$/i, "").trim();
}

export function buildRecommendationRequestFromAnalysis(params: {
  analysis: AnalysisResultLike;
  jdSkills: JdSkillsResponse | null;
  jobDescription: string;
  maxResults?: number;
  language?: string;
}): RecommendationRequestBody {
  const { analysis, jdSkills, jobDescription, maxResults = 10, language = "en" } = params;

  const jdSnippet = jobDescription.trim().replace(/\s+/g, " ").slice(0, 160);
  const roleBits = [jdSkills?.role_title, jdSkills?.role_area, jdSkills?.company].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );

  const rows: RecommendationSkill[] = [];
  const seen = new Set<string>();

  const addSkill = (rawName: string, preferences: string[]) => {
    const skill = cleanSkillLabel(rawName);
    if (!skill) return;
    const key = skill.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      skill,
      preferences: [...new Set(preferences)].filter(Boolean).slice(0, 8),
    });
  };

  for (const g of analysis.criticalGaps) {
    const prefs = ["critical gap", "high priority", ...roleBits];
    if (jdSnippet) prefs.push(jdSnippet);
    addSkill(g, prefs);
  }

  for (const g of analysis.preferredGaps) {
    const prefs = ["skill gap", "medium priority", ...roleBits];
    if (jdSnippet) prefs.push(jdSnippet);
    addSkill(g, prefs);
  }

  if (rows.length === 0) {
    const listed = analysis.verifiedListedSkills.map((s) => `${s} (Listed)`);
    const combined = [...analysis.verifiedStrongSkills, ...listed];
    for (const v of combined.slice(0, 5)) {
      const prefs = ["strengthen existing skill", "advanced", ...roleBits];
      if (jdSnippet) prefs.push(jdSnippet);
      addSkill(v, prefs);
    }
  }

  if (rows.length === 0) {
    addSkill("professional development", jdSnippet ? ["general upskilling", jdSnippet] : ["general upskilling", "career growth"]);
  }

  return {
    skills: rows.slice(0, 25),
    max_results: maxResults,
    language,
  };
}

export function saveRecommendationRequestForResume(resumeId: string, body: RecommendationRequestBody): void {
  if (typeof window === "undefined" || !resumeId) return;
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_REQUEST_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, RecommendationRequestBody>) : {};
    map[resumeId] = body;
    window.localStorage.setItem(RECOMMENDATION_REQUEST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function removeRecommendationRequestForResume(resumeId: string): void {
  if (typeof window === "undefined" || !resumeId) return;
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_REQUEST_STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, RecommendationRequestBody>;
    if (!(resumeId in map)) return;
    delete map[resumeId];
    window.localStorage.setItem(RECOMMENDATION_REQUEST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
