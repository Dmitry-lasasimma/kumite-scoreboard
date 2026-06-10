const path = require('path');
const nodeExternals = require('webpack-node-externals');

const common = {
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: '[name].js',
  },
};

module.exports = [
  {
    ...common,
    entry: { index: './src/main/index.ts' },
    target: 'electron-main',
    externals: [nodeExternals()],
  },
  {
    ...common,
    entry: { preload: './src/main/preload.ts' },
    target: 'electron-preload',
    externals: [nodeExternals()],
  },
];
