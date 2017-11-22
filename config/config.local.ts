import * as Config from 'webpack-chain';

import * as CommonConfig from './config.common';
import {EnvOptions} from './types';

function webpackConfig(options: EnvOptions = {}): Config {
	// get the common configuration to start with
	const config = CommonConfig.init(options);

	// TIP: if you symlink the below path into your project as `local`,
	// it makes for much easier debugging:
	// (make sure you symlink the dir, not the files)
	// `# ln -s /path/to/local/deploy/dir ./dist/local`
	const localPath = '/home/USER_NAME/.config/Screeps/scripts/127_0_0_1___21025/default/';
	config.output.path(localPath);

	// modify the args of "define" plugin
	config.plugin('define').tap((args: any[]) => {
		args[0].PRODUCTION = JSON.stringify(false);
		return args;
	});

	// HACK to add .js extension for local server
	config.output.sourceMapFilename('[file].map.js');

	return config;
}

module.exports = webpackConfig;
