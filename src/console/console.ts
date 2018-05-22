// Command line

import {Colony} from '../Colony';
import {toColumns} from '../utilities/utils';
import {asciiLogoSmall} from '../visuals/logos';

export class Console {

	static init() {
		global.help = this.help();
		global.openRoomPlanner = this.openRoomPlanner;
		global.closeRoomPlanner = this.closeRoomPlanner;
		global.cancelRoomPlanner = this.cancelRoomPlanner;
		global.listActiveRoomPlanners = this.listActiveRoomPlanners;
		global.destroyAllHostileStructures = this.destroyAllHostlileStructures;
		global.destroyAllBarriers = this.destroyAllBarriers;
		global.listAllDirectives = this.listAllDirectives;
		global.listPersistentDirectives = this.listPersistentDirectives;
		global.removeAllLogisticsDirectives = this.removeAllLogisticsDirectives;
	}

	static help() {
		let msg = '\n<font color="#ff00ff">';
		for (let line of asciiLogoSmall) {
			msg += line + '\n';
		}
		msg += '</font>';

		let descr: { [functionName: string]: string } = {};
		descr['help'] = 'show this message';
		descr['log.level = [int]'] = 'set the logging level from 0 - 4';
		descr['openRoomPlanner(roomName)'] = 'open the room planner for a room';
		descr['closeRoomPlanner(roomName)'] = 'close the room planner and save changes';
		descr['cancelRoomPlanner(roomName)'] = 'close the room planner and discard changes';
		descr['listActiveRoomPlanners()'] = 'display a list of colonies with open room planners';
		descr['destroyAllHostileStructures(roomName)'] = 'destroys all hostile structures in an owned room';
		descr['destroyAllBarriers(roomName)'] = 'destroys all ramparts and barriers in a room';
		descr['listAllDirectives()'] = 'print type, name, pos of every directive';
		descr['listPersistentDirectives()'] = 'print type, name, pos of every persistent directive';
		// Console list
		let descrMsg = toColumns(descr, {justify: true, padChar: '.'});
		let maxLineLength = _.max(_.map(descrMsg, line => line.length)) + 2;
		msg += 'Console Commands: '.padRight(maxLineLength, '=') + '\n' + descrMsg.join('\n');

		msg += '\n\nRefer to the repository for more information\n';

		return msg;
	}

	static openRoomPlanner(roomName: string): string {
		if (Overmind.Colonies[roomName]) {
			if (Overmind.Colonies[roomName].roomPlanner.active != true) {
				Overmind.Colonies[roomName].roomPlanner.active = true;
				return '';
			} else {
				return `RoomPlanner for ${roomName} is already active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static closeRoomPlanner(roomName: string): string {
		if (Overmind.Colonies[roomName]) {
			if (Overmind.Colonies[roomName].roomPlanner.active == true) {
				Overmind.Colonies[roomName].roomPlanner.finalize();
				return '';
			} else {
				return `RoomPlanner for ${roomName} is not active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static cancelRoomPlanner(roomName: string): string {
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

	static listActiveRoomPlanners(): string {
		let coloniesWithActiveRoomPlanners: Colony[] = _.filter(
			_.map(_.keys(Overmind.Colonies), colonyName => Overmind.Colonies[colonyName]),
			(colony: Colony) => colony.roomPlanner.active);
		let names: string[] = _.map(coloniesWithActiveRoomPlanners, colony => colony.room.print);
		if (names.length > 0) {
			console.log('Colonies with active room planners: ' + names);
			return '';
		} else {
			return `No colonies with active room planners`;
		}
	}

	static listAllDirectives(): string {
		let msg = '';
		for (let i in Game.directives) {
			let dir = Game.directives[i];
			msg += `Type: ${dir.directiveName}`.padRight(20) +
				   `Name: ${dir.name}`.padRight(15) +
				   `Pos: ${dir.pos.print}\n`;
		}
		return msg;
	}

	static removeAllLogisticsDirectives(): string {
		let logisticsFlags = _.filter(Game.flags, flag => flag.color == COLOR_YELLOW &&
														  flag.secondaryColor == COLOR_YELLOW);
		for (let dir of logisticsFlags) {
			dir.remove();
		}
		return `Removed ${logisticsFlags.length} logistics directives.`;
	}

	static listPersistentDirectives(): string {
		let msg = '';
		for (let i in Game.directives) {
			let dir = Game.directives[i];
			if (dir.memory.persistent) {
				msg += `Type: ${dir.directiveName}`.padRight(20) +
					   `Name: ${dir.name}`.padRight(15) +
					   `Pos: ${dir.pos.print}\n`;
			}
		}
		return msg;
	}

	static destroyAllHostlileStructures(roomName: string): string {
		let room = Game.rooms[roomName];
		if (!room) return `${roomName} is undefined! (No vision?)`;
		if (!room.my) return `${roomName} is not owned by you!`;
		let hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
		for (let structure of hostileStructures) {
			structure.destroy();
		}
		return `Destroyed ${hostileStructures.length} hostile structures.`;
	}

	static destroyAllBarriers(roomName: string): string {
		let room = Game.rooms[roomName];
		if (!room) return `${roomName} is undefined! (No vision?)`;
		if (!room.my) return `${roomName} is not owned by you!`;
		for (let barrier of room.barriers) {
			barrier.destroy();
		}
		return `Destroyed ${room.barriers.length} barriers.`;
	}
}