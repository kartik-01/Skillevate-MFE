import React, { useEffect, useState, Suspense } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { loadRemoteSafely } from "./utils/loadRemoteSafely";
import { motion, AnimatePresence } from "framer-motion";
import { Target, TrendingUp, PlaySquare, Award } from "lucide-react";
import LandingHome from "./landing/LandingHome";
import Footer from "./landing/components/Footer";
import Header from "./landing/components/Header";
import { ThemeProvider } from "./landing/components/ThemeProvider";
import { UserProvider } from "./user/UserProvider";
import { SyncedThemeBridge } from "./user/SyncedThemeBridge";

declare global {
  interface Window {
    __SKILLEVATE_GET_ACCESS_TOKEN__?: () => Promise<string>;
  }
}

if (module && (module as any).hot) {
  (module as any).hot.addStatusHandler((status: string) => {
    if (status === "abort" || status === "fail") {
      console.log("[HMR] Detected remote rebuild → refreshing host...");
      window.location.reload();
    }
  });
}


type RemoteModule = React.ComponentType | null;

// Fallback avatar used only when Auth0 doesn't provide a `picture` claim.
const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdCUyMHVzZXIlMjBwcm9maWxlfGVufDF8fHx8MTc3Mzc5NDA2Nnww&ixlib=rb-4.1.0&q=80&w=1080";

