import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Target, Upload, Zap, CheckCircle2, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { analyzeWithJdFile, analyzeWithJdText, parseResumeSkills, ResumeSkills } from "./services/analysisApi";

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
  createdAt: string;
};

type ResumeParseState = {
  status: "idle" | "parsing" | "ready" | "error";
  skills: ResumeSkills | null;
  parsedAt: string | null;
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

export function AnalysisApp() {
  const currentUserName = "UserName";

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState("");
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [analysisByResumeId, setAnalysisByResumeId] = useState<Record<string, AnalysisResult>>({});
  const [resumeParseByResumeId, setResumeParseByResumeId] = useState<Record<string, ResumeParseState>>({});
  const [resumePendingDelete, setResumePendingDelete] = useState<ResumeVersion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const jobFileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const ACCEPTED_RESUME_EXTENSIONS = ["pdf"];
  const ACCEPTED_JOB_FILE_EXTENSIONS = ["txt", "pdf", "doc", "docx"];

  const selectedResume = resumeVersions.find((resume) => resume.id === selectedResumeId) ?? null;
  const selectedAnalysis = selectedResumeId ? analysisByResumeId[selectedResumeId] : undefined;
  const selectedResumeParseState = selectedResumeId ? resumeParseByResumeId[selectedResumeId] : undefined;
  const hasAnyAnalysis = Object.keys(analysisByResumeId).length > 0;

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
      setResumeParseByResumeId(parsed.resumeParseByResumeId ?? {});
      setJobDescription(parsed.jobDescription ?? "");
    } catch {
      // Ignore corrupted persisted state and continue with defaults.
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
    const resumeId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `resume-${Date.now()}`;

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
      [resumeId]: {
        status: "parsing",
        skills: null,
        parsedAt: null,
        error: null,
      },
    }));
    setInputError("");
    event.target.value = "";

    void parseResumeSkills(file)
      .then((skills) => {
        setResumeParseByResumeId((previous) => ({
          ...previous,
          [resumeId]: {
            status: "ready",
            skills,
            parsedAt: new Date().toISOString(),
            error: null,
          },
        }));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Resume parsing failed.";
        setResumeParseByResumeId((previous) => ({
          ...previous,
          [resumeId]: {
            status: "error",
            skills: null,
            parsedAt: null,
            error: message,
          },
        }));
        setInputError(`Resume parsing failed: ${message}`);
      });
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
  };

  const canRunAnalysis =
    !isAnalyzing &&
    Boolean(selectedResumeId) &&
    (jobDescription.trim().length > 0 || Boolean(jobFile)) &&
    selectedResumeParseState?.status === "ready";

  const handleRunAnalysis = async () => {
    if (isAnalyzing) return;

    if (!selectedResumeId) {
      setInputError("Please upload and select a resume before running analysis.");
      return;
    }

    if (jobDescription.trim().length === 0 && !jobFile) {
      setInputError("Provide job description text or upload a job description file.");
      return;
    }

    const parseState = selectedResumeId ? resumeParseByResumeId[selectedResumeId] : undefined;
    if (!parseState || parseState.status !== "ready" || !parseState.skills) {
      setInputError("Resume parsing is not ready yet. Please wait for background parsing to complete.");
      return;
    }

    setInputError("");
    setIsAnalyzing(true);

    try {
      const apiResponse =
        jobDescription.trim().length > 0
          ? await analyzeWithJdText(jobDescription.trim(), parseState.skills)
          : await analyzeWithJdFile(jobFile as File, parseState.skills);

      const matchedSkills = [
        ...(apiResponse.gap_analysis?.matched_strong ?? []),
        ...(apiResponse.gap_analysis?.matched_listed ?? []),
      ];

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
        createdAt: new Date().toISOString(),
      };

      setAnalysisByResumeId((previous) => ({
        ...previous,
        [selectedResumeId]: generatedResult,
      }));
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
    setResumeParseByResumeId((previous) => {
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

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="glass-card rounded-3xl p-6 border border-border/60">
        <h2 className="text-lg font-semibold text-foreground mb-4">Input Data</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-primary/70 transition-colors cursor-pointer bg-secondary/30"
            onClick={() => resumeInputRef.current?.click()}
          >
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-[#1DB896] mb-3">
              <Upload size={20} />
            </div>
            <p className="text-sm font-semibold text-foreground">Upload Resume</p>
            <p className="text-xs text-muted-foreground mt-1">PDF (Max 5MB)</p>
            <p className="text-xs text-muted-foreground mt-3 truncate max-w-full">
              {selectedResume
                ? `Selected: ${selectedResume.label} (${selectedResume.originalFileName})`
                : resumeFile
                ? `Selected: ${resumeFile.name}`
                : "No file selected"}
            </p>
          </button>

          <div className="border-2 border-dashed border-border rounded-2xl p-6 hover:border-primary/70 transition-colors bg-secondary/30">
            <div className="flex items-center gap-2 mb-3 text-foreground">
              <Target size={18} className="text-[#1DB896]" />
              <p className="text-sm font-semibold">Job Description</p>
            </div>

            <textarea
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value);
                clearSelectedAnalysis();
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

        {inputError ? <p className="text-sm text-destructive mt-3">{inputError}</p> : null}
        {selectedResumeParseState?.status === "parsing" ? (
          <p className="text-sm text-muted-foreground mt-2">
            Parsing {selectedResume?.label ?? "resume"} in background. You can prepare the job description while this runs.
          </p>
        ) : null}
        {selectedResumeParseState?.status === "error" ? (
          <p className="text-sm text-destructive mt-2">
            {selectedResumeParseState.error ?? "Resume parsing failed. Please upload again."}
          </p>
        ) : null}
        {selectedResumeParseState?.status === "ready" ? (
          <p className="text-sm text-emerald-500 mt-2">
            Resume parsed and ready for analysis.
          </p>
        ) : null}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={!canRunAnalysis}
            onClick={handleRunAnalysis}
            className="gradient-primary hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-lg hover:shadow-cyan-500/30 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {isAnalyzing ? "Running Analysis..." : "Run AI Analysis"}
          </button>
        </div>
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1DB896]" />
                  Verified Skills (Segmented)
                </h3>
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Skill Gaps (Segmented)
                </h3>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-resume-title"
              className="w-full max-w-md rounded-2xl bg-card text-card-foreground p-6 shadow-2xl border border-border"
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
