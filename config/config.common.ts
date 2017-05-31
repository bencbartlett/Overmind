import * as path from "path";
import * as webpack from "webpack";
import * as Config from "webpack-chain";
import { ScreepsSourceMapToJson } from "../libs/screeps-webpack-sources";

// Plugins:
// disable tslint rule, because we don't have types for these files
/* tslint:disable:no-var-requires */
const { CheckerPlugin, TsConfigPathsPlugin } = require("awesome-typescript-loader");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const git = require("git-rev-sync");

import { EnvOptions } from "./types";

// WARNING: don't use `__dirname` in these files unless you are sure of
// what you want, since it will resolve to the `config/` dir, instead of
// the project root

// see https://github.com/mozilla-neutrino/webpack-chain
// for documentation on how to work with the config object
export function init(options: EnvOptions): Config {
  const ENV = options.ENV || "dev";
  const ROOT = options.ROOT || __dirname;
  // const TEST = options.TEST || false;

  const config = new Config();

  // set all common configurations here
  config
    .entry("main")
      .add("./src/main.ts");

  config
    .output
      .path(path.join(ROOT, "dist", ENV))
      .filename("main.js")
      .pathinfo(false)
      .libraryTarget("commonjs2")
      .sourceMapFilename("[file].map")
      .devtoolModuleFilenameTemplate("[resource-path]");

  config.devtool("source-map");

  config.target("node");

  config.node.merge({
    Buffer: false,
    __dirname: false,
    __filename: false,
    console: true,
    global: true,
    process: false,
  });

  config.watchOptions({ ignored: /node_modules/ });

  config.resolve
    .extensions
      .merge([".webpack.js", ".web.js", ".ts", ".tsx", ".js"]);

  // see for more info about TsConfigPathsPlugin
  // https://github.com/s-panferov/awesome-typescript-loader/issues/402
  config.resolve.plugin("tsConfigPaths") // name here is just an identifier
    .use(TsConfigPathsPlugin);

  config.externals({
    // webpack will not try to rewrite require("main.js.map")
    "main.js.map": "main.js.map",
  });

  /////////
  /// Plugins

  //   NOTE: do not use 'new' on these, it will be called automatically
  // this plugin is for typescript's typeschecker to run in async mode
  config.plugin("tsChecker")
    .use(CheckerPlugin);

  // this plugin wipes the `dist` directory clean before each new deploy
  config.plugin("clean")
    .use(CleanWebpackPlugin, [    // arguments passed to CleanWebpackPlugin ctor
      [ `dist/${options.ENV}/*` ],
      { root: options.ROOT },
    ]);

  // you can use this to define build toggles; keys defined here
  // will be replaced in the output code with their values;
  // Note that because the plugin does a direct text replacement,
  //   the value given to it must include actual quotes inside of the
  //   string itself. Typically, this is done either with either
  //   alternate quotes, such as '"production"', or by using
  //   JSON.stringify('production').
  // Make sure to let typescript know about these via `define` !
  // See https://github.com/kurttheviking/git-rev-sync-js for more git options
  config.plugin("define")
    .use(webpack.DefinePlugin, [{
      PRODUCTION: JSON.stringify(true),
      __BUILD_TIME__: JSON.stringify(Date.now()),  // example defination
      __REVISION__: JSON.stringify(git.short()),
    }]);

  config.plugin("screeps-source-map")
    .use(ScreepsSourceMapToJson);

  /////////
  /// Modules

  config.module.rule("js-source-maps")
    .test(/\.js$/)
    .enforce("pre")
    .use("source-map")
      .loader("source-map-loader");

  config.module.rule("tsx-source-maps")
    .test(/\.tsx?$/)
    .enforce("pre")
    .use("source-map")
      .loader("source-map-loader");

  config.module.rule("compile")
    .test(/\.tsx?$/)
    .exclude
      .add(path.join(ROOT, "src/snippets"))
      .end()
    .use("typescript")
      .loader("awesome-typescript-loader")
      .options({ configFileName: "tsconfig.json" });

  config.module.rule("lint")
    .test(/\.tsx?$/)
    .exclude
      .add(path.join(ROOT, "src/snippets"))
      .add(path.join(ROOT, "src/lib"))
      .end()
    .use("tslint")
      .loader("tslint-loader")
      .options({
        configFile: path.join(ROOT, "tslint.json"),
        // automaticall fix linting errors
        fix: false,
        // you can search NPM and install custom formatters
        formatter: "stylish",
        // enables type checked rules like 'for-in-array'
        // uses tsconfig.json from current working directory
        typeCheck: false,
      });

  // return the config object
  return config;
}
