/**
 * Browser localStorage for gamification progress, keyed by resume + taleId
 * so quest completion does not leak across resumes or analysis versions.
 */

export const GAMIFY_PROGRESS_STORAGE_KEY = "skillevate-gamify-progress-v1";

export type TaleGamifyActivity = {
  courseId: string;
  title: string;
  xp: number;
  completedAt: string;
  resumeLabel: string;
};

export type TaleGamifySlice = {
  earnedXp: number;
  completedCourseIds: string[];
  completedActivities: TaleGamifyActivity[];
};

type GamifyPersistV2 = {
  version: 2;
  tales: Record<string, Record<string, TaleGamifySlice>>;
};

type GamifyPersistLegacy = {
  earnedXp: number;
  completedCourseIds: Array<string | number>;
  completedActivities: Array<TaleGamifyActivity & { courseId?: string | number }>;
};

export function emptyTaleSlice(): TaleGamifySlice {
  return {
    earnedXp: 0,
    completedCourseIds: [],
    completedActivities: [],
  };
}

function normalizeCourseId(id: unknown): string {
  if (typeof id === "number") return String(id);
  if (typeof id === "string") return id;
  return String(id ?? "");
}

function normalizeSlice(raw: TaleGamifySlice): TaleGamifySlice {
  return {
    earnedXp: raw.earnedXp,
    completedCourseIds: raw.completedCourseIds.map(normalizeCourseId),
    completedActivities: raw.completedActivities.map((a) => ({
      ...a,
      courseId: normalizeCourseId(a.courseId),
    })),
  };
}

function cloneSlice(s: TaleGamifySlice): TaleGamifySlice {
  return normalizeSlice(s);
}

function isLegacyFlat(x: unknown): x is GamifyPersistLegacy {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.earnedXp === "number" &&
    Array.isArray(o.completedCourseIds) &&
    Array.isArray(o.completedActivities) &&
    o.version !== 2
  );
}

function isV2(x: unknown): x is GamifyPersistV2 {
  return !!(x && typeof x === "object" && (x as GamifyPersistV2).version === 2 && (x as GamifyPersistV2).tales);
}

/**
 * Read progress for one resume + tale. If storage is legacy flat JSON, migrates
 * into tales[resumeId][taleId] and returns normalizedRaw to persist.
 */
export function getTaleSlice(
  raw: string | null,
  resumeId: string,
  taleId: string,
): { slice: TaleGamifySlice; normalizedRaw: string | null } {
  if (!resumeId || !taleId) {
    return { slice: emptyTaleSlice(), normalizedRaw: null };
  }

  if (!raw) {
    return { slice: emptyTaleSlice(), normalizedRaw: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { slice: emptyTaleSlice(), normalizedRaw: null };
  }

  if (isV2(parsed)) {
    const slice = parsed.tales[resumeId]?.[taleId];
    return {
      slice: slice ? normalizeSlice(slice) : emptyTaleSlice(),
      normalizedRaw: null,
    };
  }

  if (isLegacyFlat(parsed)) {
    const migratedSlice = normalizeSlice({
      earnedXp: parsed.earnedXp,
      completedCourseIds: parsed.completedCourseIds as string[],
      completedActivities: parsed.completedActivities as TaleGamifyActivity[],
    });
    const v2: GamifyPersistV2 = {
      version: 2,
      tales: {
        [resumeId]: {
          [taleId]: migratedSlice,
        },
      },
    };
    return {
      slice: cloneSlice(v2.tales[resumeId][taleId]),
      normalizedRaw: JSON.stringify(v2),
    };
  }

  return { slice: emptyTaleSlice(), normalizedRaw: null };
}

/**
 * Merge full storage blob with v2 shape, migrate legacy once if needed, then upsert slice.
 */
export function upsertTaleSlice(
  raw: string | null,
  resumeId: string,
  taleId: string,
  slice: TaleGamifySlice,
): string {
  let v2: GamifyPersistV2;

  if (!raw) {
    v2 = { version: 2, tales: {} };
  } else {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isV2(parsed)) {
        v2 = {
          version: 2,
          tales: JSON.parse(JSON.stringify(parsed.tales)) as GamifyPersistV2["tales"],
        };
      } else if (isLegacyFlat(parsed)) {
        v2 = {
          version: 2,
          tales: {
            [resumeId]: {
              [taleId]: normalizeSlice({
                earnedXp: parsed.earnedXp,
                completedCourseIds: parsed.completedCourseIds as string[],
                completedActivities: parsed.completedActivities as TaleGamifyActivity[],
              }),
            },
          },
        };
      } else {
        v2 = { version: 2, tales: {} };
      }
    } catch {
      v2 = { version: 2, tales: {} };
    }
  }

  if (!v2.tales[resumeId]) v2.tales[resumeId] = {};
  v2.tales[resumeId][taleId] = normalizeSlice(slice);
  return JSON.stringify(v2);
}
