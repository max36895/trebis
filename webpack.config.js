const path = require('path');
const webpack = require('webpack');

const paths = {
    src: path.resolve(__dirname, 'src'),
    dist: path.resolve(__dirname, 'dist')
};

const config = {
    context: paths.src,
    entry: {
        app: './index'
    },
    output: {
        path: paths.dist,
        filename: 'index.js'
    },
    resolve: {
        extensions: ['.ts']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            }
        ]
    },
    mode: ((process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) ? 'production' : 'development')
};

if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
    config.devtool = 'inline-source-map';
}

module.exports = config;
