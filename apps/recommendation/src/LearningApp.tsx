import React, { useEffect, useMemo, useState } from "react";
import { PlaySquare, BookOpen, ArrowUpRight, AlertTriangle, CheckCircle2, Map } from "lucide-react";
import {
  buildMainStoryMeta,
  buildStoryNodes,
  computeTaleId,
  GAMIFY_PROGRESS_STORAGE_KEY,
  getTaleSlice,
  storyCoursesFromBatchMock,
  thumbnailForStoryCourse,
  upsertTaleSlice,
  type TaleGamifySlice,
} from "@skillevate/main-story";

type ResumeVersion = {
  id: string;
  version: number;
  label: string;
  originalFileName: string;
  uploadedAt: string;
};

type AnalysisResult = {
  matchPercent: number;
  verifiedSkills: string[];
  gaps: Array<{ name: string; priority: "High" | "Medium"; match: string }>;
  createdAt: string;
};

type PersistedAnalysisState = {
  resumeVersions: ResumeVersion[];
  selectedResumeId: string;
  analysisByResumeId: Record<string, AnalysisResult>;
  jobDescription: string;
};

type Course = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  fillsGap: string;
  xp: number;
  url?: string;
};

type CompletedCourseActivity = {
  courseId: string;
  title: string;
  xp: number;
  completedAt: string;
  resumeLabel: string;
};

const ANALYSIS_STATE_STORAGE_KEY = "skillevate-analysis-state-v1";
const SKILLEVATE_LOCAL_STORE_EVENT = "skillevate-local-store";

