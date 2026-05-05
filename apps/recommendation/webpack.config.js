const path = require("path");
const createWebpackConfig = require("../../configs/createWebpackConfig");
const { getEnv } = require("../../configs/env");

module.exports = createWebpackConfig({
  appName: "recommendation",
  port: Number(process.env.PORT || 3001),
  federationName: "recommendation",
  exposes: {
    "./Widget": path.resolve(__dirname, "src/Widget"),
  },
  notifyHostReloadUrl: getEnv("HOST_RELOAD_URL"),
});
