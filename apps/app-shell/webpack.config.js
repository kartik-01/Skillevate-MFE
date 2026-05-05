const createWebpackConfig = require("../../configs/createWebpackConfig");
const { getEnv } = require("../../configs/env");

// Module Federation remote dev-server URLs are required at build time.
// They live in Skillevate-MFE/.env so we never hard-code localhost here.
const remotes = {
  recommendation: `recommendation@${getEnv("REMOTE_RECOMMENDATION_URL", { required: true })}/remoteEntry.js`,
  gamify: `gamify@${getEnv("REMOTE_GAMIFY_URL", { required: true })}/remoteEntry.js`,
  analysis: `analysis@${getEnv("REMOTE_ANALYSIS_URL", { required: true })}/remoteEntry.js`,
};

module.exports = createWebpackConfig({
  appName: "app-shell",
  port: Number(process.env.PORT || 3000),
  federationName: "app_shell",
  remotes,
  useEnhancedRuntime: true,
});
