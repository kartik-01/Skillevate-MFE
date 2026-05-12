import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PlaySquare,
} from "lucide-react";
import {
  completeCourse,
  syncAnalysis,
  type CoursePayload,
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

type Course = {
  id: string;
  title: string;
  url: string;
  target: string;
  skill: string;
  description: string;
  provider: string;
  providerDetail: string;
  thumbnail: string;
  duration: string;
  xp: number;
};

type SkillPage = {
  skill: string;
  total_results: number;
  recommendations: Course[];
};

type UserRecommendation = {
  recommendation_id: string;
  title: string;
  provider: string;
  url: string;
  description: string;
  tags: string[];
  relevance_score: number;
  status: string;
  xp_value: number;
  linked_gap: string;
};

type UserRecommendationResponse = {
  analysis_id: string;
  user_id: string;
  gaps: string[];
  recommendations: UserRecommendation[];
  cached: boolean;
};

type SkillRequest = {
  skill: string;
  preferences: string[];
};

const ANALYSIS_STATE_STORAGE_KEY = "skillevate-analysis-state-v1";
const RECOMMENDATION_REQUEST_STORAGE_KEY = "skillevate-recommendation-request-v1";
// Injected by webpack `DefinePlugin` from `Skillevate-MFE/.env`. We don't
// fall back to a localhost URL so misconfigurations fail loudly at the
// network layer instead of pointing at a wrong service.
const RECOMMENDATION_API_URL =
  process.env.SKILLEVATE_RECOMMENDATION_URL ||
  "https://shark-app-yuqy7.ondigitalocean.app/api/user-recommendations";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "";

const reactImg =
  "https://images.unsplash.com/photo-1649451844931-57e22fc82de3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2RpbmclMjByZWFjdCUyMGludGVyZmFjZSUyMHNjcmVlbnxlbnwxfHx8fDE3NzM3OTQwNzB8MA&ixlib=rb-4.1.0&q=80&w=1080";
const nodeImg =
  "https://images.unsplash.com/photo-1667264501379-c1537934c7ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXRhYmFzZSUyMHNlcnZlciUyMGJhY2tlbmR8ZW58MXx8fHwxNzczNzk0MDczfDA&ixlib=rb-4.1.0&q=80&w=1080";
const uiImg =
  "https://images.unsplash.com/photo-1622117523535-ecb446c0c1ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1aSUyMGRlc2lnbiUyMHdpcmVmcmFtZXMlMjBkZXNrfGVufDF8fHx8MTc3Mzc5NDA3N3ww&ixlib=rb-4.1.0&q=80&w=1080";

function CourseImage({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  return hasError ? (
    <div className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-500">
      Course Preview
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

function analysisIdFor(analysis: AnalysisResult) {
  return analysis.createdAt || `analysis-${analysis.matchPercent}-${analysis.gaps.map((gap) => gap.name).join("|")}`;
}

function getPlaceholderImage(skill: string) {
  const normalized = skill.toLowerCase();
  if (normalized.includes("docker") || normalized.includes("kubernetes")) return nodeImg;
  if (normalized.includes("design") || normalized.includes("ui")) return uiImg;
  return reactImg;
}

function buildSkillRequests(gaps: AnalysisResult["gaps"]): SkillRequest[] {
  return gaps.map((gap) => {
    const tokens = gap.match
      .split(/[,;/]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      skill: gap.name.toLowerCase().replace(/\s+/g, " ").trim(),
      preferences: [gap.priority === "High" ? "priority-high" : "priority-medium", ...tokens].slice(0, 12),
    };
  });
}

function buildFallbackRecommendationRequest(gaps: AnalysisResult["gaps"]): RecommendationRequestBody {
  return {
    skills: buildSkillRequests(gaps),
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
    const req = stored[resumeId] ?? null;
    // Discard stale requests that have no skills (would cause 422 on recommendation API)
    return req && req.skills.length > 0 ? req : null;
  } catch {
    return null;
  }
}

function normalizeRecommendationTitle(title: string) {
  return title
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\s+|\s+$/g, "");
}

function mapUserRecommendationsToSkillPages(response: UserRecommendationResponse): SkillPage[] {
  const grouped = response.gaps.reduce<Record<string, UserRecommendation[]>>((acc, gap) => {
    acc[gap] = [];
    return acc;
  }, {});

  response.recommendations.forEach((item) => {
    const gap = item.linked_gap || "General";
    if (!grouped[gap]) grouped[gap] = [];
    grouped[gap].push(item);
  });

  return Object.entries(grouped).map(([skill, recommendations]) => ({
    skill,
    total_results: recommendations.length,
    recommendations: recommendations.map((rec) => ({
      id: rec.recommendation_id,
      title: normalizeRecommendationTitle(rec.title),
      url: rec.url,
      target: skill,
      skill,
      description: rec.description,
      provider: rec.provider,
      providerDetail: rec.provider,
      thumbnail: getPlaceholderImage(skill),
      duration: "N/A",
      xp: rec.xp_value,
    })),
  }));
}

async function fetchUserRecommendations(userId: string, signal: AbortSignal) {
  const response = await fetch(RECOMMENDATION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Recommendation API status ${response.status}`);
  }
  return (await response.json()) as UserRecommendationResponse;
}

export function LearningApp() {
  const { getAccessTokenSilently, isAuthenticated, user } = useAuth0();
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [analysisByResumeId, setAnalysisByResumeId] = useState<Record<string, AnalysisResult>>({});
  const [jobDescription, setJobDescription] = useState("");
  const [skillPages, setSkillPages] = useState<SkillPage[]>([]);
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentRecommendationIndex, setCurrentRecommendationIndex] = useState(0);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [apiGaps, setApiGaps] = useState<string[]>([]);
  const [completionFeedback, setCompletionFeedback] = useState("");
  const [completingCourseId, setCompletingCourseId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const getAccessToken = () => {
    if (AUTH0_AUDIENCE) {
      return getAccessTokenSilently({ authorizationParams: { audience: AUTH0_AUDIENCE } });
    }
    return getAccessTokenSilently();
  };

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
      setJobDescription(parsed.jobDescription ?? "");
    } catch {
      // Ignore malformed state and keep defaults.
    }
  }, []);

  const selectedResume = useMemo(
    () => resumeVersions.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumeVersions, selectedResumeId],
  );
  const selectedAnalysis = selectedResumeId ? analysisByResumeId[selectedResumeId] : undefined;
  const analysisId = selectedAnalysis ? analysisIdFor(selectedAnalysis) : "";
  const recommendationRequest = useMemo(() => {
    if (!selectedResumeId || !selectedAnalysis) return null;
    return readStoredRecommendationRequest(selectedResumeId) ?? (selectedAnalysis.gaps.length > 0 ? buildFallbackRecommendationRequest(selectedAnalysis.gaps) : null);
  }, [selectedResumeId, selectedAnalysis]);
  const totalSkillPages = Math.max(1, skillPages.length);
  const currentSkillPage = skillPages[currentSkillIndex] ?? null;
  const totalCourses = skillPages.reduce((sum, page) => sum + page.recommendations.length, 0);
  const courseStatusById = useMemo(
    () => new Map((progress?.courses ?? []).map((course) => [course.courseId, course.status])),
    [progress],
  );

  useEffect(() => {
    const userId = user?.sub;
    if (!isAuthenticated || !userId) {
      setSkillPages([]);
      setApiGaps([]);
      setCurrentSkillIndex(0);
      setCurrentRecommendationIndex(0);
      return;
    }

    const controller = new AbortController();
    setIsLoadingCourses(true);
    setApiGaps([]);

    fetchUserRecommendations(userId, controller.signal)
      .then((response) => {
        setApiGaps(response.gaps ?? []);
        setSkillPages(mapUserRecommendationsToSkillPages(response));
        setCurrentSkillIndex(0);
        setCurrentRecommendationIndex(0);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch learning path recommendations:", error);
        setSkillPages([]);
        setApiGaps([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingCourses(false);
      });

    return () => controller.abort();
  }, [isAuthenticated, user?.sub]);

  useEffect(() => {
    if (!selectedResume || !selectedAnalysis || !isAuthenticated || skillPages.length === 0) return;

    const courses: CoursePayload[] = skillPages.flatMap((page) =>
      page.recommendations.map((c) => ({
        courseId: c.id,
        title: c.title,
        url: c.url,
        provider: c.provider,
        providerDetail: c.providerDetail,
        description: c.description,
        targetSkill: c.skill,
        relevanceScore: 0.5,
        xp: c.xp,
      })),
    );

    let isActive = true;
    setStatusMessage("Syncing gamification progress...");
    getAccessToken()
      .then((token) =>
        syncAnalysis(token, {
          resumeId: selectedResume.id,
          resumeLabel: selectedResume.label,
          analysisId,
          matchPercent: selectedAnalysis.matchPercent,
          gaps: selectedAnalysis.gaps,
          jobDescription,
          recommendationRequest,
          courses,
        }),
      )
      .then((nextProgress) => {
        if (!isActive) return;
        setProgress(nextProgress);
        setStatusMessage("");
      })
      .catch((error) => {
        if (!isActive) return;
        setProgress(null);
        setStatusMessage(error instanceof Error ? error.message : "Unable to sync gamification progress.");
      });

    return () => {
      isActive = false;
    };
  }, [selectedResume?.id, selectedAnalysis, analysisId, jobDescription, isAuthenticated, recommendationRequest, skillPages]);

  useEffect(() => {
    setCurrentRecommendationIndex(0);
  }, [currentSkillIndex]);

  useEffect(() => {
    if (!currentSkillPage || !carouselRef.current) return;
    const cards = carouselRef.current.querySelectorAll<HTMLDivElement>(".recommendation-card");
    cards[currentRecommendationIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentRecommendationIndex, currentSkillPage]);

  useEffect(() => {
    if (!completionFeedback) return;
    const timer = window.setTimeout(() => setCompletionFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [completionFeedback]);

  const markCourseCompleted = async (course: Course) => {
    if (!selectedResume || !selectedAnalysis || completingCourseId) return;
    const status = courseStatusById.get(course.id);
    if (status === "complete" || status === "locked" || !progress) return;

    setCompletingCourseId(course.id);
    try {
      const token = await getAccessToken();
      const nextProgress = await completeCourse(token, course.id, selectedResume.id, analysisId);
      setProgress(nextProgress);
      setCompletionFeedback(`Completed ${course.title} (+${course.xp} XP)`);
      window.dispatchEvent(new Event("skillevate-gamification-updated"));
    } catch (error) {
      setCompletionFeedback(error instanceof Error ? error.message : "Unable to complete course.");
    } finally {
      setCompletingCourseId(null);
    }
  };

  const hasAnyAnalysis = Object.keys(analysisByResumeId).length > 0;
  const hasRecommendations = skillPages.length > 0;
  const gapsToDisplay = apiGaps.length > 0
    ? apiGaps
    : selectedAnalysis?.gaps.map((gap) => gap.name) ?? [];
  const resumeLabel = selectedResume?.label ?? "your account";

  if (!hasAnyAnalysis && !hasRecommendations) {
    return (
      <div className="glass-card rounded-3xl border border-border/60 p-8 text-center animate-slide-in-up">
        <p className="font-semibold text-foreground">No learning recommendations yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Run gap analysis first or make sure your account has recommendations available.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-slide-in-up">
      <div className="glass-card flex flex-col gap-4 rounded-3xl border border-border/60 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recommended Learning Path</h2>
          <p className="mt-1 text-sm text-muted-foreground">AI-curated courses specifically to close your skill gaps.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">For resume</span>
            {resumeVersions.length > 1 ? (
              <select
                value={selectedResumeId}
                onChange={(event) => setSelectedResumeId(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 md:w-auto"
                aria-label="Select resume version for learning recommendations"
              >
                {resumeVersions.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-semibold text-foreground">{resumeLabel}</span>
            )}
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-primary sm:flex">
          <BookOpen size={16} />
          {totalCourses} recommendations - {progress?.earnedXp ?? 0} XP Earned
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
          {statusMessage}
        </div>
      ) : null}

      {completionFeedback ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {completionFeedback}
        </div>
      ) : null}

      <div className="glass-card rounded-3xl border border-border/60 p-6">
        <h3 className="mb-4 font-semibold text-foreground">Analysis Context</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 size={15} className="text-[#1DB896]" />
              Verified Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedAnalysis?.verifiedSkills.length ? (
                selectedAnalysis.verifiedSkills.map((skill) => (
                  <span key={skill} className="rounded-lg border border-border bg-accent px-3 py-1.5 text-xs text-foreground">
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No local analysis available.</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle size={15} className="text-amber-500" />
              Skill Gaps
            </p>
            <div className="flex flex-wrap gap-2">
              {gapsToDisplay.length > 0 ? (
                gapsToDisplay.map((gap) => (
                  <span key={gap} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                    {gap}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No gap data available yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoadingCourses ? (
        <div className="glass-card rounded-3xl border border-border/60 p-10 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <Loader2 size={20} className="animate-spin" />
          </div>
          <p className="font-semibold text-foreground">Finding best courses for {resumeLabel}...</p>
        </div>
      ) : currentSkillPage && currentSkillPage.recommendations.length > 0 ? (
        <>
          <div className="flex flex-col gap-3" style={{ maxHeight: "calc(100vh - 320px)", minHeight: 0 }}>
            <div className="glass-card flex-shrink-0 rounded-2xl border border-border/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{currentSkillPage.skill}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {currentSkillPage.total_results} recommendations - viewing {currentRecommendationIndex + 1} of{" "}
                    {currentSkillPage.recommendations.length}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentSkillIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSkillIndex === 0}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    Prev Skill
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {currentSkillIndex + 1} / {totalSkillPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentSkillIndex((prev) => Math.min(totalSkillPages - 1, prev + 1))}
                    disabled={currentSkillIndex === totalSkillPages - 1}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    Next Skill
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentRecommendationIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentRecommendationIndex === 0}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30"
                aria-label="Previous recommendation"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60">
                <div
                  ref={carouselRef}
                  className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {currentSkillPage.recommendations.map((course) => {
                    const courseStatus = courseStatusById.get(course.id);
                    const isComplete = courseStatus === "complete";
                    const isLocked = courseStatus === "locked" || !progress;
                    return (
                      <div
                        key={course.id}
                        className="recommendation-card flex w-full flex-shrink-0 snap-start items-center justify-center p-4"
                        style={{ minWidth: "100%" }}
                      >
                        <div className="glass-card group flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border/60 transition-shadow hover:shadow-lg">
                          <div className="relative h-20 flex-shrink-0 overflow-hidden">
                            <CourseImage src={course.thumbnail} alt={course.title} />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="flex h-9 w-9 scale-90 items-center justify-center rounded-full bg-[#1DB896] text-white shadow-lg transition-transform group-hover:scale-100">
                                <PlaySquare size={16} className="ml-0.5" />
                              </div>
                            </div>
                            <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                              {course.duration}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="max-w-[60%] truncate rounded border border-[#1DB896]/20 bg-[#F0F9F7] px-2 py-0.5 text-xs font-bold text-[#1DB896]">
                                {course.target}
                              </span>
                              <span className="whitespace-nowrap rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-500">
                                +{course.xp} XP
                              </span>
                            </div>

                            <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
                              <a href={course.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-primary">
                                {course.title}
                              </a>
                            </h3>

                            <div className="flex h-5 items-center gap-1.5">
                              <span className="max-w-[70%] truncate rounded-full bg-[#1DB896] px-2 py-0.5 text-xs font-semibold text-white">
                                {course.providerDetail || course.provider}
                              </span>
                              {course.providerDetail && course.providerDetail !== course.provider ? (
                                <span className="truncate text-xs text-muted-foreground">{course.provider}</span>
                              ) : null}
                            </div>

                            <div className="h-8 overflow-hidden">
                              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{course.description}</p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => window.open(course.url, "_blank")}
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-border py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                              >
                                Start Course <ArrowUpRight size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => markCourseCompleted(course)}
                                disabled={isComplete || isLocked || completingCourseId === course.id}
                                className="flex-1 cursor-pointer rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                              >
                                {isComplete
                                  ? "Done"
                                  : isLocked
                                    ? "Locked"
                                    : completingCourseId === course.id
                                      ? "Saving..."
                                      : `Complete (+${course.xp} XP)`}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentRecommendationIndex((prev) =>
                    Math.min((currentSkillPage?.recommendations.length ?? 1) - 1, prev + 1),
                  )
                }
                disabled={currentRecommendationIndex >= (currentSkillPage?.recommendations.length ?? 1) - 1}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30"
                aria-label="Next recommendation"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {currentSkillPage.recommendations.map((_, indicatorIndex) => (
              <button
                key={indicatorIndex}
                type="button"
                onClick={() => setCurrentRecommendationIndex(indicatorIndex)}
                className={`h-2 rounded-full transition-all ${
                  indicatorIndex === currentRecommendationIndex ? "w-10 bg-foreground" : "w-6 bg-slate-300"
                }`}
                aria-label={`Go to recommendation ${indicatorIndex + 1}`}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="glass-card rounded-3xl border border-border/60 p-8 text-center">
          <p className="font-semibold text-foreground">No recommendations returned.</p>
          <p className="mt-2 text-sm text-muted-foreground">Try running gap analysis again with more specific gaps.</p>
        </div>
      )}
    </div>
  );
}
