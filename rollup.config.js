"use strict";

import clean from "rollup-plugin-clean";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import screeps from "rollup-plugin-screeps";

let cfg;
const i = process.argv.indexOf("--dest") + 1;
if (i == 0) {
    console.log("No destination specified - code will be compiled but not uploaded");
} else if (i >= process.argv.length || (cfg = require("./screeps")[process.argv[i]]) == null) {
    throw new Error("Invalid upload destination");
}

export default {
    input: "src/main.ts",
    output: {
        file: "dist/main.js",
        format: "cjs"
    },

    sourcemap: true,

    plugins: [
        clean(),
        resolve(),
        commonjs(),
        typescript({tsconfig: "./tsconfig.json"}),
        screeps({config: cfg, dryRun: cfg == null}),
    ]

}
