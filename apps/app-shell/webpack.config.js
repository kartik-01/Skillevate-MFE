const createWebpackConfig = require("../../configs/createWebpackConfig");

const isProd = process.env.NODE_ENV === "production";

module.exports = createWebpackConfig({
  appName: "app-shell",
  port: Number(process.env.PORT || 3000),
  federationName: "app_shell",
  remotes: isProd
    ? {
        recommendation: "recommendation@http://localhost:3001/remoteEntry.js",
        gamify: "gamify@http://localhost:3002/remoteEntry.js",
        analysis: "analysis@http://localhost:3003/remoteEntry.js",
      }
    : {
        recommendation: "recommendation@http://localhost:3001/remoteEntry.js",
        gamify: "gamify@http://localhost:3002/remoteEntry.js",
        analysis: "analysis@http://localhost:3003/remoteEntry.js",
      },
  useEnhancedRuntime: true,
});
