import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Crown,
  ExternalLink,
  Flag,
  Flame,
  Gem,
  Gift,
  Github,
  Globe,
  Lock,
  Loader2,
  Map,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  Youtube,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { buildMainStoryMeta, buildStoryNodes, type StoryNode } from "@skillevate/main-story";
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
  return analysis.createdAt || `analysis-${analysis.matchPercent}-${analysis.gaps.map((g) => g.name).join("|")}`;
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
      resumes.some((r) => r.id === parsed.selectedResumeId) && parsed.selectedResumeId
        ? parsed.selectedResumeId
        : resumes[resumes.length - 1]?.id ?? "";
    return {
      resume: resumes.find((r) => r.id === selectedId) ?? null,
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
      const tokens = gap.match.split(/[,;/]/).map((p) => p.trim()).filter(Boolean);
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
    const req = stored[resumeId] ?? null;
    return req && req.skills.length > 0 ? req : null;
  } catch {
    return null;
  }
}

// ── Quest UI helpers ──────────────────────────────────────────────────────────

const QUEST_ICONS = [Swords, Gem, Shield, Flame, Rocket, Crown] as const;
const QUEST_REALMS = [
  {
    name: "Foundry Ridge",
    accent: "#10b981",
    glow: "rgba(16,185,129,0.55)",
    label: "text-emerald-700 dark:text-emerald-300",
    chipBg: "bg-emerald-500/15",
  },
  {
    name: "Neon Harbor",
    accent: "#06b6d4",
    glow: "rgba(6,182,212,0.55)",
    label: "text-sky-700 dark:text-sky-300",
    chipBg: "bg-sky-500/15",
  },
  {
    name: "Arcane Vault",
    accent: "#8b5cf6",
    glow: "rgba(139,92,246,0.55)",
    label: "text-violet-700 dark:text-violet-300",
    chipBg: "bg-violet-500/15",
  },
  {
    name: "Ember Wastes",
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.55)",
    label: "text-amber-700 dark:text-amber-300",
    chipBg: "bg-amber-500/15",
  },
] as const;

function questIconFor(index: number) {
  return QUEST_ICONS[index % QUEST_ICONS.length];
}

function realmFor(index: number) {
  return QUEST_REALMS[index % QUEST_REALMS.length];
}

function useShellDarkMode(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const el = document.documentElement;
      const mo = new MutationObserver(onStoreChange);
      mo.observe(el, { attributes: true, attributeFilter: ["class"] });
      return () => mo.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

const QUEST_CARD_WIDTH_STYLE: React.CSSProperties = {
  width: "min(336px, calc(100vw - 2rem))",
  maxWidth: "calc(100vw - 2rem)",
  boxSizing: "border-box",
};

const QUEST_TITLE_CLAMP_STYLE: React.CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
  wordBreak: "break-word",
};

const ELLIPSIS_END: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const QUEST_MAP_EDGE_PAD_PX = 14;

function questCardWidthForContainer(containerWidthPx: number): number {
  if (containerWidthPx <= 0) return 336;
  return Math.min(336, Math.max(200, containerWidthPx - QUEST_MAP_EDGE_PAD_PX * 2));
}

function questCardHorizontalShiftPx(xPercent: number, containerWidthPx: number, cardWidthPx: number): number {
  if (containerWidthPx <= 0 || cardWidthPx <= 0) return 0;
  const centerPx = (xPercent / 100) * containerWidthPx;
  const half = cardWidthPx / 2;
  const minCenter = QUEST_MAP_EDGE_PAD_PX + half;
  const maxCenter = containerWidthPx - QUEST_MAP_EDGE_PAD_PX - half;
  if (minCenter >= maxCenter) return containerWidthPx / 2 - centerPx;
  const clamped = Math.min(Math.max(centerPx, minCenter), maxCenter);
  return clamped - centerPx;
}

const QUEST_PILL_FG = {
  complete: { light: "#065f46", dark: "#a7f3d0" },
  current: { light: "#d97706", dark: "#fde68a" },
  locked: { light: "#991b1b", dark: "#fca5a5" },
} as const;

function fgForStoryNode(node: StoryNode, dark: boolean): string {
  const bucket = node.status === "complete" ? "complete" : node.status === "current" ? "current" : "locked";
  const row = QUEST_PILL_FG[bucket];
  return dark ? row.dark : row.light;
}

function heroTier(totalXp: number): {
  name: string;
  next: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
} {
  if (totalXp >= 1800) return { name: "Legend", next: "—", icon: Crown };
  if (totalXp >= 1200) return { name: "Champion", next: "Legend", icon: Trophy };
  if (totalXp >= 600) return { name: "Ranger", next: "Champion", icon: Shield };
  return { name: "Apprentice", next: "Ranger", icon: Sparkles };
}

