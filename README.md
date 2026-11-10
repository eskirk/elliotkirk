# elliotkirk

Personal website. React 18 + TypeScript single-page app, bundled with webpack
and deployed over SSH to a VPS that serves the built site at `elliotkirk.com`.

## Structure

- `src/` — application source (entry `index.tsx`, `App.tsx`, components, styles).
- `src/types/env.d.ts` — ambient types for the build-time injected config.
- `favicon.ico` — the favicon **source** (repo root). Copied into `public/` by
  `html-webpack-plugin` on every build.
- `public/` — **generated build output** (gitignored). The web root the server
  serves; rebuilt on every deploy, never hand-edited or committed.
- `faro-vendor/` — vendored `@grafana` Faro packages (pinned `.tgz` `file:` deps).
- `.github/workflows/` — `main.yml` (production) and `dev.yml` (dev) deploys.

## Requirements

Node **24** (see `.nvmrc` / `engines`) and Yarn 1.x:

```sh
nvm use            # installs/uses Node 24 from .nvmrc
corepack enable    # makes `yarn` available (yarn 1 classic)
```

## Commands

| Command           | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `yarn`            | Install dependencies.                                    |
| `yarn start`      | Dev server (hot reload) at `localhost:8080`.            |
| `yarn build`      | Production build → `public/` (minified, no source maps).|
| `yarn lint`       | ESLint over `src/`.                                      |
| `yarn typecheck`  | `tsc --noEmit` (type check only).                        |
| `yarn test`       | Alias for `yarn typecheck` (no test suite yet).         |

## Deploy

`main` → production (`elliotkirk`), `dev` → staging (`elliotkirkdev`). Each
workflow runs a **checks** job (install + lint + typecheck + build) that must
pass before the SSH **deploy** job runs on the server.

## Faro configuration

The Faro collector is **not** hardcoded in source. `webpack.config.js` injects
these via `DefinePlugin` at build time (defaults preserve current behaviour):

| Env var                 | Default                                        | Meaning                          |
| ----------------------- | --------------------------------------------- | -------------------------------- |
| `FARO_COLLECTOR_URL`    | the dev collector URL                          | Faro ingest endpoint + key.      |
| `FARO_ENVIRONMENT`      | `production` / `development` (from build mode)| Reports the environment label.   |
| `FARO_APP_VERSION`      | `version` from `package.json`                  | Reported app version.            |

To point a production build at a real production collector, set
`FARO_COLLECTOR_URL` as a CI secret / variable.
