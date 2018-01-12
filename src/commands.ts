// Command line

import {asciiLogo} from './visuals/Visualizer';

export class Commands {
	static init() {
		global.help = this.help();
	}

	static help() {
		let msg = '\n';
		for (let line of asciiLogo) {
			msg += line + '\n';
		}
		msg += '\nOvermind repository: github.com/bencbartlett/Overmind\n';
		// Commands list
		msg += 'Commands ================================== \n' +
			   'help					show this message \n' +
			   'log.level = (0-1)		set the loging level';

		msg += '\nRefer to the repository for more information\n';

		return msg;
	}
}