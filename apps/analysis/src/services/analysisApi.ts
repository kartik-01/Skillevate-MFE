type ParsedResumeSkillsApiResponse = {
  name?: string | null;
  skills?: {
    strong?: string[];
    listed?: string[];
  };
};

type GapSkillMatch = {
  skill?: string;
};

type GapSkill = {
  skill?: string;
};

type JdAnalyzerApiResponse = {
  gap_analysis?: {
    match_score?: number;
    matched_strong?: GapSkillMatch[];
    missing_critical?: GapSkill[];
    missing_preferred?: GapSkill[];
  };
};

export type ParsedResumeSkills = {
  name: string | null;
  strong: string[];
  listed: string[];
};

export type NormalizedAnalysisResult = {
  matchPercent: number;
  verifiedSkills: string[];
  gaps: Array<{ name: string; priority: "High" | "Medium"; match: string }>;
  createdAt: string;
};

const RESUME_PARSER_BASE_URL =
  process.env.SKILLEVATE_RESUME_PARSER_URL || "http://localhost:8001";
const JD_ANALYZER_BASE_URL =
  process.env.SKILLEVATE_JD_ANALYZER_URL || "http://localhost:8000";
const RESUME_PARSER_INFERENCE =
  process.env.SKILLEVATE_RESUME_PARSER_INFERENCE || "none";
const JD_ANALYZER_INFERENCE =
  process.env.SKILLEVATE_JD_ANALYZER_INFERENCE || "groq";

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function normalizeResumeSkills(response: ParsedResumeSkillsApiResponse): ParsedResumeSkills {
  return {
    name: response.name ?? null,
    strong: uniqueStrings(response.skills?.strong ?? []),
    listed: uniqueStrings(response.skills?.listed ?? []),
  };
}

function normalizeAnalysis(response: JdAnalyzerApiResponse): NormalizedAnalysisResult {
  const gapAnalysis = response.gap_analysis;

  return {
    matchPercent: Math.max(
      0,
      Math.min(100, Math.round(Number(gapAnalysis?.match_score ?? 0)))
    ),
    verifiedSkills: uniqueStrings(
      (gapAnalysis?.matched_strong ?? []).map((item) => item.skill)
    ),
    gaps: [
      ...uniqueStrings(
        (gapAnalysis?.missing_critical ?? []).map((item) => item.skill)
      ).map((name) => ({
        name,
        priority: "High" as const,
        match: "0%",
      })),
      ...uniqueStrings(
        (gapAnalysis?.missing_preferred ?? []).map((item) => item.skill)
      ).map((name) => ({
        name,
        priority: "Medium" as const,
        match: "0%",
      })),
    ],
    createdAt: new Date().toISOString(),
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { detail?: unknown; message?: unknown };

        if (typeof parsed.detail === "string") {
          message = parsed.detail;
        } else if (typeof parsed.message === "string") {
          message = parsed.message;
        }
      } catch {
        message = raw.trim() || message;
      }
    }

    throw new Error(message);
  }

  if (!raw) {
    throw new Error("Received an empty response from the server.");
  }

  return JSON.parse(raw) as T;
}

function toResumeSkillsPayload(resumeSkills: ParsedResumeSkills) {
  return {
    strong: resumeSkills.strong,
    listed: resumeSkills.listed,
  };
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export async function parseResumeSkills(file: File): Promise<ParsedResumeSkills> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("inference", RESUME_PARSER_INFERENCE);
  formData.append("enrich", "false");

  const response = await fetch(buildUrl(RESUME_PARSER_BASE_URL, "/parse/skills"), {
    method: "POST",
    body: formData,
  });

  const parsed = await parseJsonResponse<ParsedResumeSkillsApiResponse>(response);
  return normalizeResumeSkills(parsed);
}

export async function analyzeResumeAgainstJobText(
  resumeSkills: ParsedResumeSkills,
  jobDescription: string
): Promise<NormalizedAnalysisResult> {
  const response = await fetch(buildUrl(JD_ANALYZER_BASE_URL, "/analyze"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jd_text: jobDescription,
      inference: JD_ANALYZER_INFERENCE,
      resume_skills: toResumeSkillsPayload(resumeSkills),
    }),
  });

  const parsed = await parseJsonResponse<JdAnalyzerApiResponse>(response);
  return normalizeAnalysis(parsed);
}

export async function analyzeResumeAgainstJobFile(
  resumeSkills: ParsedResumeSkills,
  jobFile: File
): Promise<NormalizedAnalysisResult> {
  if (getFileExtension(jobFile.name) === "txt") {
    const fileText = await jobFile.text();
    return analyzeResumeAgainstJobText(resumeSkills, fileText);
  }

  const formData = new FormData();
  formData.append("file", jobFile);
  formData.append("inference", JD_ANALYZER_INFERENCE);
  formData.append(
    "resume_skills",
    JSON.stringify(toResumeSkillsPayload(resumeSkills))
  );

  const response = await fetch(buildUrl(JD_ANALYZER_BASE_URL, "/analyze/pdf"), {
    method: "POST",
    body: formData,
  });

  const parsed = await parseJsonResponse<JdAnalyzerApiResponse>(response);
  return normalizeAnalysis(parsed);
}