export default function App() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  type ActiveApp = "recommendation" | "gamify" | "analysis";
  const tabs: Array<{ id: ActiveApp; label: string }> = [
    { id: "analysis", label: "Skill Analysis" },
    { id: "recommendation", label: "Learning Path" },
    { id: "gamify", label: "My Progress" },
  ];

  // Helper: map hash → app
  const hashToApp = (hash: string): ActiveApp => {
    if (hash.includes("gamify")) return "gamify";
    if (hash.includes("analysis")) return "analysis";
    if (hash.includes("recommendation")) return "recommendation";
    return "analysis";
  };

  const [activeApp, setActiveApp] = useState<ActiveApp>(() =>
    hashToApp(window.location.hash)
  );
  const [Recommendation, setRecommendation] = useState<RemoteModule>(null);
  const [Gamify, setGamify] = useState<RemoteModule>(null);
  const [Analysis, setAnalysis] = useState<RemoteModule>(null);
  const firstName = user?.name?.split(" ")[0] || "Learner";
  const avatarSrc =
    typeof user?.picture === "string" && user.picture.length > 0 ? user.picture : FALLBACK_AVATAR;

  // Validate hash on every render
  useEffect(() => {
    const protectedRoutes = ["#/recommendation", "#/gamify", "#/analysis"];
    const currentHash = window.location.hash;

    // If user is not logged in OR hash is invalid → always reset to base
    const invalidOrProtected =
      !isAuthenticated ||
      !protectedRoutes.some((route) => currentHash.startsWith(route));

    if (invalidOrProtected && currentHash) {
      // Strip hash from URL entirely
      window.history.replaceState({}, "", window.location.origin);
    }
  }, [isAuthenticated, isLoading]);

  // Lazy-load MFEs only when selected
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadRemote = async (
      importer: () => Promise<unknown>,
      setter: React.Dispatch<React.SetStateAction<RemoteModule>>
    ) => {
      try {
        const mod = await loadRemoteSafely(importer);
        const Component = mod?.default as React.ComponentType | null | undefined;
        if (Component && typeof Component === "function") {
          setter((_prev: RemoteModule) => Component);
        } else {
          console.warn("Remote returned invalid component:", mod);
          setter(null);
        }
      } catch (err) {
        console.error("Failed to load remote:", err);
        setter(null);
      }
    };

    if (activeApp === "recommendation" && !Recommendation)
      loadRemote(() => import("recommendation/Widget"), setRecommendation);
    if (activeApp === "gamify" && !Gamify)
      loadRemote(() => import("gamify/Widget"), setGamify);
    if (activeApp === "analysis" && !Analysis)
      loadRemote(() => import("analysis/Widget"), setAnalysis);
  }, [activeApp, isAuthenticated]);

  // Hash → state
  useEffect(() => {
    const onHashChange = () => {
      const newHash = window.location.hash;
      const validRoutes = ["#/recommendation", "#/gamify", "#/analysis"];
      if (isAuthenticated && validRoutes.includes(newHash)) {
        setActiveApp(hashToApp(newHash));
      } else if (!isAuthenticated && newHash) {
        // Logged out & trying to access protected route → reset
        window.history.replaceState({}, "", window.location.origin);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [isAuthenticated]);

  // State → hash (only when logged in)
  useEffect(() => {
    if (!isAuthenticated) return;
    const hashMap: Record<ActiveApp, string> = {
      recommendation: "#/recommendation",
      gamify: "#/gamify",
      analysis: "#/analysis",
    };
    if (window.location.hash !== hashMap[activeApp]) {
      window.location.hash = hashMap[activeApp];
    }
  }, [activeApp, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      delete window.__SKILLEVATE_GET_ACCESS_TOKEN__;
      return;
    }

    window.__SKILLEVATE_GET_ACCESS_TOKEN__ = async () => {
      return getAccessTokenSilently();
    };

    return () => {
      delete window.__SKILLEVATE_GET_ACCESS_TOKEN__;
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  // Render selected MFE
  const renderSelectedApp = () => {
    const Component =
      activeApp === "recommendation"
        ? Recommendation
        : activeApp === "gamify"
        ? Gamify
        : Analysis;

    if (Component) return <Component />;

    const appName =
      activeApp === "recommendation"
        ? "Learning Recommendation"
        : activeApp === "gamify"
        ? "Gamification"
        : "Skill Gap Analysis";

    return (
      <div className="text-center text-muted-foreground py-12">
        <p className="text-lg">{appName} module is not available yet.</p>
        <p className="text-sm mt-2">Please start that MFE locally and refresh this page.</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark">
        <div className="flex flex-col items-center justify-center h-screen text-center text-muted-foreground">
          <p>Checking authentication...</p>
        </div>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemeProvider defaultTheme="dark">
        <LandingHome onLogin={() => loginWithRedirect()} />
      </ThemeProvider>
    );
  }

  return (
    <UserProvider>
      <ThemeProvider defaultTheme="dark">
        <SyncedThemeBridge />
        <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        <Header
          onLogoClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          hideNavigation
          isAuthenticated
          userName={firstName}
          onLogout={() => {
            setActiveApp("analysis");
            window.history.replaceState({}, "", window.location.origin);
            logout({ logoutParams: { returnTo: window.location.origin } });
          }}
        />

        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-10">
          <div className="bg-[#F0F9F7] dark:bg-[#0f1f1c] font-sans text-slate-800 dark:text-slate-100 p-4 md:p-8 rounded-3xl">
            <div className="w-full space-y-8">
              <section className="bg-white dark:bg-[#132825] rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1DB896] p-[2px]">
                      <img
                        src={avatarSrc}
                        alt="User Profile"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          const target = event.currentTarget;
                          if (target.src !== FALLBACK_AVATAR) target.src = FALLBACK_AVATAR;
                        }}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-[#1DB896] text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-white dark:border-[#132825] flex items-center shadow-sm">
                      Lvl 4
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      Welcome back, {firstName}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-300 font-medium flex items-center gap-2 mt-1">
                      <Target size={16} className="text-[#1DB896]" />
                      Target Role: Senior Frontend Engineer
                    </p>
                  </div>
                </div>
                <div className="w-full md:w-64 bg-[#F0F9F7] dark:bg-[#0f1f1c] rounded-2xl p-4">
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-slate-700 dark:text-slate-200">Level 4</span>
                    <span className="text-[#1DB896]">1,200 / 2,000 XP</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "60%" }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-[#1DB896] rounded-full"
                    />
                  </div>
                </div>
              </section>

              <div className="flex p-1 bg-white dark:bg-[#132825] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 w-fit">
                {tabs.map((tab) => {
                  const iconMap: Record<ActiveApp, React.ComponentType<{ size?: number; className?: string }>> = {
                    analysis: TrendingUp,
                    recommendation: PlaySquare,
                    gamify: Award,
                  };
                  const Icon = iconMap[tab.id];
                  const isActive = activeApp === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveApp(tab.id)}
                      className={`relative flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-colors z-10 ${
                        isActive
                          ? "text-[#1DB896]"
                          : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-[#F0F9F7] dark:bg-[#0f1f1c] rounded-xl -z-10"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <Icon size={18} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="w-full relative min-h-[400px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeApp}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="w-full"
                  >
                    <Suspense
                      fallback={
                        <p className="text-muted-foreground text-center py-10">Loading module...</p>
                      }
                    >
                      {renderSelectedApp()}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </main>

        <Footer />
        </div>
      </ThemeProvider>
    </UserProvider>
  );
}
