const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");
const { container } = webpack;
const { ModuleFederationPlugin } = container;
const {
  ModuleFederationPlugin: EnhancedModuleFederationPlugin,
  FederationRuntimePlugin,
} = require("@module-federation/enhanced");

const { createSharedConfig, resolveWorkspaceAliases } = require("../webpack.shared");
const { getEnvDefinitions } = require("./env");

// Every env var that should be readable from the React bundle as `process.env.X`.
// Values come from `Skillevate-MFE/.env` (or the shell) — see `configs/env.js`.
// Add new keys here when the runtime needs them; do not embed default URLs.
const RUNTIME_ENV_KEYS = [
  "ANALYSIS_API_BASE_URL",
  "ANALYSIS_API_PATH_ROOT",
  "ANALYSIS_DEFAULT_INFERENCE",
  "ANALYSIS_RESUME_PARSER_INFERENCE",
  "SKILLEVATE_GAMIFICATION_URL",
  "SKILLEVATE_RECOMMENDATION_URL",
  "USER_SERVICE_URL",
  "AUTH0_AUDIENCE",
];

function createWebpackConfig(options) {
  const {
    appName,
    port,
    federationName,
    remotes,
    exposes,
    useEnhancedRuntime = false,
    notifyHostReloadUrl,
  } = options;

  const isProd = process.env.NODE_ENV === "production";

  return {
    entry: path.resolve(__dirname, `../apps/${appName}/src/index.ts`),
    mode: isProd ? "production" : "development",
    devtool: isProd ? "source-map" : "eval-cheap-module-source-map",
    output: {
      path: path.resolve(__dirname, `../apps/${appName}/dist`),
      filename: isProd ? "[name].[contenthash].js" : "[name].js",
      publicPath: "auto",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"],
      alias: {
        ...resolveWorkspaceAliases,
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env", { targets: "defaults" }],
                ["@babel/preset-react", { runtime: "automatic" }],
                "@babel/preset-typescript",
              ],
            },
          },
        },
        {
          test: /\.css$/i,
          use: [
            isProd ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
            "postcss-loader",
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, `../apps/${appName}/public/index.html`),
      }),
      new MiniCssExtractPlugin({
        filename: isProd ? "[name].[contenthash].css" : "[name].css",
      }),
      new webpack.DefinePlugin(getEnvDefinitions(RUNTIME_ENV_KEYS)),
      useEnhancedRuntime
        ? new EnhancedModuleFederationPlugin({
            name: federationName,
            filename: "remoteEntry.js",
            ...(remotes && { remotes }),
            ...(exposes && { exposes }),
            shared: createSharedConfig(),
          })
        : new ModuleFederationPlugin({
            name: federationName,
            filename: "remoteEntry.js",
            ...(remotes && { remotes }),
            ...(exposes && { exposes }),
            shared: createSharedConfig(),
          }),
      useEnhancedRuntime && !isProd
        ? new FederationRuntimePlugin({ reloadOnRemoteChange: true })
        : null,
    ].filter(Boolean),
    devServer: {
      port,
      hot: true,
      liveReload: true,
      historyApiFallback: true,
      headers: { "Access-Control-Allow-Origin": "*" },
      client: { overlay: false },
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) throw new Error("webpack-dev-server is not defined");

        if (notifyHostReloadUrl) {
          devServer.compiler.hooks.done.tap("NotifyHostReload", () => {
            fetch(notifyHostReloadUrl).catch(() => {});
          });
        }

        if (useEnhancedRuntime) {
          devServer.app.get("/__trigger_reload__", (_req, res) => {
            res.sendStatus(200);
            setTimeout(() => {
              devServer.sendMessage(devServer.webSocketServer.clients, "static-changed");
            }, 500);
          });
        }

        return middlewares;
      },
    },
    performance: {
      hints: false,
    },
  };
}

module.exports = createWebpackConfig;
