import type { JdSkillsResponse } from "./analysisApi";

/**
 * Contract for the learning / recommendation backend.
 * Analysis writes this payload to localStorage after a successful gap analysis.
 *
 * Storage key: `RECOMMENDATION_REQUEST_STORAGE_KEY` — value is a JSON object:
 * `Record<resumeId, RecommendationRequestBody>`
 */
export type RecommendationSkill = {
  skill: string;
  preferences: string[];
};

/** Alias for consumers that used the merged-in name. */
export type RecommendationSkillRequest = RecommendationSkill;

export type RecommendationRequestBody = {
  skills: RecommendationSkill[];
  max_results: number;
  language: string;
};

export const RECOMMENDATION_REQUEST_STORAGE_KEY = "skillevate-recommendation-request-v1";

type AnalysisGap = {
  name: string;
  priority: "High" | "Medium";
  match: string;
};

type AnalysisForRecommendation = {
  gaps: AnalysisGap[];
  verifiedStrongSkills: string[];
  verifiedListedSkills: string[];
  criticalGaps: string[];
  preferredGaps: string[];
};

function readStoredRequests(): Record<string, RecommendationRequestBody> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_REQUEST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RecommendationRequestBody>) : {};
  } catch {
    return {};
  }
}

function cleanSkillLabel(s: string): string {
  return s.replace(/\s*\(Listed\)\s*$/i, "").replace(/\s*\(Strong\)\s*$/i, "").trim();
}

function preferencesForGap(gap: AnalysisGap, jdSkills: JdSkillsResponse | null, jobDescription: string): string[] {
  const jdSnippet = jobDescription.trim().replace(/\s+/g, " ").slice(0, 160);
  const fromMatch = gap.match
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const roleHints = [jdSkills?.role_title, jdSkills?.role_area, jdSkills?.company]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const prefs: string[] = [
    gap.priority === "High" ? "critical gap" : "skill gap",
    gap.priority === "High" ? "high priority" : "medium priority",
    ...fromMatch,
    ...roleHints,
  ];
  if (jdSnippet) prefs.push(jdSnippet);

  return [...new Set(prefs)].filter(Boolean).slice(0, 12);
}

export function buildRecommendationRequestFromAnalysis(params: {
  analysis: AnalysisForRecommendation;
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

  if (Array.isArray(analysis.gaps) && analysis.gaps.length > 0) {
    for (const gap of analysis.gaps) {
      const name = String(gap?.name ?? "").trim();
      if (!name) continue;
      const skill = cleanSkillLabel(name).toLowerCase().replace(/\s+/g, " ").trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        skill,
        preferences: preferencesForGap(
          {
            name,
            priority: gap.priority === "High" ? "High" : "Medium",
            match: String(gap?.match ?? ""),
          },
          jdSkills,
          jobDescription,
        ),
      });
    }
  } else {
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
      addSkill(
        "professional development",
        jdSnippet ? ["general upskilling", jdSnippet] : ["general upskilling", "career growth"],
      );
    }
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
    const stored = readStoredRequests();
    stored[resumeId] = body;
    window.localStorage.setItem(RECOMMENDATION_REQUEST_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

export function removeRecommendationRequestForResume(resumeId: string): void {
  if (typeof window === "undefined" || !resumeId) return;
  try {
    const stored = readStoredRequests();
    if (!(resumeId in stored)) return;
    delete stored[resumeId];
    window.localStorage.setItem(RECOMMENDATION_REQUEST_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

export function getRecommendationRequestForResume(resumeId: string): RecommendationRequestBody | null {
  return readStoredRequests()[resumeId] ?? null;
}
