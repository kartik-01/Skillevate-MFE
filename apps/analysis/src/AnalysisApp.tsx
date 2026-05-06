import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { Target, Upload, Zap, CheckCircle2, AlertTriangle, Trash2, Loader2, ArrowRight } from "lucide-react";
// Updated imports to use the new lightning-fast pipeline functions
import {
  analyzeDirect,
  extractJdFile,
  extractJdText,
  parseResumeSkills,
  saveAnalysis,
  AnalysisGapItem,
  ResumeSkills,
  JdSkillsResponse,
} from "./services/analysisApi";
import {
  buildRecommendationRequestFromAnalysis,
  removeRecommendationRequestForResume,
  saveRecommendationRequestForResume,
} from "./services/recommendationPayload";
import StarBorder from "./components/StarBorder";

type ResumeVersion = {
  id: string;
  version: number;
  label: string;
  originalFileName: string;
  uploadedAt: string;
};

type AnalysisResult = {
  matchPercent: number;
  verifiedStrongSkills: string[];
  verifiedListedSkills: string[];
  criticalGaps: string[];
  preferredGaps: string[];
  // Backward-compat fields consumed by recommendation module.
  verifiedSkills: string[];
  gaps: Array<{ name: string; priority: "High" | "Medium"; match: string }>;
  createdAt: string;
};

type ResumeParseState = {
  status: "idle" | "parsing" | "ready" | "error";
  skills: ResumeSkills | null;
  parsedAt: string | null;
  error: string | null;
};

// NEW: State to track background JD extraction
type JdExtractState = {
  status: "idle" | "extracting" | "ready" | "error";
  skills: JdSkillsResponse | null;
  error: string | null;
};

type PersistedAnalysisState = {
  resumeVersions: ResumeVersion[];
  selectedResumeId: string;
  analysisByResumeId: Record<string, AnalysisResult>;
  resumeParseByResumeId: Record<string, ResumeParseState>;
  jobDescription: string;
};

const ANALYSIS_STATE_STORAGE_KEY = "skillevate-analysis-state-v1";

const normalizePersistedAnalysisEntry = (raw: unknown): AnalysisResult => {
  const entry = (raw ?? {}) as Partial<AnalysisResult> & {
    verifiedSkills?: string[];
    gaps?: Array<{ name?: string; priority?: "High" | "Medium"; match?: string }>;
  };

  const verifiedStrongSkills = Array.isArray(entry.verifiedStrongSkills) ? entry.verifiedStrongSkills : [];
  const verifiedListedSkills = Array.isArray(entry.verifiedListedSkills) ? entry.verifiedListedSkills : [];
  const criticalGaps = Array.isArray(entry.criticalGaps) ? entry.criticalGaps : [];
  const preferredGaps = Array.isArray(entry.preferredGaps) ? entry.preferredGaps : [];

  const verifiedSkills =
    Array.isArray(entry.verifiedSkills) && entry.verifiedSkills.length > 0
      ? entry.verifiedSkills
      : [...verifiedStrongSkills, ...verifiedListedSkills.map((s) => `${s} (Listed)`)];

  const gaps =
    Array.isArray(entry.gaps) && entry.gaps.length > 0
      ? entry.gaps
          .map((gap) => ({
            name: String(gap?.name ?? "").trim(),
            priority: (gap?.priority === "High" ? "High" : "Medium") as "High" | "Medium",
            match: String(gap?.match ?? ""),
          }))
          .filter((gap) => gap.name.length > 0)
      : [
          ...criticalGaps.map((name) => ({ name, priority: "High" as const, match: "" })),
          ...preferredGaps.map((name) => ({ name, priority: "Medium" as const, match: "" })),
        ];

  return {
    matchPercent: typeof entry.matchPercent === "number" ? entry.matchPercent : 0,
    verifiedStrongSkills,
    verifiedListedSkills,
    criticalGaps,
    preferredGaps,
    verifiedSkills,
    gaps,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
  };
};

