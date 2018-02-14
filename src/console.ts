// Command line

import {asciiLogo} from './visuals/Visualizer';

export class Console {
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
		// Console list
		msg += 'Console ======================================= \n' +
			   'help				     	show this message \n' +
			   'log.level = (0-1)			set the loging level \n' +
			   'openRoomPlanner(roomName)	open the room planner\n' +
			   'closeRoomPlanner(roomName) 	close the room planner and save changes\n' +
			   'cancelRoomPlanner(roomName) close the room planner and discard changes\n';

		msg += '\nRefer to the repository for more information\n';

		// let output = '';
		//
		// // get function name max length
		// const longestName = (_.max(data, (d) => d.name.length)).name.length + 2;
		//
		// //// Header line
		// output += _.padRight('Function', longestName);
		// output += _.padLeft('Tot Calls', 12);
		// output += _.padLeft('CPU/Call', 12);
		// output += _.padLeft('Calls/Tick', 12);
		// output += _.padLeft('CPU/Tick', 12);
		// output += _.padLeft('% of Tot\n', 12);
		//
		// ////  Data lines
		// data.forEach((d) => {
		// 	output += _.padRight(`${d.name}`, longestName);
		// 	output += _.padLeft(`${d.calls}`, 12);
		// 	output += _.padLeft(`${d.cpuPerCall.toFixed(2)}ms`, 12);
		// 	output += _.padLeft(`${d.callsPerTick.toFixed(2)}`, 12);
		// 	output += _.padLeft(`${d.cpuPerTick.toFixed(2)}ms`, 12);
		// 	output += _.padLeft(`${(d.cpuPerTick / totalCpu * 100).toFixed(0)} %\n`, 12);
		// });
		//
		// //// Footer line
		// output += `${totalTicks} total ticks measured`;
		// output += `\t\t\t${totalCpu.toFixed(2)} average CPU profiled per tick`;
		// console.log(output);

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