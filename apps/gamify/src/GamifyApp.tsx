import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Award, CheckCircle2, ExternalLink, Lock, Loader2, Star, Target, Zap } from "lucide-react";
import { motion } from "framer-motion";
import {
  completeCourse,
  syncAnalysis,
  type GamificationAchievement,
  type GamificationProgress,
  type RecommendationRequestBody,
} from "./gamificationApi";

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

const ANALYSIS_STATE_STORAGE_KEY = "skillevate-analysis-state-v1";
const RECOMMENDATION_REQUEST_STORAGE_KEY = "skillevate-recommendation-request-v1";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "";

function formatRelativeTime(timestamp: string) {
  const timeMs = new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor((Date.now() - timeMs) / (1000 * 60)));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function analysisIdFor(analysis: AnalysisResult) {
  return analysis.createdAt || `analysis-${analysis.matchPercent}-${analysis.gaps.map((gap) => gap.name).join("|")}`;
}

function iconForAchievement(id: string) {
  if (id === "first-gap-closed") return CheckCircle2;
  if (id === "fast-learner") return Zap;
  if (id === "perfect-match") return Star;
  return Target;
}

function readAnalysisSelection(): {
  resume: ResumeVersion | null;
  analysis: AnalysisResult | undefined;
  jobDescription: string;
} {
  if (typeof window === "undefined") return { resume: null, analysis: undefined, jobDescription: "" };
  try {
    const raw = window.localStorage.getItem(ANALYSIS_STATE_STORAGE_KEY);
    if (!raw) return { resume: null, analysis: undefined, jobDescription: "" };
    const parsed = JSON.parse(raw) as PersistedAnalysisState;
    const resumes = Array.isArray(parsed.resumeVersions) ? parsed.resumeVersions : [];
    const selectedId =
      resumes.some((resume) => resume.id === parsed.selectedResumeId) && parsed.selectedResumeId
        ? parsed.selectedResumeId
        : resumes[resumes.length - 1]?.id ?? "";
    return {
      resume: resumes.find((resume) => resume.id === selectedId) ?? null,
      analysis: selectedId ? parsed.analysisByResumeId?.[selectedId] : undefined,
      jobDescription: parsed.jobDescription ?? "",
    };
  } catch {
    return { resume: null, analysis: undefined, jobDescription: "" };
  }
}

function buildFallbackRecommendationRequest(gaps: AnalysisResult["gaps"]): RecommendationRequestBody {
  return {
    skills: gaps.map((gap) => {
      const tokens = gap.match
        .split(/[,;/]/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        skill: gap.name.toLowerCase().replace(/\s+/g, " ").trim(),
        preferences: [gap.priority === "High" ? "priority-high" : "priority-medium", ...tokens].slice(0, 12),
      };
    }),
    max_results: 10,
    language: "en",
  };
}

function readStoredRecommendationRequest(resumeId: string): RecommendationRequestBody | null {
  if (typeof window === "undefined" || !resumeId) return null;
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_REQUEST_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Record<string, RecommendationRequestBody>;
    return stored[resumeId] ?? null;
  } catch {
    return null;
  }
}

