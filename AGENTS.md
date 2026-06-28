# AGENTS.md

## Cursor Cloud specific instructions

`elliotkirk` is a personal website: React 18 + TypeScript bundled with webpack 5. It is a
static single-page app (no backend).

### Toolchain
- Requires Node 24 (`.nvmrc` / `engines.node >=24`). Node is installed via `nvm`; the
  startup update script runs `nvm use 24`. If `node -v` reports v22, the harness-injected
  system node is shadowing it — run `nvm use 24` (yarn is provided through `corepack`).
- Package manager is **yarn** (`yarn.lock`). Install with `yarn install`.

### Run / build / lint
- Dev server: the `yarn start` script is `webpack-dev-server --mode development --open --hot`.
  Two caveats in the cloud VM: `--open` cannot launch a browser (harmless warning), and the
  default dev-server port is **8080**, which collides with the `population-sim` Go server.
  Run on a free port instead, e.g. `npx webpack serve --mode development --hot --port 3001`.
- Build: `yarn build` (webpack, output in `public/`).
- There is no configured `test` or `lint` script. The committed `.eslintrc.json` predates the
  React 17+ automatic JSX transform, so a bare `eslint` run reports a false-positive
  `react/react-in-jsx-scope` error; the actual build uses babel/ts-loader and is unaffected.

### Notes
- The `@grafana/faro-*` dependencies are vendored as local tarballs in `faro-vendor/`.
