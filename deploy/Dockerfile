# Multi-stage production image for each MFE static bundle (nginx serves `apps/<APP_NAME>/dist`).
# Build from repo root: Skillevate-MFE/

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY postcss.config.cjs tsconfig.base.json webpack.shared.js ./
COPY configs ./configs
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --no-frozen-lockfile

FROM deps AS builder
ARG APP_NAME

# Module Federation remote base URLs — required only for `app-shell` webpack config (validated at webpack build).
ARG REMOTE_RECOMMENDATION_URL=""
ARG REMOTE_GAMIFY_URL=""
ARG REMOTE_ANALYSIS_URL=""

# API / Auth URLs inlined into bundles via webpack DefinePlugin (see configs/createWebpackConfig.js).
ARG USER_SERVICE_URL=""
ARG ANALYSIS_API_BASE_URL=""
ARG ANALYSIS_API_PATH_ROOT=""
ARG ANALYSIS_DEFAULT_INFERENCE=""
ARG ANALYSIS_RESUME_PARSER_INFERENCE=""
ARG SKILLEVATE_RECOMMENDATION_URL=""
ARG SKILLEVATE_GAMIFICATION_URL=""
ARG AUTH0_AUDIENCE=""
ARG HOST_RELOAD_URL=""

ENV NODE_ENV=production \
    REMOTE_RECOMMENDATION_URL=$REMOTE_RECOMMENDATION_URL \
    REMOTE_GAMIFY_URL=$REMOTE_GAMIFY_URL \
    REMOTE_ANALYSIS_URL=$REMOTE_ANALYSIS_URL \
    USER_SERVICE_URL=$USER_SERVICE_URL \
    ANALYSIS_API_BASE_URL=$ANALYSIS_API_BASE_URL \
    ANALYSIS_API_PATH_ROOT=$ANALYSIS_API_PATH_ROOT \
    ANALYSIS_DEFAULT_INFERENCE=$ANALYSIS_DEFAULT_INFERENCE \
    ANALYSIS_RESUME_PARSER_INFERENCE=$ANALYSIS_RESUME_PARSER_INFERENCE \
    SKILLEVATE_RECOMMENDATION_URL=$SKILLEVATE_RECOMMENDATION_URL \
    SKILLEVATE_GAMIFICATION_URL=$SKILLEVATE_GAMIFICATION_URL \
    AUTH0_AUDIENCE=$AUTH0_AUDIENCE \
    HOST_RELOAD_URL=$HOST_RELOAD_URL

RUN test -n "$APP_NAME" || (echo 'APP_NAME is required (e.g. app-shell, recommendation, gamify, analysis)' && exit 1)
RUN pnpm exec cross-env NODE_ENV=production webpack --config "apps/${APP_NAME}/webpack.config.js"

FROM nginx:1.27-alpine AS runner
ARG APP_NAME
COPY deploy/nginx-default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/${APP_NAME}/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
