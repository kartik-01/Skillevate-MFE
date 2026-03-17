import React, { useEffect, useState, Suspense } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { loadRemoteSafely } from "./utils/loadRemoteSafely";
import { motion, AnimatePresence } from "framer-motion";
import LandingHome from "./landing/LandingHome";
import Footer from "./landing/components/Footer";
import Header from "./landing/components/Header";
import { ThemeProvider } from "./landing/components/ThemeProvider";

if (module && (module as any).hot) {
  (module as any).hot.addStatusHandler((status: string) => {
    if (status === "abort" || status === "fail") {
      console.log("[HMR] Detected remote rebuild → refreshing host...");
      window.location.reload();
    }
  });
}


type RemoteModule = React.ComponentType | null;

export default function App() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
  } = useAuth0();

  type ActiveApp = "recommendation" | "gamify" | "analysis";
  const tabs: Array<{ id: ActiveApp; label: string }> = [
    { id: "analysis", label: "Skill Gap Analysis" },
    { id: "recommendation", label: "Learning Recommendations" },
    { id: "gamify", label: "Gamified Progress" },
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
    <ThemeProvider defaultTheme="dark">
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
          <div className="space-y-10">
            <section className="glass-card rounded-2xl p-8 sm:p-10">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="mt-2 text-3xl sm:text-4xl tracking-tight">
                  <span className="text-gradient">Your Career Command Center</span>
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Turn skill insights into action with gap analysis, personalized learning
                  recommendations, and gamified progress.
                </p>
              </div>
            </section>

            <section className="glass-card rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap gap-3 text-sm font-medium">
                    {tabs.map((tab) => (
                    <button
                      key={tab.id}
                        onClick={() => setActiveApp(tab.id)}
                      className={`relative px-4 py-2 rounded-full border transition ${
                        activeApp === tab.id
                          ? "border-cyan-600 text-cyan-700 bg-cyan-50 dark:bg-cyan-500/10"
                          : "border-border text-muted-foreground hover:border-cyan-500/50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeApp}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
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
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
