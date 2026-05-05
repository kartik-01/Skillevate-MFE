/**
 * Tiny zero-dependency `.env` loader for the Skillevate MFE workspace.
 *
 * Why not the official `dotenv` package? To keep the dev/build dependency
 * footprint minimal — we only need a handful of `KEY=value` pairs, and no
 * variable expansion or multi-line strings.
 *
 * Resolution order (highest priority first):
 *   1. `process.env[name]`  — anything exported by the shell or set via
 *      `cross-env` in the npm scripts always wins, so CI / production can
 *      override local `.env` files without touching disk.
 *   2. Values parsed from `Skillevate-MFE/.env`.
 *
 * Use `getEnv("KEY")` from any webpack config to read a value, and
 * `getEnv("KEY", { required: true })` to fail the build immediately if the
 * value is missing. Runtime TypeScript code reads the same values via
 * `process.env.KEY`, which webpack's `DefinePlugin` substitutes at build
 * time — see `configs/createWebpackConfig.js`.
 */

const fs = require("fs");
const path = require("path");

const ENV_PATH = path.resolve(__dirname, "../.env");

const KEY_VALUE_RE = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/;
const QUOTED_RE = /^(['"])(.*)\1$/;

function parseDotenv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine || /^\s*#/.test(rawLine)) continue;
    const match = rawLine.match(KEY_VALUE_RE);
    if (!match) continue;
    const [, key, rawValue] = match;
    const quoted = rawValue.match(QUOTED_RE);
    out[key] = quoted ? quoted[2] : rawValue;
  }
  return out;
}

function loadDotenvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  try {
    return parseDotenv(fs.readFileSync(ENV_PATH, "utf8"));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[skillevate/env] Failed to read ${ENV_PATH}: ${error.message}`);
    return {};
  }
}

const dotenvValues = loadDotenvFile();

/**
 * Read an environment variable.
 *
 * @param {string} name
 * @param {{ required?: boolean, fallback?: string }} [options]
 * @returns {string} Empty string if the value is unset and not required.
 */
function getEnv(name, options = {}) {
  const fromShell = process.env[name];
  const value = fromShell !== undefined && fromShell !== "" ? fromShell : dotenvValues[name];

  if (value === undefined || value === "") {
    if (options.required) {
      throw new Error(
        `[skillevate/env] Required env var '${name}' is not set. ` +
          `Add it to Skillevate-MFE/.env (see .env.example) or export it in your shell.`,
      );
    }
    if (options.fallback !== undefined) return options.fallback;
    return "";
  }
  return value;
}

/**
 * Read all values for use by `webpack.DefinePlugin`. Each entry is wrapped in
 * `JSON.stringify` so the build embeds string literals into the bundle.
 *
 * @param {string[]} names
 * @returns {Record<string, string>}
 */
function getEnvDefinitions(names) {
  return Object.fromEntries(
    names.map((name) => [`process.env.${name}`, JSON.stringify(getEnv(name))]),
  );
}

module.exports = { getEnv, getEnvDefinitions, ENV_PATH };
