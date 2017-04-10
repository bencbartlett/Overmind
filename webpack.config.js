module.exports = {
    entry: "./src/main.ts",
    output: {
        filename: "./main.js",
        pathinfo: true,
        libraryTarget: "commonjs2",
    },

    target: "node",

    node: {
        console: true,
        global: true,
        process: false,
        Buffer: false,
        __filename: false,
        __dirname: false,
    },

    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: ['', '.js', '.ts', '.d.ts', '.tsx']
    },

    module: {
        loaders: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
            { test: /\.tsx?$/, loader: "ts-loader" }
        ],
    },
};