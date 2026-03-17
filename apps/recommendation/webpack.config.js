const path = require("path");
const createWebpackConfig = require("../../configs/createWebpackConfig");

module.exports = createWebpackConfig({
  appName: "recommendation",
  port: Number(process.env.PORT || 3001),
  federationName: "recommendation",
  exposes: {
    "./Widget": path.resolve(__dirname, "src/Widget"),
  },
  notifyHostReloadUrl: "http://localhost:3000/__trigger_reload__",
});
