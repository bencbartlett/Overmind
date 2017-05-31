"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
// disable tslint rule, because we don't have types for these files
/* tslint:disable:no-var-requires */
const ConcatSource = require("webpack-sources").ConcatSource;
// Tiny tiny helper plugin that prepends "module.exports = " to all `.map` assets
class ScreepsSourceMapToJson {
    // constructor(_options: any) {
    //   // we don't use options
    // }
    apply(compiler) {
        compiler.plugin("emit", (compilation, cb) => {
            for (const filename in compilation.assets) {
                // matches any files ending in ".map" or ".map.js"
                if (path.basename(filename, ".js").match(/\.map/)) {
                    compilation.assets[filename] = new ConcatSource("module.exports = ", compilation.assets[filename]);
                }
            }
            cb();
        });
    }
}
exports.ScreepsSourceMapToJson = ScreepsSourceMapToJson;
//# sourceMappingURL=screeps-webpack-sources.js.map