import type { StoryCourse, StoryGap } from "./types";

import batchRecommendationsMock from "./fixtures/batchRecommendationsMock.json";

export type BatchSkillInput = {
  skill: string;
  preferences: string[];
};

/** Batch recommendation API contract (stubbed in the UI for now). */
export type BatchRecommendationRequest = {
  skills: BatchSkillInput[];
  max_results: number;
  language: string;
};

export type BatchRecommendationItem = {
  id: string;
  title: string;
  provider: string;
  url: string;
  description: string;
  tags: string[];
  relevance_score: number;
  stars: number | null;
  forks: number | null;
  published_at: string | null;
  view_count: number | null;
  like_count: number | null;
  channel_id: string | null;
  channel_name: string | null;
  org_login: string | null;
};

export type BatchRecommendationResponse = {
  results: Array<{
    skill: string;
    total_results: number;
    recommendations: BatchRecommendationItem[];
  }>;
  metadata: {
    total_skills: number;
    language: string;
  };
};

const MOCK_RESPONSE = batchRecommendationsMock as BatchRecommendationResponse;

function formatResourceLabel(item: BatchRecommendationItem): string {
  const p = item.provider.toLowerCase();
  const kind = p.includes("youtube")
    ? "Video"
    : p.includes("github")
      ? "Repository"
      : p.includes("dev.to") || p === "devto"
        ? "Article"
        : "Resource";
  if (!item.published_at) {
    return `${kind} · Self-paced`;
  }
  try {
    const d = new Date(item.published_at);
    if (Number.isNaN(d.getTime())) return `${kind} · Self-paced`;
    const short = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    return `${kind} · ${short}`;
  } catch {
    return `${kind} · Self-paced`;
  }
}

/**
 * Builds the JSON body your batch recommendation service expects from skill gaps.
 * Call this when switching from the bundled stub to `fetch(...)`.
 */
export function buildBatchRecommendationRequestFromGaps(
  gaps: StoryGap[],
  options?: { max_results?: number; language?: string },
): BatchRecommendationRequest {
  const max_results = options?.max_results ?? 10;
  const language = options?.language ?? "en";

  const skills: BatchSkillInput[] = gaps.map((g) => {
    const tokens = g.match
      .split(/[,;/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const preferences = [
      g.priority === "High" ? "priority-high" : "priority-medium",
      ...tokens,
    ].slice(0, 12);

    return {
      skill: g.name.toLowerCase().replace(/\s+/g, " ").trim(),
      preferences: preferences.length ? preferences : ["general"],
    };
  });

  return { skills, max_results, language };
}

export function flattenBatchResponseToStoryCourses(
  response: BatchRecommendationResponse,
  maxCourses: number,
): StoryCourse[] {
  type Flat = { skill: string; item: BatchRecommendationItem };
  const flat: Flat[] = [];

  for (const block of response.results) {
    for (const item of block.recommendations) {
      flat.push({ skill: block.skill, item });
    }
  }

  flat.sort((a, b) => b.item.relevance_score - a.item.relevance_score);

  const seen = new Set<string>();
  const out: StoryCourse[] = [];

  for (const { skill, item } of flat) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const xp = Math.min(240, Math.max(72, Math.round(68 + item.relevance_score * 380)));

    out.push({
      id: item.id,
      title: item.title,
      fillsGap: skill,
      xp,
      provider: item.provider,
      url: item.url,
      resourceLabel: formatResourceLabel(item),
    });

    if (out.length >= maxCourses) break;
  }

  return out;
}

/**
 * Temporary stub: returns courses from the bundled sample response (same shape as the real API).
 * Replace the body with `fetch(url, { body: JSON.stringify(buildBatchRecommendationRequestFromGaps(gaps)) })`.
 */
export function storyCoursesFromBatchMock(gaps: StoryGap[], options?: { maxCourses?: number }): StoryCourse[] {
  const maxCourses = Math.min(options?.maxCourses ?? 10, 50);
  void gaps;
  return flattenBatchResponseToStoryCourses(MOCK_RESPONSE, maxCourses);
}

/** Async stub for swapping in real network I/O later. */
export async function fetchBatchRecommendationsStub(request: BatchRecommendationRequest): Promise<BatchRecommendationResponse> {
  await new Promise((r) => setTimeout(r, 450));
  void request;
  return MOCK_RESPONSE;
}
