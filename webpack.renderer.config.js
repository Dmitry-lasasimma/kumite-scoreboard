const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const is_dev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: is_dev ? 'development' : 'production',
  entry: {
    renderer: './src/renderer/index.tsx',
    spectator: './src/spectator/index.tsx',
  },
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          is_dev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      chunks: ['renderer'],
      title: 'Kumite Scoreboard - Operator',
    }),
    new HtmlWebpackPlugin({
      template: './public/spectator.html',
      filename: 'spectator.html',
      chunks: ['spectator'],
      title: 'Kumite Scoreboard - Spectator',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/fonts', to: 'fonts' },
        { from: 'public/sounds', to: 'sounds' },
      ],
    }),
    ...(is_dev ? [] : [new MiniCssExtractPlugin({ filename: '[name].css' })]),
  ],
  devServer: {
    port: 3000,
    hot: true,
    static: { directory: path.join(__dirname, 'public') },
  },
};