export function AnalysisApp() {
  const { user: auth0User, isAuthenticated } = useAuth0();
  const auth0FirstName: string =
    typeof auth0User?.given_name === "string" && auth0User.given_name.trim().length > 0
      ? auth0User.given_name.trim()
      : typeof auth0User?.name === "string" && auth0User.name.trim().length > 0
        ? auth0User.name.trim().split(/\s+/)[0]
        : typeof auth0User?.nickname === "string" && auth0User.nickname.trim().length > 0
          ? auth0User.nickname.trim()
          : "UserName";
  const currentUserName: string = isAuthenticated ? auth0FirstName : "UserName";

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState("");
  
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [analysisByResumeId, setAnalysisByResumeId] = useState<Record<string, AnalysisResult>>({});
  
  const [resumeParseByResumeId, setResumeParseByResumeId] = useState<Record<string, ResumeParseState>>({});
  /** In-memory PDF per resume version; parsing runs only on "Run AI Analysis", not on upload. */
  const [resumePdfById, setResumePdfById] = useState<Record<string, File>>({});
  // NEW: Initialize JD extraction state
  const [jdExtractState, setJdExtractState] = useState<JdExtractState>({ status: "idle", skills: null, error: null });
  
  const [resumePendingDelete, setResumePendingDelete] = useState<ResumeVersion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasPendingRunAction, setHasPendingRunAction] = useState(false);

  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const jobFileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const ACCEPTED_RESUME_EXTENSIONS = ["pdf"];
  const ACCEPTED_JOB_FILE_EXTENSIONS = ["txt", "pdf", "doc", "docx"];

  const selectedResume = resumeVersions.find((resume) => resume.id === selectedResumeId) ?? null;
  const selectedAnalysis = selectedResumeId ? analysisByResumeId[selectedResumeId] : undefined;
  const selectedResumeParseState = selectedResumeId ? resumeParseByResumeId[selectedResumeId] : undefined;
  const hasAnyAnalysis = Object.keys(analysisByResumeId).length > 0;

  const jdExtractReady = jdExtractState.status === "ready" && Boolean(jdExtractState.skills);
  const resumePdfReady = Boolean(selectedResumeId && resumePdfById[selectedResumeId]);

  const runAnalysisDisabledTitle =
    isAnalyzing || (jdExtractReady && resumePdfReady)
      ? undefined
      : !jdExtractReady && !resumePdfReady
        ? "Both an extracted job description and an uploaded resume PDF are required to run analysis."
        : !jdExtractReady
          ? "Job description must be extracted before running. Both job description and resume are required."
          : "Upload a resume PDF. Both job description and resume are required.";

  // Persistence Effects
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
      const restoredAnalysis = parsed.analysisByResumeId ?? {};
      setAnalysisByResumeId(
        Object.fromEntries(
          Object.entries(restoredAnalysis).map(([resumeId, raw]) => [resumeId, normalizePersistedAnalysisEntry(raw)]),
        ) as Record<string, AnalysisResult>,
      );
      setResumeParseByResumeId(parsed.resumeParseByResumeId ?? {});
      setJobDescription(parsed.jobDescription ?? "");
    } catch {
      // Ignore corrupted persisted state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stateToPersist: PersistedAnalysisState = {
      resumeVersions,
      selectedResumeId,
      analysisByResumeId,
      resumeParseByResumeId,
      jobDescription,
    };
    window.localStorage.setItem(ANALYSIS_STATE_STORAGE_KEY, JSON.stringify(stateToPersist));
  }, [resumeVersions, selectedResumeId, analysisByResumeId, resumeParseByResumeId, jobDescription]);

  // NEW: Debounced effect to extract JD skills in the background when typing
  useEffect(() => {
    if (jobDescription.trim().length === 0) {
      if (jdExtractState.status !== "idle") {
        setJdExtractState({ status: "idle", skills: null, error: null });
      }
      return;
    }

    setJdExtractState((prev) => ({ ...prev, status: "extracting", error: null }));

    // Wait 1.5 seconds after user stops typing before calling the API
    const timeoutId = setTimeout(async () => {
      try {
        const extractedSkills = await extractJdText(jobDescription.trim());
        setJdExtractState({ status: "ready", skills: extractedSkills, error: null });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "JD extraction failed.";
        setJdExtractState({ status: "error", skills: null, error: message });
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [jobDescription]); // Re-runs when jobDescription text changes

  const getFileExtension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

  const isAllowedFileExtension = (file: File, allowedExtensions: string[]) => {
    const extension = getFileExtension(file.name);
    return allowedExtensions.includes(extension);
  };

  const validateFileSize = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setInputError("File size must be 5MB or less.");
      return false;
    }
    setInputError("");
    return true;
  };

  const clearSelectedAnalysis = () => {
    if (!selectedResumeId) return;
    removeRecommendationRequestForResume(selectedResumeId);
    setAnalysisByResumeId((previous) => {
      if (!previous[selectedResumeId]) return previous;
      const next = { ...previous };
      delete next[selectedResumeId];
      return next;
    });
  };

  const handleResumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!isAllowedFileExtension(file, ACCEPTED_RESUME_EXTENSIONS)) {
      setInputError("Resume must be a .pdf file.");
      event.target.value = "";
      return;
    }

    if (!validateFileSize(file)) {
      event.target.value = "";
      return;
    }

    const nextVersion = resumeVersions.length + 1;
    const resumeId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `resume-${Date.now()}`;

    const newResume: ResumeVersion = {
      id: resumeId,
      version: nextVersion,
      label: `${currentUserName}-Resume-v${nextVersion}`,
      originalFileName: file.name,
      uploadedAt: new Date().toISOString(),
    };

    setResumeVersions((previous) => [...previous, newResume]);
    setSelectedResumeId(resumeId);
    setResumeFile(file);
    setAnalysisByResumeId((previous) => {
      const next = { ...previous };
      delete next[resumeId];
      return next;
    });
    setResumeParseByResumeId((previous) => ({
      ...previous,
      [resumeId]: { status: "idle", skills: null, parsedAt: null, error: null },
    }));
    setResumePdfById((previous) => ({ ...previous, [resumeId]: file }));
    setInputError("");
    setHasPendingRunAction(true);
    event.target.value = "";
  };

  const handleJobFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!isAllowedFileExtension(file, ACCEPTED_JOB_FILE_EXTENSIONS)) {
      setInputError("Job description file must be .txt, .pdf, .doc, or .docx.");
      event.target.value = "";
      return;
    }

    if (!validateFileSize(file)) {
      event.target.value = "";
      return;
    }

    setJobFile(file);
    setInputError("");
    clearSelectedAnalysis();
    setHasPendingRunAction(true);
    
    // NEW: Trigger Background JD Extraction for files
    setJdExtractState({ status: "extracting", skills: null, error: null });
    
    extractJdFile(file)
      .then((extractedSkills) => {
        setJdExtractState({ status: "ready", skills: extractedSkills, error: null });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "JD File extraction failed.";
        setJdExtractState({ status: "error", skills: null, error: message });
      });
  };

  const canRunAnalysis = !isAnalyzing && jdExtractReady && resumePdfReady;

  const handleRunAnalysis = async () => {
    if (isAnalyzing) return;
    setHasPendingRunAction(false);

    if (!selectedResumeId) {
      setInputError("Please upload and select a resume before running analysis.");
      return;
    }

    if (jdExtractState.status !== "ready" || !jdExtractState.skills) {
      setInputError("Job Description extraction is not ready yet. Please wait for background extraction to complete.");
      return;
    }

    const resumePdf = resumePdfById[selectedResumeId];
    if (!resumePdf) {
      setInputError("Please upload a resume PDF before running analysis.");
      return;
    }

    setInputError("");
    setIsAnalyzing(true);
    const analysisStartTime = Date.now();

    try {
      setResumeParseByResumeId((previous) => ({
        ...previous,
        [selectedResumeId]: { status: "parsing", skills: null, parsedAt: null, error: null },
      }));

      let resumeSkills: ResumeSkills;
      try {
        resumeSkills = await parseResumeSkills(resumePdf);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Resume parsing failed.";
        setResumeParseByResumeId((previous) => ({
          ...previous,
          [selectedResumeId]: { status: "error", skills: null, parsedAt: null, error: message },
        }));
        setInputError(`Resume parsing failed: ${message}`);
        return;
      }

      setResumeParseByResumeId((previous) => ({
        ...previous,
        [selectedResumeId]: {
          status: "ready",
          skills: resumeSkills,
          parsedAt: new Date().toISOString(),
          error: null,
        },
      }));

      // 🔥 UPDATED: Call the lightning-fast direct endpoint with pre-fetched data
      const apiResponse = await analyzeDirect(resumeSkills, jdExtractState.skills);

      const normalizeSkills = (skills: Array<{ skill: string }> | undefined) =>
        Array.from(new Set((skills ?? []).map((item) => item.skill).filter(Boolean))).slice(0, 25);

      const verifiedStrongSkills = normalizeSkills(apiResponse.gap_analysis?.matched_strong);
      const verifiedListedSkills = normalizeSkills(apiResponse.gap_analysis?.matched_listed);
      const criticalGaps = normalizeSkills(apiResponse.gap_analysis?.missing_critical).slice(0, 15);
      const preferredGaps = normalizeSkills(apiResponse.gap_analysis?.missing_preferred).slice(0, 15);

      const generatedResult: AnalysisResult = {
        matchPercent: apiResponse.gap_analysis?.match_score ?? 0,
        verifiedStrongSkills,
        verifiedListedSkills,
        criticalGaps,
        preferredGaps,
        verifiedSkills: [...verifiedStrongSkills, ...verifiedListedSkills.map((s) => `${s} (Listed)`)],
        gaps: [
          ...criticalGaps.map((name) => ({ name, priority: "High" as const, match: "" })),
          ...preferredGaps.map((name) => ({ name, priority: "Medium" as const, match: "" })),
        ],
        createdAt: new Date().toISOString(),
      };

      const elapsed = Date.now() - analysisStartTime;
      const minimumAnimationDuration = 2800;
      if (elapsed < minimumAnimationDuration) {
        await new Promise((resolve) => setTimeout(resolve, minimumAnimationDuration - elapsed));
      }

      setAnalysisByResumeId((previous) => ({
        ...previous,
        [selectedResumeId]: generatedResult,
      }));

      const recommendationBody = buildRecommendationRequestFromAnalysis({
        analysis: generatedResult,
        jdSkills: jdExtractState.skills,
        jobDescription,
        maxResults: 10,
        language: "en",
      });
      if (recommendationBody.skills.length > 0) {
        saveRecommendationRequestForResume(selectedResumeId, recommendationBody);
      }

      // Persist the analysis to MongoDB Atlas via the backend.
      // This is intentionally non-blocking: any failure here is logged but
      // must NOT roll back the in-memory result or recommendation save above.
      const userId: string | null =
        (auth0User as { sub?: string } | undefined)?.sub ?? null;
      if (userId) {
        const gapsForDb: AnalysisGapItem[] = [
          ...criticalGaps.map((skill) => ({
            skill,
            preferences: ["critical gap", "high priority"],
          })),
          ...preferredGaps.map((skill) => ({
            skill,
            preferences: ["skill gap", "medium priority"],
          })),
        ];
        const matchScore = Math.max(
          0,
          Math.min(100, Math.round(generatedResult.matchPercent)),
        );
        const resumePdfFile: File | undefined = resumePdfById[selectedResumeId];
        const jdTitle =
          jdExtractState.skills?.role_title?.trim() ||
          jobFile?.name?.replace(/\.[^.]+$/, "") ||
          "Untitled JD";
        const jdRawText = jobDescription?.trim() || jobFile?.name || "";

        try {
          await saveAnalysis({
            user_id: userId,
            resume_metadata: {
              filename:
                resumePdfFile?.name ??
                selectedResume?.originalFileName ??
                "resume.pdf",
              upload_date:
                selectedResume?.uploadedAt ?? new Date().toISOString(),
            },
            jd_metadata: { title: jdTitle, raw_text: jdRawText },
            results: { match_score: matchScore, gaps: gapsForDb },
          });
        } catch (err) {
          console.warn("[analysis] saveAnalysis failed:", err);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      setInputError(`AI analysis failed: ${message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteResume = () => {
    if (!selectedResumeId || !selectedResume) return;
    setResumePendingDelete(selectedResume);
  };

  const confirmDeleteResume = () => {
    if (!resumePendingDelete) return;

    const resumeIdToDelete = resumePendingDelete.id;
    const remainingResumes = resumeVersions.filter((resume) => resume.id !== resumeIdToDelete);

    setResumePendingDelete(null);
    setResumeVersions(remainingResumes);
    setAnalysisByResumeId((previous) => {
      const next = { ...previous };
      delete next[resumeIdToDelete];
      return next;
    });
    removeRecommendationRequestForResume(resumeIdToDelete);
    setResumeParseByResumeId((previous) => {
      const next = { ...previous };
      delete next[resumeIdToDelete];
      return next;
    });
    setResumePdfById((previous) => {
      const next = { ...previous };
      delete next[resumeIdToDelete];
      return next;
    });

    if (remainingResumes.length === 0) {
      setSelectedResumeId("");
      setResumeFile(null);
      return;
    }

    const latestRemaining = remainingResumes[remainingResumes.length - 1];
    setSelectedResumeId(latestRemaining.id);
  };

  const navigateToRecommendation = () => {
    if (typeof window === "undefined") return;
    window.location.hash = "#/recommendation";
  };

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="glass-card rounded-3xl p-6 border border-border/60">
        <h2 className="text-lg font-semibold text-foreground mb-1">Get Started</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add the job description first (we extract requirements automatically). Then upload your resume and run analysis.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1: JD first */}
          <div className="border-2 border-dashed border-border rounded-2xl p-6 hover:border-primary/70 transition-colors bg-secondary/30">
            <div className="flex items-center gap-2 mb-3 text-foreground">
              <span className="text-xs font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-md">1</span>
              <Target size={18} className="text-[#1DB896]" />
              <p className="text-sm font-semibold">Job Description</p>
            </div>

            <textarea
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value);
                clearSelectedAnalysis();
                setHasPendingRunAction(true);
              }}
              placeholder="Paste job description text here"
              rows={5}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-background"
            />

            <div className="my-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              or upload file
            </div>

            <button
              type="button"
              onClick={() => jobFileInputRef.current?.click()}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              Choose Job Description File
            </button>

            <p className="text-xs text-muted-foreground mt-2 truncate max-w-full">
              {jobFile ? `Selected: ${jobFile.name}` : "Accepted: .txt, .pdf, .doc, .docx"}
            </p>
          </div>

          {/* Step 2: Resume (independent of JD extraction; recommended order only) */}
          <button
            type="button"
            onClick={() => resumeInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-secondary/30 hover:border-primary/70 cursor-pointer"
          >
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-[#1DB896] mb-3">
              <Upload size={20} />
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-xs font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-md">2</span>
              <p className="text-sm font-semibold text-foreground">Upload Resume</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">PDF (Max 5MB)</p>
            <p className="text-xs text-muted-foreground mt-3 truncate max-w-full">
              {selectedResume
                ? `Selected: ${selectedResume.label} (${selectedResume.originalFileName})`
                : resumeFile
                ? `Selected: ${resumeFile.name}`
                : "No file selected"}
            </p>
          </button>
        </div>

        <input
          ref={resumeInputRef}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          onChange={handleResumeChange}
        />

        <input
          ref={jobFileInputRef}
          type="file"
          className="hidden"
          accept=".txt,.pdf,.doc,.docx,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleJobFileChange}
        />

        {/* Global Input Errors */}
        {inputError ? <p className="text-sm text-destructive mt-3">{inputError}</p> : null}
        
        {/* Background Task Indicators */}
        <div className="mt-3 space-y-1">
          {selectedResumeParseState?.status === "error" ? (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle size={14} /> Resume parsing failed. Please upload again.
            </p>
          ) : null}

          {/* JD Extraction Status Indicators */}
          {jdExtractState.status === "error" ? (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle size={14} /> {jdExtractState.error ?? "JD extraction failed."}
            </p>
          ) : null}
        </div>

        <div
          className="mt-6 flex justify-center"
          title={!canRunAnalysis && !isAnalyzing ? runAnalysisDisabledTitle : undefined}
        >
          {hasPendingRunAction ? (
            <StarBorder
              as="button"
              type="button"
              disabled={!canRunAnalysis}
              aria-label={
                isAnalyzing
                  ? "Running analysis"
                  : !canRunAnalysis
                    ? (runAnalysisDisabledTitle ?? "Run AI Analysis")
                    : "Run AI Analysis"
              }
              onClick={handleRunAnalysis}
              className="star-border-run cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              color="cyan"
              speed="3.5s"
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {isAnalyzing ? "Running Analysis..." : "Run AI Analysis"}
            </StarBorder>
          ) : (
            <button
              type="button"
              disabled={!canRunAnalysis}
              aria-label={
                isAnalyzing
                  ? "Running analysis"
                  : !canRunAnalysis
                    ? (runAnalysisDisabledTitle ?? "Run AI Analysis")
                    : "Run AI Analysis"
              }
              onClick={handleRunAnalysis}
              className="gradient-primary hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-lg hover:shadow-cyan-500/30 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {isAnalyzing ? "Running Analysis..." : "Run AI Analysis"}
            </button>
          )}
        </div>
        {isAnalyzing ? (
          <div className="mt-3 mx-auto w-full max-w-md">
            <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-cyan-400"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.8, ease: "linear" }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {hasAnyAnalysis || isAnalyzing ? (
        <div className="glass-card rounded-3xl p-6 border border-border/60 h-full">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-foreground">Gap Analysis Results</h2>

            {selectedAnalysis ? (
              <div className="px-3 py-1 bg-accent text-primary rounded-full text-sm font-semibold border border-primary/20 w-fit">
                {selectedAnalysis.matchPercent}% Match
              </div>
            ) : null}
          </div>

          <div className="mb-5 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Viewing analysis for</span>
            {resumeVersions.length > 1 ? (
              <select
                id="results-resume-selector"
                value={selectedResumeId}
                onChange={(event) => setSelectedResumeId(event.target.value)}
                disabled={isAnalyzing}
                className="w-full md:w-auto rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-background"
                aria-label="Viewing analysis for resume version"
              >
                {resumeVersions.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-semibold text-foreground">{selectedResume?.label ?? "selected resume"}</span>
            )}

            <button
              type="button"
              onClick={handleDeleteResume}
              disabled={isAnalyzing}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Delete selected resume"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>

          {isAnalyzing ? (
            <div className="rounded-2xl border border-dashed border-primary/30 bg-accent/40 p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-card shadow-sm text-primary mb-4">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <p className="text-foreground font-semibold">Analyzing {selectedResume?.label ?? "selected resume"}...</p>
              <p className="text-sm text-muted-foreground mt-2">This usually takes a few seconds. Preparing your gap analysis now.</p>
            </div>
          ) : selectedAnalysis ? (
            <div className="space-y-8">
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#1DB896]" />
                    Verified Skills (Segmented)
                  </h3>
                  <StarBorder
                    as="button"
                    onClick={navigateToRecommendation}
                    className="star-border-cta cursor-pointer whitespace-nowrap"
                    color="cyan"
                    speed="3.5s"
                  >
                    Learn & Earn XP
                    <ArrowRight size={14} />
                  </StarBorder>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAnalysis.verifiedStrongSkills.length > 0 ? (
                    selectedAnalysis.verifiedStrongSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-4 py-2 bg-emerald-500/10 text-foreground font-medium text-sm rounded-xl border border-emerald-500/30"
                      >
                        {skill} (Strong)
                      </span>
                    ))
                  ) : (
                    <span
                      className="px-4 py-2 bg-accent text-foreground font-medium text-sm rounded-xl border border-border"
                    >
                      No strong matched skills found
                    </span>
                  )}
                  {selectedAnalysis.verifiedListedSkills.map((skill) => (
                    <span
                      key={`listed-${skill}`}
                      className="px-4 py-2 bg-blue-500/10 text-foreground font-medium text-sm rounded-xl border border-blue-500/30"
                    >
                      {skill} (Listed)
                    </span>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border w-full" />

              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Skill Gaps (Segmented)
                  </h3>
                  <StarBorder
                    as="button"
                    onClick={navigateToRecommendation}
                    className="star-border-cta cursor-pointer whitespace-nowrap"
                    color="cyan"
                    speed="3.5s"
                  >
                    Learn & Earn XP
                    <ArrowRight size={14} />
                  </StarBorder>
                </div>
                <div className="space-y-4">
                  {selectedAnalysis.criticalGaps.length > 0 ? (
                    selectedAnalysis.criticalGaps.map((skill) => (
                      <div
                        key={`critical-${skill}`}
                        className="flex items-center justify-between p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                            <Target size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{skill}</p>
                            <p className="text-xs text-muted-foreground">Requires upskilling</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-600">
                            High Priority
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                      No critical gaps identified for this resume and job description.
                    </div>
                  )}
                  {selectedAnalysis.preferredGaps.map((skill) => (
                    <div
                      key={`preferred-${skill}`}
                      className="flex items-center justify-between p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                          <Target size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{skill}</p>
                          <p className="text-xs text-muted-foreground">Nice-to-have skill gap</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-600">
                          Medium Priority
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center">
              <p className="text-foreground font-semibold">No analysis yet for this resume.</p>
              <p className="text-sm text-muted-foreground mt-2">Provide job description input and click Run AI Analysis.</p>
            </div>
          )}
        </div>
      ) : null}

      <AnimatePresence>
        {resumePendingDelete ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-resume-title"
              className="w-full max-w-md rounded-2xl bg-slate-950 text-card-foreground p-6 shadow-2xl border border-cyan-900/40 opacity-100"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <h3 id="delete-resume-title" className="text-lg font-semibold text-foreground">
                Delete Resume Version?
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Are you sure you want to delete
                <span className="font-semibold text-foreground"> {resumePendingDelete.label}</span>? This will also remove
                its analysis result.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResumePendingDelete(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteResume}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}