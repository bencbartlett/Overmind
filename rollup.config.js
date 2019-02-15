"use strict";

import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import progress from "rollup-plugin-progress";
import typescript from "rollup-plugin-typescript2";
import screeps from "rollup-plugin-screeps";

let cfg;
const dest = process.env.DEST;
if (!dest) {
    console.log('\x1b[46m%s\x1b[0m \x1b[36m%s\x1b[0m', 'Compiling Overmind...', '(deploy destination: none)');
} else if ((cfg = require("./screeps")[dest]) == null) {
    throw new Error("Invalid upload destination");
} else {
    console.log('\x1b[46m%s\x1b[0m \x1b[36m%s\x1b[0m', 'Compiling Overmind...', `(deploy destination: ${dest})`);
}

const ignoreWarnings = ['commonjs-proxy',
                        'Circular dependency',
                        "The 'this' keyword is equivalent to 'undefined'",
                        "Use of eval is strongly discouraged"];

export default {
    input: "src/main.ts",

    plugins: [
        progress({clearLine: true}),
        resolve(),
        commonjs({
                     namedExports: {
                         'src/Overmind_obfuscated': ['_Overmind'],
                         'screeps-profiler': ['profiler'],
                         'columnify': ['columnify']
                     }
                 }),
        typescript({tsconfig: "./tsconfig.json"}),
        screeps({config: cfg, dryRun: cfg == null})
    ],

    onwarn: function (warning) {
        // Skip default export warnings from using obfuscated overmind file in main
        for (let ignoreWarning of ignoreWarnings) {
            if (warning.toString().includes(ignoreWarning)) {
                return;
            }
        }
        // console.warn everything else
        console.warn(warning.message);
    },

    treeshake: false,

    output: {
        file: "dist/main.js",
        format: "cjs",
        sourcemap: false,
        banner: '//\n' +
                '// ___________________________________________________________\n' +
                '//\n' +
                '//  _____  _    _ _______  ______ _______ _____ __   _ ______\n' +
                '// |     |  \\  /  |______ |_____/ |  |  |   |   | \\  | |     \\\n' +
                '// |_____|   \\/   |______ |    \\_ |  |  | __|__ |  \\_| |_____/\n' +
                '//\n' +
                '// _______________________ Screeps AI ________________________\n' +
                '//\n' +
                '//\n' +
                '// Overmind repository: github.com/bencbartlett/overmind\n' +
                '//\n'
    },

}