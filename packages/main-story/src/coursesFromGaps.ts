import type { StoryCourse, StoryGap } from "./types";

const PLACEHOLDER_THUMBNAILS = {
  react: "https://images.unsplash.com/photo-1649451844931-57e22fc82de3?w=1080",
  node: "https://images.unsplash.com/photo-1667264501379-c1537934c7ab?w=1080",
  ui: "https://images.unsplash.com/photo-1622117523535-ecb446c0c1ab?w=1080",
} as const;

/** Same rules as the Learning Path mock catalog — kept in one place for story + recommendations. */
export function coursesFromGaps(gaps: StoryGap[]): StoryCourse[] {
  const gapNameMap = new Set(gaps.map((gap) => gap.name.toLowerCase()));
  const courses: StoryCourse[] = [];

  if (gapNameMap.has("advanced typescript")) {
    courses.push({
      id: "catalog_typescript",
      title: "Advanced TypeScript for React Developers",
      fillsGap: "Advanced TypeScript",
      xp: 150,
      provider: "Skillevate",
      resourceLabel: "Module · Self-paced",
    });
  }

  if (gapNameMap.has("system design")) {
    courses.push({
      id: "catalog_system_design",
      title: "System Design Interview: Frontend Concepts",
      fillsGap: "System Design",
      xp: 100,
      provider: "Skillevate",
      resourceLabel: "Module · Self-paced",
    });
  }

  if (gapNameMap.has("graphql")) {
    courses.push({
      id: "catalog_graphql",
      title: "GraphQL APIs with Node.js & Apollo",
      fillsGap: "GraphQL",
      xp: 200,
      provider: "Skillevate",
      resourceLabel: "Module · Self-paced",
    });
  }

  if (courses.length === 0) {
    courses.push({
      id: "catalog_general",
      title: "Modern Frontend Interview Preparation",
      fillsGap: "General Upskilling",
      xp: 120,
      provider: "Skillevate",
      resourceLabel: "Module · Self-paced",
    });
  }

  return courses;
}

export function courseThumbnails(): Record<string, string> {
  return {
    catalog_typescript: PLACEHOLDER_THUMBNAILS.react,
    catalog_system_design: PLACEHOLDER_THUMBNAILS.ui,
    catalog_graphql: PLACEHOLDER_THUMBNAILS.node,
    catalog_general: PLACEHOLDER_THUMBNAILS.react,
  };
}

/** Placeholder image when course id is not in the static catalog (e.g. batch API ids). */
export function thumbnailForStoryCourse(id: string): string {
  const pool = [PLACEHOLDER_THUMBNAILS.react, PLACEHOLDER_THUMBNAILS.node, PLACEHOLDER_THUMBNAILS.ui];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return pool[h % pool.length];
}
