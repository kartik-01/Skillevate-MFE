const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

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
      new webpack.DefinePlugin({
        "process.env.SKILLEVATE_RESUME_PARSER_URL": JSON.stringify(
          process.env.SKILLEVATE_RESUME_PARSER_URL || "http://localhost:8001"
        ),
        "process.env.SKILLEVATE_JD_ANALYZER_URL": JSON.stringify(
          process.env.SKILLEVATE_JD_ANALYZER_URL || "http://localhost:8000"
        ),
        "process.env.SKILLEVATE_RESUME_PARSER_INFERENCE": JSON.stringify(
          process.env.SKILLEVATE_RESUME_PARSER_INFERENCE || "none"
        ),
        "process.env.SKILLEVATE_JD_ANALYZER_INFERENCE": JSON.stringify(
          process.env.SKILLEVATE_JD_ANALYZER_INFERENCE || "groq"
        ),
      }),
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
