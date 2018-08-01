"use strict";

// noinspection NpmUsedModulesInstalled
import clear from "rollup-plugin-clear";
// noinspection NpmUsedModulesInstalled
import resolve from "rollup-plugin-node-resolve";
// noinspection NpmUsedModulesInstalled
import commonjs from "rollup-plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
// noinspection NpmUsedModulesInstalled
import screeps from "rollup-plugin-screeps";

let cfg;
const dest = process.env.DEST;
if (!dest) {
    console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps")[dest]) == null) {
    throw new Error("Invalid upload destination");
}

export default {
    input: "src/main.ts",
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
    onwarn: function (warning) {
        // Skip default export warnings from using obfuscated overmind file in main
        if (warning.toString().includes('commonjs-proxy')) {
            return;
        }
        if (warning.toString().includes('Circular dependency')) {
            return;
        }
        // console.warn everything else
        console.warn(warning.message);
    },
    plugins: [
        clear({targets: ["dist"]}),
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
    ]
}