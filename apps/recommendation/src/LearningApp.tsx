import React, { useEffect, useMemo, useState } from "react";
import { PlaySquare, BookOpen, ArrowUpRight, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

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
  subtitle: string;
  description: string;
  provider: string;
  thumbnail: string;
  duration: string;
  xp: number;
};

type ApiRecommendation = {
  id: string;
  title: string;
  provider: string;
  url: string;
  description: string;
  tags: string[];
  relevance_score: number;
  stars: number | null;
  forks: number | null;
  published_at?: string;
  channel_name?: string | null;
  org_login?: string | null;
};

type ApiSkillResult = {
  skill: string;
  total_results: number;
  recommendations: ApiRecommendation[];
};

type ApiResponse = {
  results: ApiSkillResult[];
  metadata: {
    total_skills: number;
    language: string;
  };
};

type CompletedCourseActivity = {
  courseId: string;
  title: string;
  xp: number;
  completedAt: string;
  resumeLabel: string;
};

type PersistedGamifyProgress = {
  earnedXp: number;
  completedCourseIds: string[];
  completedActivities: CompletedCourseActivity[];
};

const ANALYSIS_STATE_STORAGE_KEY = "skillevate-analysis-state-v1";
const GAMIFY_PROGRESS_STORAGE_KEY = "skillevate-gamify-progress-v1";

const reactImg =
  "https://images.unsplash.com/photo-1649451844931-57e22fc82de3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2RpbmclMjByZWFjdCUyMGludGVyZmFjZSUyMHNjcmVlbnxlbnwxfHx8fDE3NzM3OTQwNzB8MA&ixlib=rb-4.1.0&q=80&w=1080";
const nodeImg =
  "https://images.unsplash.com/photo-1667264501379-c1537934c7ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXRhYmFzZSUyMHNlcnZlciUyMGJhY2tlbmR8ZW58MXx8fHwxNzczNzk0MDczfDA&ixlib=rb-4.1.0&q=80&w=1080";
const uiImg =
  "https://images.unsplash.com/photo-1622117523535-ecb446c0c1ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1aSUyMGRlc2lnbiUyMHdpcmVmcmFtZXMlMjBkZXNrfGVufDF8fHx8MTc3Mzc5NDA3N3ww&ixlib=rb-4.1.0&q=80&w=1080";

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

function getRandomPlaceholderImage(skill: string) {
  const normalized = skill?.toLowerCase?.() ?? "";
  if (normalized.includes("python")) return reactImg;
  if (normalized.includes("docker") || normalized.includes("kubernetes")) return nodeImg;
  if (normalized.includes("design") || normalized.includes("ui")) return uiImg;
  return reactImg;
}

function mapApiToCourses(apiResponse: ApiResponse): Course[] {
  return apiResponse.results.flatMap((item) =>
    item.recommendations.map((rec) => ({
      id: rec.id,
      title: rec.title,
      url: rec.url,
      target: item.skill,
      subtitle: rec.channel_name || rec.org_login || rec.provider,
      description: rec.description,
      provider: rec.provider,
      thumbnail: getRandomPlaceholderImage(item.skill),
      duration: "N/A",
      xp: Math.max(40, Math.round((rec.relevance_score || 0.2) * 200)),
    }))
  );
}

function fallbackCourseRecommendations(gaps: AnalysisResult["gaps"]): Course[] {
  const gapNameMap = new Set(gaps.map((gap) => gap.name.toLowerCase()));
  const courses: Course[] = [];

  if (gapNameMap.has("advanced typescript")) {
    courses.push({
      id: "ts-advanced",
      title: "Advanced TypeScript for React Developers",
      url: "#",
      target: "Advanced TypeScript",
      subtitle: "Code Mastery",
      description: "Hands-on TS for React developers.",
      provider: "Code Mastery",
      thumbnail: reactImg,
      duration: "1h 45m",
      xp: 150,
    });
  }

  if (gapNameMap.has("system design")) {
    courses.push({
      id: "system-design",
      title: "System Design Interview: Frontend Concepts",
      url: "#",
      target: "System Design",
      subtitle: "Tech Interview Pro",
      description: "System design oriented for frontend engineers.",
      provider: "Tech Interview Pro",
      thumbnail: uiImg,
      duration: "45m",
      xp: 100,
    });
  }

  if (gapNameMap.has("graphql")) {
    courses.push({
      id: "graphql-node",
      title: "GraphQL APIs with Node.js & Apollo",
      url: "#",
      target: "GraphQL",
      subtitle: "Backend Simplified",
      description: "Build GraphQL APIs with Node and Apollo.",
      provider: "Backend Simplified",
      thumbnail: nodeImg,
      duration: "2h 15m",
      xp: 200,
    });
  }

  if (courses.length === 0) {
    courses.push({
      id: "generic-frontend",
      title: "Modern Frontend Interview Preparation",
      url: "#",
      target: "General Upskilling",
      subtitle: "Career Sprint",
      description: "General interview prep for frontend roles.",
      provider: "Career Sprint",
      thumbnail: reactImg,
      duration: "1h 20m",
      xp: 120,
    });
  }

  return courses;
}

