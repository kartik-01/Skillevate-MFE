import React, { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Zap, Star, Target } from "lucide-react";
import { motion } from "framer-motion";

type CompletedCourseActivity = {
  courseId: number;
  title: string;
  xp: number;
  completedAt: string;
  resumeLabel: string;
};

type PersistedGamifyProgress = {
  earnedXp: number;
  completedCourseIds: number[];
  completedActivities: CompletedCourseActivity[];
};

const GAMIFY_PROGRESS_STORAGE_KEY = "skillevate-gamify-progress-v1";
const BASE_TOTAL_XP = 1200;
const NEXT_LEVEL_XP = 2000;

function formatRelativeTime(timestamp: string) {
  const timeMs = new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor((Date.now() - timeMs) / (1000 * 60)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function GamifyApp() {
  const [earnedXp, setEarnedXp] = useState(0);
  const [completedCourseIds, setCompletedCourseIds] = useState<number[]>([]);
  const [completedActivities, setCompletedActivities] = useState<CompletedCourseActivity[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawProgress = window.localStorage.getItem(GAMIFY_PROGRESS_STORAGE_KEY);
      if (!rawProgress) return;

      const parsed = JSON.parse(rawProgress) as PersistedGamifyProgress;
      setEarnedXp(parsed.earnedXp ?? 0);
      setCompletedCourseIds(Array.isArray(parsed.completedCourseIds) ? parsed.completedCourseIds : []);
      setCompletedActivities(Array.isArray(parsed.completedActivities) ? parsed.completedActivities : []);
    } catch {
      // Ignore malformed persisted progress.
    }
  }, []);

  const totalXp = BASE_TOTAL_XP + earnedXp;
  const progressPercent = Math.min(100, Math.round((totalXp / NEXT_LEVEL_XP) * 100));
  const remainingToNextLevel = Math.max(0, NEXT_LEVEL_XP - totalXp);
  const completedCount = completedCourseIds.length;

  const achievements = [
    {
      id: 1,
      title: "First Gap Closed",
      desc: "Completed a course to fill a missing skill",
      icon: CheckCircle2,
      unlocked: completedCount >= 1,
    },
    {
      id: 2,
      title: "Fast Learner",
      desc: "Completed 3 courses in a week",
      icon: Zap,
      unlocked: completedCount >= 3,
    },
    {
      id: 3,
      title: "Perfect Match",
      desc: "Reached 90% JD match",
      icon: Star,
      unlocked: totalXp >= 1800,
    },
    {
      id: 4,
      title: "Knowledge Seeker",
      desc: "Analyzed 5 different job descriptions",
      icon: Target,
      unlocked: completedCount >= 5,
    },
  ];

  const unlockedAchievements = useMemo(
    () => achievements.filter((achievement) => achievement.unlocked).length,
    [achievements],
  );

  const recentActivity = useMemo(() => {
    return completedActivities.slice(0, 3).map((item) => ({
      text: `Completed \"${item.title}\"`,
      xp: `+${item.xp} XP`,
      time: formatRelativeTime(item.completedAt),
    }));
  }, [completedActivities]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-in-up">
      <div className="lg:col-span-1 space-y-6">
        <div className="gradient-primary rounded-3xl p-8 text-white text-center shadow-sm relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-black/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="w-24 h-24 mx-auto bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 mb-4 shadow-inner">
              <Award size={40} className="text-white drop-shadow-md" />
            </div>
            <h2 className="text-2xl font-semibold mb-1">Level 4</h2>
            <p className="text-[#F0F9F7] font-medium text-sm mb-6">Intermediate Explorer</p>

            <div className="bg-black/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span>Total XP</span>
                <span>
                  {totalXp.toLocaleString()} / {NEXT_LEVEL_XP.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-white rounded-full"
                />
              </div>
              <p className="text-xs text-white/80">{remainingToNextLevel.toLocaleString()} XP to Level 5</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 border border-border/60">
          <h3 className="font-semibold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#1DB896] mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{activity.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.time} • <span className="text-[#1DB896] font-bold">{activity.xp}</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Complete recommended videos to start earning XP.</p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="glass-card rounded-3xl p-6 border border-border/60 h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Badges & Achievements</h2>
            <div className="text-sm font-semibold text-muted-foreground">
              <span className="text-[#1DB896]">{unlockedAchievements}</span> / 4 Unlocked
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.id}
                  className={`p-5 rounded-2xl border-2 transition-all ${
                    badge.unlocked
                      ? "border-[#1DB896] bg-[#F0F9F7] dark:bg-[#0c2d2a]/75"
                      : "border-border bg-secondary/40 opacity-70 grayscale"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        badge.unlocked
                          ? "bg-white text-[#1DB896] shadow-sm dark:bg-white/10 dark:text-[#5fe0c5]"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${badge.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                        {badge.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-tight">{badge.desc}</p>
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
