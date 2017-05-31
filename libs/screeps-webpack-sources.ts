import * as path from "path";
import * as webpack from "webpack";

// disable tslint rule, because we don't have types for these files
/* tslint:disable:no-var-requires */
const ConcatSource = require("webpack-sources").ConcatSource;

// Tiny tiny helper plugin that prepends "module.exports = " to all `.map` assets
export class ScreepsSourceMapToJson implements webpack.Plugin {
  // constructor(_options: any) {
  //   // we don't use options
  // }

  public apply(compiler: webpack.Compiler) {
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
