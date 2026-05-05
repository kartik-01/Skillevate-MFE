import type { MainStoryMeta, StoryCourse, StoryGap, StoryNode } from "./types";

export function computeTaleId(resumeId: string, gaps: StoryGap[], courseIds: string[]): string {
  const gapKey = [...gaps.map((g) => g.name)].sort().join("|");
  const courseKey = [...courseIds].sort((a, b) => a.localeCompare(b)).join(",");
  return `${resumeId}::${gapKey}::${courseKey}`;
}

/**
 * Single vertical spine: prologue → each course in catalog order → epilogue.
 * Course completion is the single source of truth (`completedCourseIds` from gamify storage).
 */
export function buildStoryNodes(courses: StoryCourse[], completedCourseIds: string[]): StoryNode[] {
  const completed = new Set(completedCourseIds);
  const nodes: StoryNode[] = [];

  if (courses.length === 0) {
    nodes.push({
      kind: "prologue",
      id: "prologue",
      title: "Waiting for your first analysis",
      body: "Run Skill Analysis to generate gaps — your main story will appear here.",
      status: "pending",
    });
    nodes.push({
      kind: "epilogue",
      id: "epilogue",
      title: "Verify your progress",
      body: "Re-run Skill Analysis after you learn to refresh your match score.",
      status: "locked",
    });
    return nodes;
  }

  nodes.push({
    kind: "prologue",
    id: "prologue",
    title: "Begin your path",
    body: "Your recommendations are ordered so each step unlocks the next. Complete them in Learning Path.",
    status: "complete",
  });

  let assignedCurrent = false;
  for (const c of courses) {
    const isDone = completed.has(c.id);
    let status: "locked" | "current" | "complete";
    if (isDone) {
      status = "complete";
    } else if (!assignedCurrent) {
      status = "current";
      assignedCurrent = true;
    } else {
      status = "locked";
    }
    nodes.push({
      kind: "course",
      id: `course-${c.id}`,
      courseId: c.id,
      title: c.title,
      fillsGap: c.fillsGap,
      xp: c.xp,
      provider: c.provider,
      url: c.url,
      resourceLabel: c.resourceLabel,
      status,
    });
  }

  const allCoursesDone = courses.every((c) => completed.has(c.id));
  nodes.push({
    kind: "epilogue",
    id: "epilogue",
    title: "Verify your progress",
    body: "Re-run Skill Analysis with an updated resume or the same JD to see your match score move.",
    status: allCoursesDone ? "current" : "locked",
  });

  return nodes;
}

export function buildMainStoryMeta(
  resumeId: string,
  resumeLabel: string,
  matchPercent: number,
  gaps: StoryGap[],
  courses: StoryCourse[],
  completedCourseIds: string[],
): MainStoryMeta {
  const taleId = computeTaleId(
    resumeId,
    gaps,
    courses.map((c) => c.id),
  );
  const completedSet = new Set(completedCourseIds);
  const completedCourseSteps = courses.filter((c) => completedSet.has(c.id)).length;
  const firstOpen = courses.find((c) => !completedSet.has(c.id));
  return {
    resumeId,
    resumeLabel,
    matchPercent,
    taleId,
    totalCourseSteps: courses.length,
    completedCourseSteps,
    currentCourseTitle: firstOpen?.title ?? null,
  };
}
