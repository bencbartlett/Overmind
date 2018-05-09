// Command line

import {Colony} from '../Colony';
import {toColumns} from '../utilities/utils';
import {asciiLogo} from '../visuals/logos';

export class Console {

	static init() {
		global.help = this.help();
		global.openRoomPlanner = this.openRoomPlanner;
		global.closeRoomPlanner = this.closeRoomPlanner;
		global.cancelRoomPlanner = this.cancelRoomPlanner;
		global.listActiveRoomPlanners = this.listActiveRoomPlanners;
		global.destroyAllHostileStructures = this.destroyAllHostlileStructures;
		global.destroyAllBarriers = this.destroyAllBarriers;
	}

	static help() {
		let msg = '\n';
		for (let line of asciiLogo) {
			msg += line + '\n';
		}
		msg += '\nOvermind repository: github.com/bencbartlett/Overmind\n\n';

		let descr: { [functionName: string]: string } = {};
		descr['help'] = 'show this message';
		descr['log.level = [int]'] = 'set the logging level from 0 - 4';
		descr['openRoomPlanner(roomName)'] = 'open the room planner for a room';
		descr['closeRoomPalnner(roomName)'] = 'close the room planner and save changes';
		descr['cancelRoomPlanner(roomName)'] = 'close the room planner and discard changes';
		descr['listActiveRoomPlanners()'] = 'display a list of colonies with open room planners';
		descr['destroyAllHostileStructures()'] = 'destroys all hostile structures in an owned room';
		descr['destroyAllBarriers()'] = 'destroys all ramparts and barriers in a room';
		// Console list
		let descrMsg = toColumns(descr, {justify: true, padChar: '.'});
		let maxLineLength = _.max(_.map(descrMsg, line => line.length));
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