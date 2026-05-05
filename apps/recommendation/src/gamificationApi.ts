export type AnalysisGap = {
  name: string;
  priority: "High" | "Medium";
  match: string;
};

export type RecommendationRequestBody = {
  skills: Array<{
    skill: string;
    preferences: string[];
  }>;
  max_results: number;
  language: string;
};

export type GamificationCourse = {
  courseId: string;
  title: string;
  url: string;
  provider: string;
  providerDetail: string;
  description: string;
  targetSkill: string;
  relevanceScore: number;
  xp: number;
  position: number;
  status: "locked" | "current" | "complete";
  completedAt?: string | null;
};

export type GamificationProgress = {
  earnedXp: number;
  courses: GamificationCourse[];
};

export type SyncAnalysisPayload = {
  resumeId: string;
  resumeLabel: string;
  analysisId: string;
  matchPercent: number;
  gaps: AnalysisGap[];
  jobDescription?: string;
  recommendationRequest?: RecommendationRequestBody | null;
};

const GAMIFICATION_API_BASE_URL =
  process.env.SKILLEVATE_GAMIFICATION_URL || "http://localhost:8002";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Gamification API failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function gamificationFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GAMIFICATION_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return parseResponse<T>(response);
}

export function syncAnalysis(token: string, payload: SyncAnalysisPayload) {
  return gamificationFetch<GamificationProgress>("/api/gamification/sync-analysis", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeCourse(token: string, courseId: string, resumeId: string, analysisId: string) {
  return gamificationFetch<GamificationProgress>(
    `/api/gamification/courses/${encodeURIComponent(courseId)}/complete`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ resumeId, analysisId }),
    },
  );
}
