const path = require("path");
const createWebpackConfig = require("../../configs/createWebpackConfig");
const { getEnv } = require("../../configs/env");

module.exports = createWebpackConfig({
  appName: "gamify",
  port: Number(process.env.PORT || 3002),
  federationName: "gamify",
  exposes: {
    "./Widget": path.resolve(__dirname, "src/Widget"),
  },
  notifyHostReloadUrl: getEnv("HOST_RELOAD_URL"),
});
