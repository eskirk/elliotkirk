# AGENTS.md

## Cursor Cloud specific instructions

`elliotkirk` is the personal website (elliotkirk.com): a React + TypeScript single-page app
bundled with webpack. Standard scripts live in `package.json` (`yarn start`, `yarn build`).

Service / dev workflow notes (non-obvious bits only):

- Node 24 is required (`.nvmrc` / `engines.node >= 24`) and the package manager is **yarn classic**
  (enabled through corepack). The startup update script already installs Node 24 and runs
  `yarn install`.
- PATH gotcha: the base image ships a `/exec-daemon/node` (Node 22) that shadows the nvm-managed
  Node 24 even after `nvm use 24`. Before running `yarn`, prepend the nvm bin to PATH so the right
  node is used, e.g.:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24; export PATH="$NVM_DIR/versions/node/v24.18.0/bin:$PATH"`.
  Without this, commands silently run under Node 22.
- Run (dev): `yarn start` launches `webpack-dev-server` at http://localhost:8080/. The script
  passes `--open`, which just tries to open a browser and is harmless in a headless VM.
- Build: `yarn build` (webpack) emits to `public/`.
- The `@grafana/faro-*` dependencies are vendored as local tarballs in `faro-vendor/`; `yarn`
  resolves them from disk, so no registry access is needed for those.
- Tests: there is no real test suite (`yarn test` is a placeholder that exits 1).
- Lint: there is no `lint` script; run ESLint directly with `npx eslint src --ext .ts,.tsx`.
  Note: ESLint currently reports one pre-existing error (`react/react-in-jsx-scope` in
  `src/index.tsx`) because the eslint config predates the new JSX runtime. This is a known
  code/config issue, not an environment problem.