function CourseImage({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  return hasError ? (
    <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-semibold">
      Course Preview
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

export function LearningApp() {
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [analysisByResumeId, setAnalysisByResumeId] = useState<Record<string, AnalysisResult>>({});
  const [earnedXp, setEarnedXp] = useState(0);
  const [completedCourseIds, setCompletedCourseIds] = useState<string[]>([]);
  const [completionFeedback, setCompletionFeedback] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawState = window.localStorage.getItem(ANALYSIS_STATE_STORAGE_KEY);
      if (!rawState) return;

      const parsed = JSON.parse(rawState) as PersistedAnalysisState;
      const restoredResumes = Array.isArray(parsed.resumeVersions) ? parsed.resumeVersions : [];
      const restoredSelectedId =
        restoredResumes.some((resume) => resume.id === parsed.selectedResumeId) && parsed.selectedResumeId
          ? parsed.selectedResumeId
          : restoredResumes[restoredResumes.length - 1]?.id ?? "";

      setResumeVersions(restoredResumes);
      setSelectedResumeId(restoredSelectedId);
      setAnalysisByResumeId(parsed.analysisByResumeId ?? {});
    } catch {
      // Ignore malformed state and keep defaults.
    }
  }, []);

  const selectedResume = useMemo(
    () => resumeVersions.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumeVersions, selectedResumeId],
  );
  const selectedAnalysis = selectedResumeId ? analysisByResumeId[selectedResumeId] : undefined;

  const storyCourses = useMemo(
    () => (selectedAnalysis ? storyCoursesFromBatchMock(selectedAnalysis.gaps, { maxCourses: 10 }) : []),
    [selectedAnalysis],
  );

  const recommendedCourses = useMemo<Course[]>(
    () =>
      storyCourses.map((c) => ({
        ...c,
        channel: c.provider ?? "Resource",
        thumbnail: thumbnailForStoryCourse(c.id),
        duration: "—",
      })),
    [storyCourses],
  );

  const taleId = useMemo(() => {
    if (!selectedResume || !selectedAnalysis) return "";
    return computeTaleId(
      selectedResume.id,
      selectedAnalysis.gaps,
      storyCourses.map((c) => c.id),
    );
  }, [selectedResume, selectedAnalysis, storyCourses]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedResume || !taleId) {
      setEarnedXp(0);
      setCompletedCourseIds([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(GAMIFY_PROGRESS_STORAGE_KEY);
      const { slice, normalizedRaw } = getTaleSlice(raw, selectedResume.id, taleId);
      if (normalizedRaw) {
        window.localStorage.setItem(GAMIFY_PROGRESS_STORAGE_KEY, normalizedRaw);
      }
      setEarnedXp(slice.earnedXp);
      setCompletedCourseIds(slice.completedCourseIds);
    } catch {
      setEarnedXp(0);
      setCompletedCourseIds([]);
    }
  }, [selectedResume?.id, taleId]);

  const mainStoryMeta = useMemo(() => {
    if (!selectedResume || !selectedAnalysis) return null;
    return buildMainStoryMeta(
      selectedResume.id,
      selectedResume.label,
      selectedAnalysis.matchPercent,
      selectedAnalysis.gaps,
      storyCourses,
      completedCourseIds,
    );
  }, [selectedResume, selectedAnalysis, storyCourses, completedCourseIds]);

  const storyNodes = useMemo(
    () => buildStoryNodes(storyCourses, completedCourseIds),
    [storyCourses, completedCourseIds],
  );

  const currentStoryBeat = useMemo(() => storyNodes.find((n) => n.status === "current"), [storyNodes]);

  useEffect(() => {
    if (!completionFeedback) return;

    const timer = window.setTimeout(() => setCompletionFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [completionFeedback]);

  const hasAnyAnalysis = Object.keys(analysisByResumeId).length > 0;

  const markCourseCompleted = (course: Course) => {
    if (!selectedResume || !taleId || completedCourseIds.includes(course.id)) return;

    const nextCompletedIds = [...completedCourseIds, course.id];
    const nextEarnedXp = earnedXp + course.xp;

    setCompletedCourseIds(nextCompletedIds);
    setEarnedXp(nextEarnedXp);
    setCompletionFeedback(`Completed ${course.title} (+${course.xp} XP)`);

    const nextActivity: CompletedCourseActivity = {
      courseId: course.id,
      title: course.title,
      xp: course.xp,
      completedAt: new Date().toISOString(),
      resumeLabel: selectedResume.label,
    };

    const previousRaw = window.localStorage.getItem(GAMIFY_PROGRESS_STORAGE_KEY);
    const { slice: previousSlice } = getTaleSlice(previousRaw, selectedResume.id, taleId);
    const previousActivities = previousSlice.completedActivities;

    const nextSlice: TaleGamifySlice = {
      earnedXp: nextEarnedXp,
      completedCourseIds: nextCompletedIds,
      completedActivities: [nextActivity, ...previousActivities].slice(0, 20),
    };

    const nextRaw = upsertTaleSlice(previousRaw, selectedResume.id, taleId, nextSlice);
    window.localStorage.setItem(GAMIFY_PROGRESS_STORAGE_KEY, nextRaw);
    window.dispatchEvent(new Event(SKILLEVATE_LOCAL_STORE_EVENT));
  };

  if (!hasAnyAnalysis || !selectedResume) {
    return (
      <div className="glass-card rounded-3xl p-8 border border-border/60 text-center animate-slide-in-up">
        <p className="text-foreground font-semibold">No learning recommendations yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Run gap analysis first to generate AI-curated courses for each resume version.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="glass-card rounded-3xl p-6 border border-border/60 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recommended Learning Path</h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI-curated resources (videos, repos, articles) matched to your skill gaps.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">For resume</span>
            {resumeVersions.length > 1 ? (
              <select
                value={selectedResumeId}
                onChange={(event) => setSelectedResumeId(event.target.value)}
                className="w-full md:w-auto rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-background"
                aria-label="Select resume version for learning recommendations"
              >
                {resumeVersions.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-semibold text-foreground">{selectedResume.label}</span>
            )}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary bg-accent px-4 py-2 rounded-xl">
          <BookOpen size={16} />
          {recommendedCourses.length} Courses Assigned • {earnedXp} XP Earned
        </div>
      </div>

      {completionFeedback ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {completionFeedback}
        </div>
      ) : null}

      {mainStoryMeta && storyCourses.length > 0 ? (
        <div className="glass-card rounded-3xl p-5 border border-primary/25 bg-gradient-to-br from-[#1DB896]/8 via-transparent to-transparent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1DB896]/15 text-[#1DB896]">
                <Map size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#1DB896]">Main story</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {mainStoryMeta.completedCourseSteps} / {mainStoryMeta.totalCourseSteps} courses on your path
                  {mainStoryMeta.matchPercent != null ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {Math.round(mainStoryMeta.matchPercent)}% JD match
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentStoryBeat?.kind === "course"
                    ? `Current step: ${currentStoryBeat.title}`
                    : currentStoryBeat?.kind === "epilogue"
                      ? "Current step: Re-run Skill Analysis to verify your gains"
                      : currentStoryBeat?.kind === "prologue"
                        ? "Open the first course below to begin."
                        : "Follow the path in My Progress."}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right sm:max-w-[200px]">
              Completing a course unlocks the next node in My Progress.
            </p>
          </div>
        </div>
      ) : null}

      <div className="glass-card rounded-3xl p-6 border border-border/60">
        <h3 className="font-semibold text-foreground mb-4">Analysis Context</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#1DB896]" />
              Verified Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedAnalysis?.verifiedSkills.map((skill) => (
                <span key={skill} className="px-3 py-1.5 bg-accent text-foreground text-xs rounded-lg border border-border">
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              Skill Gaps (Priority)
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedAnalysis?.gaps.map((gap) => (
                <span key={gap.name} className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-lg border border-amber-100">
                  {gap.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendedCourses.map((course) => (
          <div
            key={course.id}
            className="glass-card rounded-3xl overflow-hidden border border-border/60 hover:shadow-md transition-shadow group flex flex-col"
          >
            <div className="relative h-48 overflow-hidden">
              <CourseImage src={course.thumbnail} alt={course.title} />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 bg-[#1DB896] rounded-full flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                  <PlaySquare size={24} className="ml-1" />
                </div>
              </div>
              <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                {course.duration}
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-3 gap-2">
                <span className="text-xs font-bold text-[#1DB896] bg-[#F0F9F7] px-2 py-1 rounded-md line-clamp-1 border border-[#1DB896]/20">
                  Target: {course.fillsGap}
                </span>
                <span className="flex items-center text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md whitespace-nowrap">
                  +{course.xp} XP
                </span>
              </div>
              <h3 className="font-semibold text-foreground leading-tight mb-2 line-clamp-2">{course.title}</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-1">{course.channel}</p>

              {course.url ? (
                <a
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 border-2 border-border text-foreground rounded-xl font-semibold text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  Open resource <ArrowUpRight size={16} />
                </a>
              ) : (
                <button
                  type="button"
                  className="w-full py-3 border-2 border-border text-foreground rounded-xl font-semibold text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer opacity-70"
                  disabled
                >
                  No link available <ArrowUpRight size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={() => markCourseCompleted(course)}
                disabled={completedCourseIds.includes(course.id)}
                className="mt-2 w-full py-3 rounded-xl font-semibold text-sm border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              >
                {completedCourseIds.includes(course.id) ? "Completed" : `Mark as Completed (+${course.xp} XP)`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