function ProviderMark({ provider }: { provider?: string }) {
  const p = (provider ?? "").toLowerCase();
  const Icon =
    p.includes("youtube") ? Youtube
    : p.includes("github") ? Github
    : p.includes("dev.to") ? BookOpen
    : Globe;
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      <Icon size={14} strokeWidth={2} aria-hidden />
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GamifyApp() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const prefersReducedMotion = useReducedMotion();
  const shellDark = useShellDarkMode();
  const [selectionTick, setSelectionTick] = useState(0);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [completingCourseId, setCompletingCourseId] = useState<string | null>(null);
  const [unlockFlash, setUnlockFlash] = useState<{ title: string; xp: number } | null>(null);
  const previousActivityId = useRef<string | null>(null);

  const { resume, analysis, jobDescription } = useMemo(readAnalysisSelection, [selectionTick]);
  const analysisId = analysis ? analysisIdFor(analysis) : "";
  const recommendationRequest = useMemo(() => {
    if (!resume || !analysis) return null;
    return readStoredRecommendationRequest(resume.id) ?? (analysis.gaps.length > 0 ? buildFallbackRecommendationRequest(analysis.gaps) : null);
  }, [resume?.id, analysis]);

  const getAccessToken = useCallback(() => {
    if (AUTH0_AUDIENCE) return getAccessTokenSilently({ authorizationParams: { audience: AUTH0_AUDIENCE } });
    return getAccessTokenSilently();
  }, [getAccessTokenSilently]);

  const loadProgress = useCallback(async () => {
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
      window.dispatchEvent(new CustomEvent("skillevate-xp-updated", {
        detail: { level: nextProgress.level, totalXp: nextProgress.totalXp, nextLevelXp: nextProgress.nextLevelXp },
      }));
    } catch (error) {
      setProgress(null);
      setMessage(error instanceof Error ? error.message : "Unable to load gamification progress.");
    } finally {
      setIsLoading(false);
    }
  }, [resume?.id, resume?.label, analysisId, analysis, jobDescription, isAuthenticated, recommendationRequest, getAccessToken]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    const refresh = () => {
      setSelectionTick((t) => t + 1);
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("skillevate-gamification-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("skillevate-gamification-updated", refresh);
    };
  }, []);

  // Detect new course completion via recentActivity and trigger unlock flash
  useEffect(() => {
    if (!progress?.recentActivity.length) return;
    const latest = progress.recentActivity[0];
    const latestId = `${latest.courseId}-${latest.completedAt}`;
    if (previousActivityId.current && previousActivityId.current !== latestId) {
      setUnlockFlash({ title: latest.title, xp: latest.xp });
    }
    previousActivityId.current = latestId;
  }, [progress?.recentActivity]);

  useEffect(() => {
    if (!unlockFlash) return;
    const timer = window.setTimeout(() => setUnlockFlash(null), 2600);
    return () => window.clearTimeout(timer);
  }, [unlockFlash]);

  const handleComplete = async (courseId: string) => {
    if (!resume || !analysis || !progress || completingCourseId) return;
    setCompletingCourseId(courseId);
    setMessage("");
    try {
      const token = await getAccessToken();
      const nextProgress = await completeCourse(token, courseId, resume.id, analysisId);
      setProgress(nextProgress);
      window.dispatchEvent(new Event("skillevate-gamification-updated"));
      window.dispatchEvent(new CustomEvent("skillevate-xp-updated", {
        detail: { level: nextProgress.level, totalXp: nextProgress.totalXp, nextLevelXp: nextProgress.nextLevelXp },
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete course.");
    } finally {
      setCompletingCourseId(null);
    }
  };

  // ── Bridge: backend progress → story data ────────────────────────────────

  const storyCourses = useMemo(() => {
    if (!progress?.courses.length) return [];
    return progress.courses.map((c) => ({
      id: c.courseId,
      title: c.title,
      fillsGap: c.targetSkill,
      xp: c.xp,
      provider: c.provider,
      url: c.url,
      resourceLabel: c.providerDetail || undefined,
    }));
  }, [progress?.courses]);

  const completedCourseIds = useMemo(
    () => (progress?.courses ?? []).filter((c) => c.status === "complete").map((c) => c.courseId),
    [progress?.courses],
  );

  const storyNodes = useMemo(
    () => buildStoryNodes(storyCourses, completedCourseIds),
    [storyCourses, completedCourseIds],
  );

  const meta = useMemo(() => {
    if (!resume || !analysis) return null;
    return buildMainStoryMeta(
      resume.id,
      resume.label,
      analysis.matchPercent,
      analysis.gaps,
      storyCourses,
      completedCourseIds,
    );
  }, [resume, analysis, storyCourses, completedCourseIds]);

  // ── Derived display values ────────────────────────────────────────────────

  const totalXp = progress?.totalXp ?? 0;
  const nextLevelXp = progress?.nextLevelXp ?? 600;
  const currentStreak = progress?.currentStreak ?? 0;
  const tier = heroTier(totalXp);
  const TIER_START_XP: Record<string, number> = { Apprentice: 0, Ranger: 600, Champion: 1200, Legend: 1800 };
  const currentTierStart = TIER_START_XP[tier.name] ?? 0;
  const progressPercent = tier.name === "Legend"
    ? 100
    : Math.min(100, Math.round(((totalXp - currentTierStart) / (nextLevelXp - currentTierStart)) * 100));
  const remainingToNextLevel = tier.name === "Legend" ? 0 : Math.max(0, nextLevelXp - totalXp);
  const TierIcon = tier.icon;

  const courseNodes = storyNodes.filter(
    (node): node is Extract<StoryNode, { kind: "course" }> => node.kind === "course",
  );
  const currentCourseNode = courseNodes.find((n) => n.status === "current");
  const completedCourses = courseNodes.filter((n) => n.status === "complete").length;
  const storyCompletion = courseNodes.length ? Math.round((completedCourses / courseNodes.length) * 100) : 0;

  const jdPreview =
    jobDescription.length > 120 ? `${jobDescription.slice(0, 120).trim()}…` : jobDescription;

  // ── Map layout ────────────────────────────────────────────────────────────

  const NODE_SPACING = 300;
  const NODE_TOP_PAD = 70;
  const NODE_BOTTOM_PAD = 150;
  const NODE_X_POSITIONS = [22, 50, 74] as const;

  const mapPoints = useMemo(() => {
    return storyNodes.map((node, index) => {
      const chapterIndex = node.kind === "course" ? courseNodes.findIndex((n) => n.id === node.id) : -1;
      const patternIndex = node.kind === "course" ? chapterIndex % NODE_X_POSITIONS.length : 1;
      const xPercent = node.kind === "course" ? NODE_X_POSITIONS[patternIndex] : 50;
      return { node, index, chapterIndex, xPercent, y: NODE_TOP_PAD + index * NODE_SPACING };
    });
  }, [storyNodes, courseNodes]);

  const mapHeight = Math.max(460, NODE_TOP_PAD + (mapPoints.length - 1) * NODE_SPACING + NODE_BOTTOM_PAD);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const [mapViewportWidth, setMapViewportWidth] = useState(0);

  useLayoutEffect(() => {
    const el = mapViewportRef.current;
    if (!el) return;
    const measure = () => setMapViewportWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentMapPoint = useMemo(
    () => mapPoints.find((p) => p.node.status === "current") ?? null,
    [mapPoints],
  );

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!resume || !analysis) {
    return (
      <div className="glass-card rounded-3xl border border-border/60 p-8 text-center">
        <p className="font-semibold text-foreground">No main story yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Run Skill Analysis first, then open My Progress to generate your quest trail.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-slide-in-up max-w-5xl mx-auto">
      {/* Header */}
      <header className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b1026] via-[#0e1428] to-[#0a1a2e] text-slate-100 relative shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_50%),radial-gradient(circle_at_30%_80%,rgba(139,92,246,0.12),transparent_40%)]" />
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`orb-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 8 + (i % 3) * 4,
              height: 8 + (i % 3) * 4,
              background: i % 2 === 0 ? "rgba(52,211,153,0.35)" : "rgba(56,189,248,0.35)",
              left: `${10 + i * 14}%`,
              top: `${20 + (i % 3) * 22}%`,
              filter: "blur(2px)",
            }}
            animate={prefersReducedMotion ? { y: 0, opacity: 0.55 } : { y: [0, -16, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }
            }
          />
        ))}
        <div className="relative p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300 font-bold">
            <motion.span
              animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex"
            >
              <Sparkles size={14} />
            </motion.span>
            Quest Mode · Hero Journey
          </div>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div className="flex items-start gap-4">
              <motion.div
                className="relative shrink-0"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-sky-500 p-[2px] shadow-lg">
                  <div className="h-full w-full rounded-2xl bg-[#0e1428] flex items-center justify-center">
                    {isLoading ? (
                      <Loader2 size={26} className="text-emerald-300 animate-spin" />
                    ) : (
                      <TierIcon size={26} className="text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-[9px] font-black text-slate-900 shadow-md tracking-wide">
                  {tier.name.toUpperCase()}
                </div>
              </motion.div>
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-sky-100 bg-clip-text text-transparent">
                  Path for {resume.label}
                </h1>
                <p className="text-sm text-slate-300/90 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-emerald-200 font-bold">
                    <Target size={12} />
                    {Math.round(analysis.matchPercent)}% match
                  </span>
                  {jdPreview ? <span className="text-slate-300/80 line-clamp-1">{jdPreview}</span> : null}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 min-w-[300px]">
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Quest</p>
                <p className="font-black text-emerald-300 text-lg leading-tight">{storyCompletion}%</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Chapters</p>
                <p className="font-black text-sky-300 text-lg leading-tight">
                  {completedCourses}<span className="text-slate-500 text-sm">/{courseNodes.length}</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">XP</p>
                <p className="font-black text-amber-300 text-lg leading-tight">{totalXp.toLocaleString()}</p>
              </div>
            </div>
          </div>
          {currentCourseNode ? (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 backdrop-blur-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/50"
              >
                <Swords size={16} className="text-white" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-sky-300">Active Mission</p>
                <p className="text-sm font-bold text-white line-clamp-1">{currentCourseNode.title}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Reward</p>
                <p className="text-sm font-black text-amber-300">+{currentCourseNode.xp} XP</p>
              </div>
            </motion.div>
          ) : null}
        </div>
      </header>

      {message ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
          {message}
        </div>
      ) : null}

      {/* Quest Trail Map */}
      <section
        aria-label="Main story path"
        className="relative rounded-3xl border border-border/60 overflow-hidden p-5 md:p-7 bg-gradient-to-br from-slate-50 via-emerald-50/40 to-sky-50/40 dark:from-slate-950 dark:via-emerald-950/30 dark:to-sky-950/30"
      >
        <AnimatePresence>
          {unlockFlash ? (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="mb-4 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-400/20 via-emerald-500/15 to-transparent px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-500/20"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6 }}
                className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md"
              >
                <Trophy size={18} className="text-white" />
              </motion.div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                  Chapter Cleared
                </p>
                <p className="text-sm font-bold text-foreground">
                  {unlockFlash.title}{" "}
                  <span className="text-amber-600 dark:text-amber-400">+{unlockFlash.xp} XP</span>
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Map size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground leading-tight">Quest Trail</h2>
              <p className="text-[11px] text-muted-foreground leading-tight">Follow the path to level up</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-400/40 px-3 py-1.5 shrink-0">
              <Gift size={13} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">Rewards await</span>
            </div>
            <button
              type="button"
              onClick={loadProgress}
              disabled={isLoading}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span
            style={{ color: shellDark ? QUEST_PILL_FG.complete.dark : QUEST_PILL_FG.complete.light }}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/70 bg-emerald-100 px-3 py-1.5 text-[11px] font-bold whitespace-nowrap dark:border-emerald-700/70 dark:bg-emerald-900/50"
          >
            <CheckCircle2
              size={12}
              strokeWidth={2.5}
              style={{ color: shellDark ? QUEST_PILL_FG.complete.dark : QUEST_PILL_FG.complete.light }}
            />
            Completed
          </span>
          <span
            style={{ color: shellDark ? QUEST_PILL_FG.current.dark : QUEST_PILL_FG.current.light }}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/70 bg-amber-100 px-3 py-1.5 text-[11px] font-bold whitespace-nowrap dark:border-amber-700/70 dark:bg-amber-950/50"
          >
            <Swords
              size={12}
              strokeWidth={2.5}
              style={{ color: shellDark ? QUEST_PILL_FG.current.dark : QUEST_PILL_FG.current.light }}
            />
            Active Mission
          </span>
          <span
            style={{ color: shellDark ? QUEST_PILL_FG.locked.dark : QUEST_PILL_FG.locked.light }}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-400/70 bg-red-100 px-3 py-1.5 text-[11px] font-bold whitespace-nowrap dark:border-red-700/70 dark:bg-red-950/50"
          >
            <Lock
              size={12}
              strokeWidth={2.5}
              style={{ color: shellDark ? QUEST_PILL_FG.locked.dark : QUEST_PILL_FG.locked.light }}
            />
            Locked
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2.5 w-28 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden border border-slate-300/60 dark:border-slate-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${storyCompletion}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
              />
            </div>
            <span className="text-xs font-bold text-foreground whitespace-nowrap">
              {completedCourses}/{courseNodes.length}
            </span>
          </div>
        </div>

        {/* Map viewport */}
        <div
          ref={mapViewportRef}
          className="relative rounded-2xl border border-border/50 overflow-hidden bg-muted/40 dark:bg-muted/25"
          style={{ height: mapHeight }}
        >
          {/* Sparkles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`spark-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 3,
                height: 3,
                background: i % 2 === 0 ? "rgba(52,211,153,0.6)" : "rgba(56,189,248,0.6)",
                left: `${8 + (i * 11) % 85}%`,
                top: `${5 + (i * 17) % 90}%`,
                boxShadow: i % 2 === 0 ? "0 0 8px rgba(52,211,153,0.8)" : "0 0 8px rgba(56,189,248,0.8)",
              }}
              animate={
                prefersReducedMotion ? { opacity: 0.55, scale: 1 } : { opacity: [0.2, 1, 0.2], scale: [0.6, 1.4, 0.6] }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 2.5 + (i % 3), repeat: Infinity, delay: i * 0.2 }
              }
            />
          ))}

          {/* SVG path connectors */}
          <svg
            className="absolute inset-0 h-full w-full pointer-events-none"
            viewBox={`0 0 1000 ${mapHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pathActive" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>
            {mapPoints.slice(0, -1).map((point, idx) => {
              const next = mapPoints[idx + 1];
              const startX = point.xPercent * 10;
              const endX = next.xPercent * 10;
              const startY = point.y;
              const endY = next.y;
              const controlX = (startX + endX) / 2 + (idx % 2 === 0 ? 140 : -140);
              const midpointY = (startY + endY) / 2;
              const checkpointUnlocked = next.node.status === "current" || next.node.status === "complete";
              return (
                <g key={`connector-${point.node.id}`}>
                  <path
                    d={`M ${startX} ${startY} Q ${controlX} ${midpointY} ${endX} ${endY}`}
                    stroke={checkpointUnlocked ? "url(#pathActive)" : "rgba(148,163,184,0.35)"}
                    strokeWidth={checkpointUnlocked ? 5 : 3}
                    strokeDasharray={checkpointUnlocked ? "1 0" : "6 10"}
                    fill="none"
                    strokeLinecap="round"
                    opacity={checkpointUnlocked ? 0.85 : 0.6}
                  />
                  {checkpointUnlocked && !prefersReducedMotion ? (
                    <motion.path
                      d={`M ${startX} ${startY} Q ${controlX} ${midpointY} ${endX} ${endY}`}
                      stroke="white"
                      strokeWidth={2}
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray="8 200"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: -208 }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      opacity={0.6}
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* Chest badges between nodes */}
          {mapPoints.slice(0, -1).map((point, idx) => {
            const next = mapPoints[idx + 1];
            const chestXPct = (point.xPercent + next.xPercent) / 2;
            const chestY = (point.y + next.y) / 2 + 70;
            const unlocked = next.node.status === "current" || next.node.status === "complete";
            return (
              <motion.div
                key={`chest-${point.node.id}`}
                className="absolute z-10"
                style={{ left: `${chestXPct}%`, top: `${chestY}px`, transform: "translate(-50%, -50%)" }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.08 }}
              >
                <motion.div
                  animate={prefersReducedMotion || !unlocked ? {} : { y: [0, -4, 0], rotate: [-2, 2, -2] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[10px] font-black whitespace-nowrap shadow-lg ${
                    unlocked
                      ? "border-amber-500 bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-900 shadow-amber-400/40"
                      : "border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {unlocked ? (
                    <>
                      <Gift size={12} className="drop-shadow" />
                      <span>Chest Unlocked</span>
                      <Sparkles size={10} />
                    </>
                  ) : (
                    <>
                      <Lock size={11} />
                      <span>Chest Locked</span>
                    </>
                  )}
                </motion.div>
              </motion.div>
            );
          })}

          {/* Nodes */}
          {mapPoints.map((point) => {
            const node = point.node;
            const realm = point.chapterIndex >= 0 ? realmFor(point.chapterIndex) : null;
            const QuestIcon =
              node.kind === "course"
                ? questIconFor(point.chapterIndex)
                : node.kind === "prologue"
                  ? Star
                  : Flag;
            const IconToRender =
              node.kind === "course" && node.status === "complete"
                ? CheckCircle2
                : node.kind === "course" && node.status === "locked"
                  ? Lock
                  : QuestIcon;
            const statusTag =
              node.status === "complete"
                ? "Cleared"
                : node.status === "current"
                  ? "Active Mission"
                  : node.kind === "prologue"
                    ? "Start"
                    : node.kind === "epilogue"
                      ? "Final Boss"
                      : "Locked";
            const nodeTitle =
              node.kind === "course"
                ? node.title
                : node.kind === "prologue"
                  ? "Quest Start"
                  : "Final Encounter";
            const nodeSubtitle =
              node.kind === "course"
                ? `${node.fillsGap} • +${node.xp} XP`
                : node.kind === "prologue"
                  ? "Begin your path"
                  : "Re-run analysis";
            const accent = realm?.accent ?? "#10b981";
            const glow = realm?.glow ?? "rgba(16,185,129,0.55)";
            const statusInk = fgForStoryNode(node, shellDark);
            const ringClass =
              node.status === "complete"
                ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                : node.status === "current"
                  ? "bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-400"
                  : "bg-slate-300 dark:bg-slate-700";
            const cardW = mapViewportWidth > 0 ? questCardWidthForContainer(mapViewportWidth) : 0;
            const cardShiftPx =
              mapViewportWidth > 0 && cardW > 0
                ? questCardHorizontalShiftPx(point.xPercent, mapViewportWidth, cardW)
                : 0;

            return (
              <div
                key={`node-${node.id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
                style={{ left: `${point.xPercent}%`, top: `${point.y}px` }}
              >
                {node.status === "current" ? (
                  prefersReducedMotion ? (
                    <div
                      className="absolute inset-0 rounded-full opacity-50"
                      style={{ background: glow, filter: "blur(14px)" }}
                    />
                  ) : (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ background: glow, filter: "blur(16px)" }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.45, 0.75, 0.45] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      {[0, 1, 2].map((ring) => (
                        <motion.div
                          key={`ring-${ring}`}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 rounded-full border-2"
                          style={{ borderColor: accent }}
                          animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                          transition={{ duration: 2.2, repeat: Infinity, delay: ring * 0.7, ease: "easeOut" }}
                        />
                      ))}
                    </>
                  )
                ) : null}

                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.7, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: point.index * 0.06, type: "spring", stiffness: 160 }}
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className={`relative h-14 w-14 rounded-full p-[3px] ${ringClass} shadow-xl`}
                  style={{
                    boxShadow:
                      node.status === "locked"
                        ? "0 4px 12px rgba(0,0,0,0.15)"
                        : `0 8px 24px ${glow}, 0 0 0 1px rgba(255,255,255,0.1)`,
                  }}
                  aria-label={`${nodeTitle}: ${statusTag}`}
                >
                  <div
                    className={`h-full w-full rounded-full flex items-center justify-center ${
                      node.status === "complete"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
                        : node.status === "current"
                          ? "bg-white text-sky-600 dark:bg-slate-900 dark:text-sky-400"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <IconToRender size={20} strokeWidth={2.4} />
                  </div>
                  {node.kind === "course" && node.status !== "locked" ? (
                    <motion.div
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-md"
                      animate={
                        prefersReducedMotion || node.status !== "current" ? {} : { rotate: [0, -10, 10, 0] }
                      }
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Zap size={9} className="text-white" strokeWidth={3} />
                    </motion.div>
                  ) : null}
                  {node.status === "complete" ? (
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-md">
                      <CheckCircle2 size={9} className="text-white" strokeWidth={3} />
                    </div>
                  ) : null}
                </motion.button>

                {/* Quest card */}
                <div
                  className="absolute left-1/2 top-9 min-w-0"
                  style={{
                    ...(mapViewportWidth > 0 && cardW > 0
                      ? {
                          width: cardW,
                          maxWidth: cardW,
                          boxSizing: "border-box",
                          transform: `translate(calc(-50% + ${cardShiftPx}px), 0)`,
                        }
                      : { ...QUEST_CARD_WIDTH_STYLE, transform: "translate(-50%, 0)" }),
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: point.index * 0.08 + 0.15, type: "spring", stiffness: 200 }}
                    className={`relative flex flex-col overflow-hidden rounded-2xl border-2 shadow-xl ring-1 ring-black/5 dark:ring-white/10 pointer-events-auto ${
                      node.status === "complete"
                        ? "border-emerald-400/90 shadow-emerald-500/20"
                        : node.status === "current"
                          ? "border-sky-400 shadow-sky-500/25 ring-sky-400/30"
                          : "border-slate-300/90 shadow-slate-400/15 dark:border-slate-600"
                    } ${node.kind === "course" && node.status === "locked" ? "border-dashed opacity-[0.98]" : ""}`}
                  >
                    <div
                      className={`h-1 w-full shrink-0 ${
                        node.status === "complete"
                          ? "bg-emerald-500"
                          : node.status === "current"
                            ? "bg-sky-500"
                            : "bg-slate-400 dark:bg-slate-500"
                      }`}
                    />
                    <div
                      className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 border-b px-3 py-2 ${
                        node.status === "complete"
                          ? "border-emerald-200/80 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50"
                          : node.status === "current"
                            ? "border-sky-200/80 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/45"
                            : "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70"
                      }`}
                    >
                      <span
                        style={{ color: statusInk }}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                          node.status === "complete"
                            ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/60"
                            : node.status === "current"
                              ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/60"
                              : "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/60"
                        }`}
                      >
                        {node.status === "complete" ? (
                          <CheckCircle2 size={11} strokeWidth={2.5} style={{ color: statusInk }} />
                        ) : node.status === "current" ? (
                          <Swords size={11} strokeWidth={2.5} style={{ color: statusInk }} />
                        ) : (
                          <Lock size={11} strokeWidth={2.5} style={{ color: statusInk }} />
                        )}
                        {statusTag}
                      </span>
                      <span
                        title={realm ? realm.name : node.kind === "prologue" ? "Chapter I" : "Finale"}
                        style={ELLIPSIS_END}
                        className={`min-w-0 text-right text-[10px] font-bold uppercase tracking-wide leading-tight ${
                          realm ? realm.label : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {realm ? realm.name : node.kind === "prologue" ? "Chapter I" : "Finale"}
                      </span>
                    </div>

                    <div
                      className={`px-3 py-2.5 text-left ${
                        node.status === "complete"
                          ? "bg-white dark:bg-emerald-950/25"
                          : node.status === "current"
                            ? "bg-white dark:bg-sky-950/25"
                            : "bg-white dark:bg-slate-950/40"
                      }`}
                    >
                      <p
                        style={QUEST_TITLE_CLAMP_STYLE}
                        className="text-[13px] font-extrabold leading-snug tracking-tight text-slate-900 dark:text-slate-50"
                      >
                        {nodeTitle}
                      </p>
                      {node.kind === "course" && node.provider ? (
                        <div className="mt-2 flex items-center gap-2">
                          <ProviderMark provider={node.provider} />
                          <span
                            style={ELLIPSIS_END}
                            className="min-w-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                          >
                            {node.provider}
                          </span>
                        </div>
                      ) : null}
                      {node.kind === "course" && node.resourceLabel ? (
                        <p
                          title={node.resourceLabel}
                          className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          <Calendar size={11} strokeWidth={2} className="shrink-0 opacity-80" aria-hidden />
                          <span style={ELLIPSIS_END} className="min-w-0">
                            {node.resourceLabel}
                          </span>
                        </p>
                      ) : null}
                      {node.kind === "course" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/70 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-950 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-50">
                            <Zap size={12} strokeWidth={2.5} className="shrink-0 text-amber-600 dark:text-amber-400" />
                            +{node.xp} XP
                          </span>
                          <span
                            className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                              realm
                                ? `${realm.chipBg} border-slate-300/70 text-slate-900 dark:border-slate-600 dark:text-slate-100`
                                : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <Target size={10} strokeWidth={2.5} className="shrink-0 opacity-80" />
                            <span className="truncate">{node.fillsGap}</span>
                          </span>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-600 dark:text-slate-400">
                          {nodeSubtitle}
                        </p>
                      )}
                      {node.kind === "course" && node.url ? (
                        <a
                          href={node.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-300/80 bg-sky-50 py-2 text-[11px] font-bold text-sky-900 shadow-sm transition-colors hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/70"
                        >
                          <ExternalLink size={13} strokeWidth={2.5} className="shrink-0" />
                          Open resource
                        </a>
                      ) : null}
                      {node.kind === "course" && node.status === "current" ? (
                        <button
                          type="button"
                          onClick={() => handleComplete(node.courseId)}
                          disabled={completingCourseId === node.courseId}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-300"
                        >
                          {completingCourseId === node.courseId ? (
                            <><Loader2 size={13} className="animate-spin" /> Saving...</>
                          ) : (
                            <><CheckCircle2 size={13} strokeWidth={2.5} /> Mark Complete</>
                          )}
                        </button>
                      ) : null}
                      {node.kind === "epilogue" && node.status === "current" ? (
                        <p className="mt-2 flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                          <ChevronRight size={12} strokeWidth={2.5} />
                          Run Skill Analysis
                        </p>
                      ) : null}
                    </div>

                    <div
                      className="h-0.5 w-full shrink-0"
                      style={{
                        background:
                          node.status === "complete"
                            ? "linear-gradient(90deg,#34d399 0%,#14b8a6 50%,#06b6d4 100%)"
                            : node.status === "current"
                              ? "linear-gradient(90deg,#0ea5e9 0%,#06b6d4 50%,#10b981 100%)"
                              : "linear-gradient(90deg,#cbd5e1 0%,#94a3b8 100%)",
                      }}
                    />
                  </motion.div>
                </div>
              </div>
            );
          })}

          {/* YOU marker */}
          {currentMapPoint ? (
            (() => {
              const sideIsRight = currentMapPoint.xPercent < 50;
              return (
                <motion.div
                  className="absolute z-30 pointer-events-none"
                  initial={false}
                  animate={{
                    left: `calc(${currentMapPoint.xPercent}% + ${sideIsRight ? 36 : -36}px)`,
                    top: currentMapPoint.y,
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                  style={{ transform: sideIsRight ? "translate(0, -50%)" : "translate(-100%, -50%)" }}
                >
                  <motion.div
                    animate={prefersReducedMotion ? {} : { x: sideIsRight ? [0, 5, 0] : [0, -5, 0] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                    className="flex items-center"
                  >
                    {!sideIsRight ? (
                      <div
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white shadow-xl whitespace-nowrap tracking-wider ring-2 ring-white dark:ring-slate-900 flex items-center gap-1"
                        style={{ background: "linear-gradient(90deg,#fb923c 0%,#f97316 50%,#ea580c 100%)" }}
                      >
                        YOU <Swords size={10} strokeWidth={3} />
                      </div>
                    ) : null}
                    <div
                      className="w-0 h-0"
                      style={
                        sideIsRight
                          ? { borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: "8px solid #ea580c" }
                          : { borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "8px solid #ea580c" }
                      }
                    />
                    {sideIsRight ? (
                      <div
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white shadow-xl whitespace-nowrap tracking-wider ring-2 ring-white dark:ring-slate-900 flex items-center gap-1"
                        style={{ background: "linear-gradient(90deg,#fb923c 0%,#f97316 50%,#ea580c 100%)" }}
                      >
                        <Swords size={10} strokeWidth={3} /> YOU
                      </div>
                    ) : null}
                  </motion.div>
                </motion.div>
              );
            })()
          ) : null}
        </div>
      </section>

      {/* XP + Recent Feats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative rounded-3xl p-6 text-white shadow-xl overflow-hidden bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-40 h-40 bg-emerald-300/25 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center backdrop-blur-sm border border-white/40 shadow-lg"
                >
                  <TierIcon size={26} className="text-white drop-shadow-lg" />
                </motion.div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/80">Hero Tier</p>
                  <h2 className="text-xl font-black">{tier.name}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold">Total XP</p>
                <p className="text-2xl font-black drop-shadow">{totalXp.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-black/20 rounded-2xl p-4 backdrop-blur-sm border border-white/20">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="opacity-90">Progress to {tier.next}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-3 w-full bg-black/25 rounded-full overflow-hidden mb-2 relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-amber-300 via-yellow-200 to-white rounded-full relative overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              </div>
              <p className="text-xs text-white/90 flex items-center gap-1.5 font-semibold">
                <Zap size={12} className="text-amber-200" />
                {tier.name === "Legend" ? "Max tier reached!" : `${remainingToNextLevel.toLocaleString()} XP to next tier`}
              </p>
            </div>
            {currentStreak > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white/90">
                <Flame size={13} className="text-orange-300" />
                <span>{currentStreak}-day streak</span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              Recent Feats
            </h3>
          </div>
          <div className="space-y-2.5">
            {progress?.recentActivity.length ? (
              progress.recentActivity.slice(0, 3).map((activity, i) => (
                <motion.div
                  key={`${activity.courseId}-${activity.completedAt}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-emerald-500/5 p-2.5"
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground line-clamp-1">
                      Completed "{activity.title}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(activity.completedAt)}</p>
                  </div>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-400/30 rounded-lg px-2 py-1 whitespace-nowrap">
                    +{activity.xp} XP
                  </span>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-6 px-3 rounded-xl border border-dashed border-border/60 bg-secondary/20">
                <Swords size={24} className="mx-auto text-muted-foreground opacity-50 mb-2" />
                <p className="text-sm text-muted-foreground">Complete a quest to start your legend.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quest Badges */}
      <div className="glass-card rounded-3xl p-6 border border-border/60">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-none">Quest Badges</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Achievements unlocked along your journey</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5">
            <Star size={13} className="text-amber-500 fill-amber-500" />
            <span className="text-sm font-black text-foreground">
              <span className="text-amber-600 dark:text-amber-400">
                {(progress?.achievements ?? []).filter((a) => a.unlocked).length}
              </span>
              <span className="text-muted-foreground font-bold"> / {progress?.achievements.length ?? 0}</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(progress?.achievements ?? []).map((badge: GamificationAchievement, index: number) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -3 }}
              className={`relative overflow-hidden p-4 rounded-2xl border-2 transition-all ${
                badge.unlocked
                  ? "border-amber-400/70 bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-emerald-950/30 shadow-lg shadow-amber-500/10"
                  : "border-border bg-secondary/30"
              }`}
            >
              {badge.unlocked ? (
                <>
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)" }}
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                  />
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                    <CheckCircle2 size={11} className="text-white" strokeWidth={3} />
                  </div>
                </>
              ) : (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-slate-400/30 flex items-center justify-center">
                  <Lock size={10} className="text-slate-500" />
                </div>
              )}
              <div className="flex items-start gap-3 relative">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    badge.unlocked
                      ? "bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 text-white"
                      : "bg-secondary text-muted-foreground grayscale"
                  }`}
                >
                  <Trophy size={22} strokeWidth={2.3} />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <h3 className={`text-sm font-black ${badge.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                    {badge.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{badge.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
