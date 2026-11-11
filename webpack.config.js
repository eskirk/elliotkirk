const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const pkg = require('./package.json');

// Build mode is driven by NODE_ENV so `yarn build` (production) and
// `yarn start` (development) behave correctly. The default is development
// to match the dev server.
const mode = process.env.NODE_ENV || 'development';

// Emits robots.txt and sitemap.xml (kept in src/) into the build output so
// they end up at the site root. public/ is gitignored and wiped on production
// builds, so these sources live in src/ and are copied in here.
class EmitStaticAssetsPlugin {
  apply(compiler) {
    compiler.hooks.emit.tap('EmitStaticAssetsPlugin', (compilation) => {
      for (const file of ['robots.txt', 'sitemap.xml']) {
        const src = path.join(__dirname, 'src', file);
        compilation.assets[file] = new webpack.sources.RawSource(
          fs.readFileSync(src, 'utf8')
        );
      }
    });
  }
}

module.exports = {
  mode,
  entry: path.resolve(__dirname, './src/index.tsx'),
  // Production ships no source maps / dev tooling; development keeps them.
  devtool: mode === 'production' ? false : 'eval-source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: ['ts-loader'],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: 'html-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'index.html'),
      favicon: 'favicon.ico',
    }),
    new EmitStaticAssetsPlugin(),
    // Inject Faro configuration at build time so no secret/endpoint is
    // hardcoded in source. Defaults keep today's behaviour (dev collector);
    // set FARO_COLLECTOR_URL / FARO_ENVIRONMENT in CI to target production.
    new webpack.DefinePlugin({
      'process.env.FARO_COLLECTOR_URL': JSON.stringify(
        process.env.FARO_COLLECTOR_URL ||
          'https://faro-collector-dev-us-central-0.grafana-dev.net/collect/2cc4b89fb2f942929562684139620993'
      ),
      'process.env.FARO_ENVIRONMENT': JSON.stringify(
        process.env.FARO_ENVIRONMENT ||
          (mode === 'production' ? 'production' : 'development')
      ),
      'process.env.FARO_APP_VERSION': JSON.stringify(pkg.version),
    }),
  ],
  output: {
    // `public/` is the web root the server serves; it is generated entirely
    // by the build and is gitignored. `clean` wipes prior output before a
    // production build but preserves the favicon that HtmlWebpackPlugin
    // copies in from ./favicon.ico.
    path: path.resolve(__dirname, './public/'),
    filename: 'main.js',
    clean: mode === 'production' ? { keep: /favicon\.ico$/ } : false,
  },
  devServer: {
    static: path.resolve(__dirname, './public'),
    hot: true
  },
};
