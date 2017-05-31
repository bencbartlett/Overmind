import * as _ from "lodash";
import * as webpack from "webpack";
import * as Config from "webpack-chain";
// import * as path from 'path';

import { EnvOptions } from "./config";

// the "options" object is passed via commandline args
// see: https://github.com/webpack/webpack/issues/2254
function webpackConfig(options: EnvOptions = {}): webpack.Configuration {
  // set some defaults
  _.defaults(options, {
    ENV: "dev",
    ROOT: __dirname,
    TEST: false,
  });

  const config: Config = require(`./config/config.${options.ENV}`)(options);

  // call `toConfig` to convert to webpack object, and return it
  return config.toConfig();
}

module.exports = webpackConfig;
