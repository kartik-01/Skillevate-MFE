type RemoteImportResult =
  | { default?: unknown }
  | ((props?: unknown) => unknown)
  | null
  | undefined;

export async function loadRemoteSafely(importFn: () => Promise<unknown>) {
  try {
    const mod = (await importFn()) as RemoteImportResult;

    if (typeof mod === "function") {
      return { default: mod };
    }

    if (
      mod &&
      typeof mod === "object" &&
      "default" in mod &&
      typeof mod.default === "function"
    ) {
      return mod;
    }

    if (!mod) {
      console.warn("[loadRemoteSafely] invalid default export:", mod);
      return { default: null };
    }

    console.warn("[loadRemoteSafely] invalid default export:", mod);
    return mod;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (
      /Failed to fetch|Script error|Loading chunk|ChunkLoadError|network error/i.test(
        msg
      )
    ) {
      console.warn("[loadRemoteSafely] remote rebuilding, skipping…");
      return { default: null };
    }
    console.error("[loadRemoteSafely] fatal remote error:", e);
    return { default: null };
  }
}
