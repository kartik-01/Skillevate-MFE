export type StoryGap = {
  name: string;
  priority: "High" | "Medium";
  match: string;
};

export type StoryCourse = {
  id: string;
  title: string;
  fillsGap: string;
  xp: number;
  provider?: string;
  url?: string;
  resourceLabel?: string;
};

export type StoryNode =
  | {
      kind: "prologue";
      id: "prologue";
      title: string;
      body: string;
      status: "complete" | "pending";
    }
  | {
      kind: "course";
      id: string;
      courseId: string;
      title: string;
      fillsGap: string;
      xp: number;
      provider?: string;
      url?: string;
      resourceLabel?: string;
      status: "locked" | "current" | "complete";
    }
  | {
      kind: "epilogue";
      id: "epilogue";
      title: string;
      body: string;
      status: "locked" | "current" | "complete";
    };

export type MainStoryMeta = {
  resumeId: string;
  resumeLabel: string;
  matchPercent: number;
  taleId: string;
  totalCourseSteps: number;
  completedCourseSteps: number;
  currentCourseTitle: string | null;
};
