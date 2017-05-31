"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
// the "options" object is passed via commandline args
// see: https://github.com/webpack/webpack/issues/2254
function webpackConfig(options) {
    if (options === void 0) { options = {}; }
    // set some defaults
    _.defaults(options, {
        ENV: "dev",
        ROOT: __dirname,
        TEST: false,
    });
    var config = require("./config/config." + options.ENV)(options);
    // call `toConfig` to convert to webpack object, and return it
    return config.toConfig();
}
module.exports = webpackConfig;
