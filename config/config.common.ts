import * as fs from 'fs';
import * as path from 'path';
import * as webpack from 'webpack';
import * as Config from 'webpack-chain';
import {ScreepsSourceMapToJson} from '../libs/screeps-webpack-sources';

// Webpack + plugins:
// disable tslint rule, because we don't have types for these files
/* tslint:disable:no-var-requires no-require-imports */
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const git = require('git-rev-sync');

import {EnvOptions} from './types';

// WARNING: don't use `__dirname` in these files unless you are sure of
// what you want, since it will resolve to the `config/` dir, instead of
// the project root

// see https://github.com/mozilla-neutrino/webpack-chain
// for documentation on how to work with the config object
export function init(options: EnvOptions): Config {
	const ENV = options.ENV || 'dev';
	const ROOT = options.ROOT || __dirname;
	// const TEST = options.TEST || false;

	const config = new Config();
	// Check if git repo exists
	const gitRepoExists = fs.existsSync('../.git');

	// set all common configurations here
	config
		.entry('main')
		.add('./src/main.ts');

	config
		.output
		.path(path.join(ROOT, 'dist', ENV))
		.filename('main.js')
		.pathinfo(false)
		.libraryTarget('commonjs2')
		.sourceMapFilename('[file].map')
		.devtoolModuleFilenameTemplate('[resource-path]');

	config.devtool('source-map');

	config.target('node');

	config.node.merge({
						  Buffer    : false,
						  __dirname : false,
						  __filename: false,
						  console   : true,
						  global    : true,
						  process   : false,
					  });

	config.watchOptions({ignored: /node_modules/});

	config.resolve
		  .extensions
		  .merge(['.webpack.js', '.web.js', '.ts', '.tsx', '.js']);

	config.externals({
						 // webpack will not try to rewrite require("main.js.map")
						 'main.js.map': 'main.js.map',
					 });

	/////////
	/// Plugins
	///
	/// NOTE: do not use 'new' on these, it will be called automatically

	// use ForkTsCheckerWebpackPlugin for faster typechecking
	config.plugin('tsChecker')
		  .use(ForkTsCheckerWebpackPlugin);

	// this plugin wipes the `dist` directory clean before each new deploy
	config.plugin('clean')
		  .use(CleanWebpackPlugin, [
			  // arguments passed to CleanWebpackPlugin ctor
			  [`dist/${options.ENV}/*`],
			  {root: options.ROOT},
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
	config.plugin('define')
		  .use((webpack.DefinePlugin as Config.PluginClass), [{
			  PRODUCTION    : JSON.stringify(true),
			  __BUILD_TIME__: JSON.stringify(Date.now()),  // example defination
			  __REVISION__  : gitRepoExists ? JSON.stringify(git.short()) : JSON.stringify(''),
		  }]);

	config.plugin('screeps-source-map')
		  .use((ScreepsSourceMapToJson as Config.PluginClass));

	config.plugin('no-emit-on-errors')
		  .use((webpack.NoEmitOnErrorsPlugin as Config.PluginClass));

	/////////
	/// Modules

	config.module.rule('js-source-maps')
		  .test(/\.js$/)
		  .enforce('pre')
		  .use('source-map')
		  .loader('source-map-loader');

	config.module.rule('tsx-source-maps')
		  .test(/\.tsx?$/)
		  .enforce('pre')
		  .use('source-map')
		  .loader('source-map-loader');

	config.module.rule('compile')
		  .test(/\.tsx?$/)
		  .exclude
		  .add(path.join(ROOT, 'src/snippets'))
		  .end()
		  .use('typescript')
		  .loader('ts-loader')
		  .options({
					   // disable type checker - we will use it in fork plugin
					   transpileOnly: true
				   });

	// return the config object
	return config;
}
