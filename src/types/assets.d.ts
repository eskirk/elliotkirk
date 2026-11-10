// Allow importing non-JS assets (stylesheets) without TypeScript complaining.
// Webpack handles these via sass-loader / css-loader (see webpack.config.js);
// these declarations only satisfy the type checker.
declare module '*.scss';
declare module '*.css';
