const path = require("path");
const createWebpackConfig = require("../../configs/createWebpackConfig");

module.exports = createWebpackConfig({
  appName: "analysis",
  port: Number(process.env.PORT || 3003),
  federationName: "analysis",
  exposes: {
    "./Widget": path.resolve(__dirname, "src/Widget"),
  },
  notifyHostReloadUrl: "http://localhost:3000/__trigger_reload__",
});
