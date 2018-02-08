// Command line

import {asciiLogo} from './visuals/Visualizer';

export class Commands {
	static init() {
		global.help = this.help();
		global.openRoomPlanner = this.openRoomPlanner;
		global.closeRoomPlanner = this.closeRoomPlanner;
		global.cancelRoomPlanner = this.cancelRoomPlanner;
	}

	static help() {
		let msg = '\n';
		for (let line of asciiLogo) {
			msg += line + '\n';
		}
		msg += '\nOvermind repository: github.com/bencbartlett/Overmind\n';
		// Commands list
		msg += 'Commands ======================================= \n' +
			   'help				     	show this message \n' +
			   'log.level = (0-1)			set the loging level \n' +
			   'openRoomPlanner(roomName)	open the room planner\n' +
			   'closeRoomPlanner(roomName) 	close the room planner and save changes\n' +
			   'cancelRoomPlanner(roomName) close the room planner and discard changes\n';

		msg += '\nRefer to the repository for more information\n';

		return msg;
	}

	static openRoomPlanner(roomName: string): string | void {
		if (Overmind.Colonies[roomName]) {
			if (Overmind.Colonies[roomName].roomPlanner.active != true) {
				Overmind.Colonies[roomName].roomPlanner.active = true;
			} else {
				return `RoomPlanner for ${roomName} is already active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static closeRoomPlanner(roomName: string): string | void {
		if (Overmind.Colonies[roomName]) {
			if (Overmind.Colonies[roomName].roomPlanner.active == true) {
				Overmind.Colonies[roomName].roomPlanner.finalize();
			} else {
				return `RoomPlanner for ${roomName} is not active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static cancelRoomPlanner(roomName: string): string | void {
		if (Overmind.Colonies[roomName]) {
			if (Overmind.Colonies[roomName].roomPlanner.active == true) {
				Overmind.Colonies[roomName].roomPlanner.active = false;
				return `RoomPlanner for ${roomName} has been deactivated without saving changes`;
			} else {
				return `RoomPlanner for ${roomName} is not active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}
}