async function fetchSkillRecommendations(skills: string[], onResults: (courses: Course[]) => void, onError: () => void) {
  try {
    const body = {
      skills: skills.map((skill) => ({ skill, preferences: [] })),
      max_results: 5,
      language: "en",
    };

    const response = await fetch("http://localhost:8000/api/batch-recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API status ${response.status}`);
    }

    const apiData = (await response.json()) as ApiResponse;
    onResults(mapApiToCourses(apiData));
  } catch (error) {
    console.error("Failed to fetch learning path recommendations:", error);
    onError();
  }
}

export function LearningApp() {
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [analysisByResumeId, setAnalysisByResumeId] = useState<Record<string, AnalysisResult>>({});
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawProgress = window.localStorage.getItem(GAMIFY_PROGRESS_STORAGE_KEY);
      if (!rawProgress) return;

      const parsed = JSON.parse(rawProgress) as PersistedGamifyProgress;
      setEarnedXp(parsed.earnedXp ?? 0);
      setCompletedCourseIds(
        Array.isArray(parsed.completedCourseIds)
          ? parsed.completedCourseIds
              .filter((id): id is string => typeof id === "string")
              .map((id) => id)
          : []
      );
    } catch {
      // Ignore malformed persisted progress.
    }
  }, []);

  const selectedResume = useMemo(
    () => resumeVersions.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumeVersions, selectedResumeId],
  );
  const selectedAnalysis = selectedResumeId ? analysisByResumeId[selectedResumeId] : undefined;

  const totalPages = Math.max(1, Math.ceil(recommendedCourses.length / itemsPerPage));
  const paginatedCourses = useMemo(
    () => recommendedCourses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [recommendedCourses, currentPage, itemsPerPage],
  );

  useEffect(() => {
    if (!selectedAnalysis) {
      setRecommendedCourses([]);
      return;
    }

    setIsLoadingCourses(true);

    const preferredSkills = ["python", "docker"];
    // If you want to adapt to gap analysis skills, use selectedAnalysis.gaps map to skill names
    fetchSkillRecommendations(
      preferredSkills,
      (courses) => {
        setRecommendedCourses(courses);
        setCurrentPage(1);
        setIsLoadingCourses(false);
      },
      () => {
        const fallback = fallbackCourseRecommendations(selectedAnalysis.gaps);
        setRecommendedCourses(fallback);
        setCurrentPage(1);
        setIsLoadingCourses(false);
      }
    );
  }, [selectedAnalysis]);

  useEffect(() => {
    if (!completionFeedback) return;

    const timer = window.setTimeout(() => setCompletionFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [completionFeedback]);

  const hasAnyAnalysis = Object.keys(analysisByResumeId).length > 0;

  const markCourseCompleted = (course: Course) => {
    if (!selectedResume || completedCourseIds.includes(course.id)) return;

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
    const previous = previousRaw ? (JSON.parse(previousRaw) as PersistedGamifyProgress) : null;
    const previousActivities = previous?.completedActivities ?? [];

    const nextProgress: PersistedGamifyProgress = {
      earnedXp: nextEarnedXp,
      completedCourseIds: nextCompletedIds,
      completedActivities: [nextActivity, ...previousActivities].slice(0, 20),
    };

    window.localStorage.setItem(GAMIFY_PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
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
                AI-curated courses specifically to close your skill gaps.
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
              {recommendedCourses.length} total courses • page {currentPage}/{totalPages} • {earnedXp} XP Earned
            </div>
          </div>

          {completionFeedback ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {completionFeedback}
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

      {isLoadingCourses ? (
        <div className="glass-card rounded-3xl p-10 border border-border/60 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent text-primary mb-4">
            <Loader2 size={20} className="animate-spin" />
          </div>
          <p className="text-foreground font-semibold">Finding best courses for {selectedResume.label}...</p>
          <p className="text-sm text-muted-foreground mt-2">Matching your skill gaps with recommended learning content.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCourses.map((course) => (
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
                    Target: {course.target}
                  </span>
                  <span className="flex items-center text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md whitespace-nowrap">
                    +{course.xp} XP
                  </span>
                </div>
                <h3 className="font-semibold text-foreground leading-tight mb-2 line-clamp-2">
                  <a href={course.url} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                    {course.title}
                  </a>
                </h3>
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-800 bg-blue-100 border border-blue-200 px-2 py-1 rounded-md">
                    Platform: {course.provider}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{course.subtitle}</p>
                <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-3">{course.description}</p>

                <button
                  type="button"
                  onClick={() => window.open(course.url, "_blank")}
                  className="w-full py-3 border-2 border-border text-foreground rounded-xl font-semibold text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Start Course <ArrowUpRight size={16} />
                </button>

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

          {totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