export function GamifyApp() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [selectionTick, setSelectionTick] = useState(0);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [completingCourseId, setCompletingCourseId] = useState<string | null>(null);

  const { resume, analysis, jobDescription } = useMemo(readAnalysisSelection, [selectionTick]);
  const analysisId = analysis ? analysisIdFor(analysis) : "";
  const recommendationRequest = useMemo(() => {
    if (!resume || !analysis) return null;
    return readStoredRecommendationRequest(resume.id) ?? (analysis.gaps.length > 0 ? buildFallbackRecommendationRequest(analysis.gaps) : null);
  }, [resume?.id, analysis]);

  const getAccessToken = () => {
    if (AUTH0_AUDIENCE) {
      return getAccessTokenSilently({ authorizationParams: { audience: AUTH0_AUDIENCE } });
    }
    return getAccessTokenSilently();
  };

  const loadProgress = async () => {
    if (!resume || !analysis || !isAuthenticated) return;
    setIsLoading(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const nextProgress = await syncAnalysis(token, {
        resumeId: resume.id,
        resumeLabel: resume.label,
        analysisId,
        matchPercent: analysis.matchPercent,
        gaps: analysis.gaps,
        jobDescription,
        recommendationRequest,
      });
      setProgress(nextProgress);
    } catch (error) {
      setProgress(null);
      setMessage(error instanceof Error ? error.message : "Unable to load gamification progress.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [resume?.id, analysis, analysisId, jobDescription, isAuthenticated, recommendationRequest]);

  useEffect(() => {
    const refresh = () => {
      setSelectionTick((tick) => tick + 1);
      loadProgress();
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("skillevate-gamification-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("skillevate-gamification-updated", refresh);
    };
  }, [resume?.id, analysis, analysisId, jobDescription, isAuthenticated, recommendationRequest]);

  const progressPercent = progress ? Math.min(100, Math.round((progress.totalXp / progress.nextLevelXp) * 100)) : 0;
  const remainingToNextLevel = progress ? Math.max(0, progress.nextLevelXp - progress.totalXp) : 0;
  const completedCount = progress?.courses.filter((course) => course.status === "complete").length ?? 0;
  const unlockedAchievements = progress?.achievements.filter((achievement) => achievement.unlocked).length ?? 0;

  const handleComplete = async (courseId: string) => {
    if (!resume || !analysis || !progress || completingCourseId) return;
    setCompletingCourseId(courseId);
    setMessage("");
    try {
      const token = await getAccessToken();
      const nextProgress = await completeCourse(token, courseId, resume.id, analysisId);
      setProgress(nextProgress);
      window.dispatchEvent(new Event("skillevate-gamification-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete course.");
    } finally {
      setCompletingCourseId(null);
    }
  };

  if (!resume || !analysis) {
    return (
      <div className="glass-card rounded-3xl border border-border/60 p-8 text-center">
        <p className="font-semibold text-foreground">No main story yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Run Skill Analysis first, then open My Progress to generate your backend-managed gamification path.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 animate-slide-in-up lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <div className="gradient-primary relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-sm">
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-black/10 blur-2xl" />

          <div className="relative z-10">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-white/30 bg-white/20 shadow-inner backdrop-blur-sm">
              {isLoading ? <Loader2 size={40} className="animate-spin text-white" /> : <Award size={40} className="text-white drop-shadow-md" />}
            </div>
            <h2 className="mb-1 text-2xl font-semibold">Level {progress?.level ?? 4}</h2>
            <p className="mb-6 text-sm font-medium text-[#F0F9F7]">Backend Progress</p>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
              <div className="mb-2 flex justify-between text-xs font-bold">
                <span>Total XP</span>
                <span>
                  {(progress?.totalXp ?? 1200).toLocaleString()} / {(progress?.nextLevelXp ?? 2000).toLocaleString()}
                </span>
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-black/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full rounded-full bg-white"
                />
              </div>
              <p className="text-xs text-white/80">{remainingToNextLevel.toLocaleString()} XP to next level</p>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
            {message}
          </div>
        ) : null}

        <div className="glass-card rounded-3xl border border-border/60 p-6">
          <h3 className="mb-4 font-semibold text-foreground">Recent Activity</h3>
          <div className="space-y-4">
            {progress?.recentActivity.length ? (
              progress.recentActivity.slice(0, 3).map((activity) => (
                <div key={`${activity.courseId}-${activity.completedAt}`} className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#1DB896]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Completed "{activity.title}"</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(activity.completedAt)} -{" "}
                      <span className="font-bold text-[#1DB896]">+{activity.xp} XP</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Complete recommended resources to start earning XP.</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <div className="glass-card rounded-3xl border border-border/60 p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Course Path</h2>
              <p className="text-sm text-muted-foreground">
                {resume.label} - {completedCount}/{progress?.courses.length ?? 0} courses complete -{" "}
                {Math.round(analysis.matchPercent)}% JD match
              </p>
            </div>
            <button
              type="button"
              onClick={loadProgress}
              disabled={isLoading}
              className="w-fit rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="space-y-3">
            {progress?.courses.length ? (
              progress.courses.map((course, index) => (
                <div
                  key={course.courseId}
                  className={`rounded-2xl border p-4 transition-colors ${
                    course.status === "complete"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : course.status === "current"
                        ? "border-primary/30 bg-accent/60"
                        : "border-border bg-secondary/30 opacity-75"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-bold text-muted-foreground">
                          Step {index + 1}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">
                          +{course.xp} XP
                        </span>
                        <span className="rounded-full bg-[#F0F9F7] px-2 py-0.5 text-xs font-bold text-[#1DB896]">
                          {course.targetSkill}
                        </span>
                      </div>
                      <h3 className="line-clamp-2 font-semibold text-foreground">{course.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{course.providerDetail || course.provider}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {course.url ? (
                        <button
                          type="button"
                          onClick={() => window.open(course.url, "_blank")}
                          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                        >
                          Open <ExternalLink size={13} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleComplete(course.courseId)}
                        disabled={course.status !== "current" || completingCourseId === course.courseId}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                      >
                        {course.status === "complete" ? (
                          <>
                            <CheckCircle2 size={13} /> Done
                          </>
                        ) : course.status === "locked" ? (
                          <>
                            <Lock size={13} /> Locked
                          </>
                        ) : completingCourseId === course.courseId ? (
                          "Saving..."
                        ) : (
                          "Complete"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="font-semibold text-foreground">No backend course path yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The gamification backend will create one after it can reach the recommendation API.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-3xl border border-border/60 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Badges & Achievements</h2>
            <div className="text-sm font-semibold text-muted-foreground">
              <span className="text-[#1DB896]">{unlockedAchievements}</span> / {progress?.achievements.length ?? 0} Unlocked
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(progress?.achievements ?? []).map((achievement: GamificationAchievement) => {
              const Icon = iconForAchievement(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`rounded-2xl border-2 p-5 transition-all ${
                    achievement.unlocked
                      ? "border-[#1DB896] bg-[#F0F9F7] dark:bg-[#0c2d2a]/75"
                      : "border-border bg-secondary/40 opacity-70 grayscale"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                        achievement.unlocked
                          ? "bg-white text-[#1DB896] shadow-sm dark:bg-white/10 dark:text-[#5fe0c5]"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${achievement.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                        {achievement.title}
                      </h3>
                      <p className="mt-1 text-sm leading-tight text-muted-foreground">{achievement.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
