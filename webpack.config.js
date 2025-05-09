const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// 개발 모드 여부
const isDev = process.env.NODE_ENV === 'development';

module.exports = {
    mode: isDev ? 'development' : 'production',
    entry: {
        game: './src/game.js',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].[contenthash].js',
        assetModuleFilename: 'assets/[hash][ext][query]'
    },
    target: 'web', // Electron 렌더러는 웹 환경
    devtool: isDev ? 'eval-source-map' : false,
    module: {
        rules: [
            // JavaScript 파일 처리
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            // CSS 파일 처리
            {
                test: /\.css$/,
                use: [
                    isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
                    'css-loader'
                ]
            },
            // 이미지 및 폰트 파일 처리
            {
                test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
                type: 'asset/images'
            },
            // JSON 파일 처리
            {
                test: /\.json$/,
                type: 'asset/data',
                generator: {
                    filename: 'assets/data/[name][ext]'
                }
            },
            // 오디오 파일 처리
            {
                test: /\.(mp3|ogg|wav)$/,
                type: 'asset/audio',
                generator: {
                    filename: 'assets/audio/[name][ext]'
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.json'],
        alias: {
            // 소스 폴더 별칭 설정
            '@scenes': path.resolve(__dirname, 'src/scenes'),
            '@entities': path.resolve(__dirname, 'src/entities'),
            '@systems': path.resolve(__dirname, 'src/systems'),
            '@ui': path.resolve(__dirname, 'src/ui'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@assets': path.resolve(__dirname, 'assets'),
        }
    },
    optimization: {
        minimize: !isDev,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
        // 청크 분리
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all'
                }
            }
        }
    },
    plugins: [
        // 빌드 폴더 정리
        new CleanWebpackPlugin(),

        // HTML 템플릿 생성
        new HtmlWebpackPlugin({
            template: './index.html',
            filename: 'index.html',
            minify: !isDev && {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true
            }
        }),

        // CSS 추출
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css'
        }),

        // 에셋 복사
        new CopyWebpackPlugin({
            patterns: [
                // 기본 에셋 복사
                {
                    from: 'assets',
                    to: 'assets',
                    globOptions: {
                        // node_modules나 이미 다른 규칙으로 처리되는 파일은 제외
                        ignore: ['**/*.js', '**/*.css', '**/*.html']
                    }
                },
                // 게임 데이터 JSON 파일 복사
                {
                    from: 'assets/data',
                    to: 'assets/data'
                }
            ]
        })
    ],
    // 성능 힌트 설정
    performance: {
        maxEntrypointSize: 1024000,
        maxAssetSize: 1024000,
        hints: isDev ? false : 'warning'
    },
    // 개발 서버 설정
    devServer: {
        static: {
            directory: path.join(__dirname, 'build'),
        },
        compress: true,
        port: 9000,
        hot: true,
    }
};