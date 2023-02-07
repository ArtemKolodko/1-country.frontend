// eslint-disable-next-line import/no-extraneous-dependencies
require('dotenv').config()
const path = require('path')
const webpack = require('webpack')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
const Dotenv = require('dotenv-webpack')
const CopyPlugin = require('copy-webpack-plugin')

console.log(!process.env.HTTP)

module.exports = {
  devServer: {
    port: 3100,
    https: !process.env.HTTP,
    http2: !process.env.HTTP,
    historyApiFallback: {
      disableDotRule: true,
    },
    hot: false,
    client: {
      overlay: false,
      progress: true,
    },
  },
  cache: {
    type: 'filesystem',
  },
  module: {
    noParse: /\.wasm$/,
    parser: {
      javascript: {
        importExportsPresence: false,
      },
    },
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env',
                {
                  useBuiltIns: 'usage',
                  corejs: 3,
                  modules: 'cjs'
                }],
              '@babel/preset-react',
            ]
          }
        }
      },
      {
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: { not: [/el/] }, // exclude react component if *.svg?el
      },
      {
        test: /\.svg$/i,
        resourceQuery: /el/, // *.svg?el
        use: ['@svgr/webpack'],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          'file-loader',
        ],
      },
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: 'style-loader',
          }, {
            loader: 'css-loader', // translates CSS into CommonJS
          }, {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              }
            }
          }
        ]
      }
    ],
  },
  entry: {
    main: ['./src/index.js'],
  },
  devtool: process.env.DEBUG && 'source-map',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/'
  },

  externals: {
    path: 'path',
    fs: 'fs',
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    extensions: ['.jsx', '.js'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      os: require.resolve('os-browserify'),
      url: require.resolve('url')
    }
  },
  plugins: [
    new Dotenv({
      allowEmptyValues: true,
      systemvars: true,
    }),

    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'index.html',
      template: 'assets/index.html',
      environment: process.env.NODE_ENV,
      hash: true
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    process.env.SIZE_ANALYSIS ? new BundleAnalyzerPlugin({ }) : null,
    new CopyPlugin({
      patterns: [
        'assets/_redirects'
      ],
    }),
  ].filter(i => i)
}
