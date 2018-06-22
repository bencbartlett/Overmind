import {log} from '../console/log';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Overlord} from '../overlords/Overlord';
import {Pathing} from '../movement/Pathing';

interface DirectiveCreateOptions {
	memory?: FlagMemory;
	name?: string;
	quiet?: boolean;
}

@profile
export abstract class Directive {

	static directiveName: string;				// Name of the type of directive, e.g. "incubate"
	static color: ColorConstant; 				// Flag color
	static secondaryColor: ColorConstant;		// Flag secondaryColor

	flag: Flag;									// The flag instantiating this directive
	name: string;								// The name of the flag
	ref: string;								// Also the name of the flag; used for task targeting
	requiredRCL: number; 						// Required RCL for a colony to handle this directive
	colony: Colony; 							// The colony of the directive (directive is removed if undefined)
	pos: RoomPosition; 							// Flag position
	room: Room | undefined;						// Flag room
	memory: FlagMemory;							// Flag memory
	overlords: { [name: string]: Overlord };	// Overlords

	constructor(flag: Flag, requiredRCL = 1) {
		this.flag = flag;
		this.name = flag.name;
		this.ref = flag.ref;
		this.requiredRCL = requiredRCL;
		this.colony = Directive.getFlagColony(flag, requiredRCL);
		this.pos = flag.pos;
		this.room = flag.room;
		this.memory = flag.memory;
		if (!this.memory.created) this.memory.created = Game.time;
		this.overlords = {};
		// Register to colony overseer or delete the directive if the colony is dead
		if (!this.colony) {
			this.remove();
		} else {
			this.colony.overseer.directives.push(this);
		}
	}

	static getFlagColony(flag: Flag, requiredRCL = 1): Colony {
		// If something is written to flag.colony, use that as the colony
		if (flag.memory.colony) {
			return Overmind.colonies[flag.memory.colony];
		} else {
			// If flag contains a colony name as a substring, assign to that colony, regardless of RCL
			let colonyNames = _.keys(Overmind.colonies);
			for (let name of colonyNames) {
				if (flag.name.includes(name)) {
					if (flag.name.split(name)[1] != '') continue; // in case of other substring, e.g. E11S12 and E11S1
					flag.memory.colony = name;
					return Overmind.colonies[name];
				}
			}
			// If flag is in a room belonging to a colony and the colony has sufficient RCL, assign to there
			let colony = Overmind.colonies[Overmind.colonyMap[flag.pos.roomName]];
			if (colony && colony.level >= requiredRCL) {
				return colony;
			} else {
				// Otherwise assign to closest colony
				this.recalculateColony(flag, requiredRCL);
				return Overmind.colonies[flag.memory.colony!];
			}
		}
	}

	static recalculateColony(flag: Flag, requiredRCL = 1, restrictDistance = 10, verbose = false) {
		if (verbose) log.info(`Recalculating colony association for ${flag.name} in ${flag.pos.roomName}`);
		let nearestColonyName = '';
		let minDistance = Infinity;
		let colonyRooms = _.filter(Game.rooms, room => room.my);
		for (let room of colonyRooms) {
			if (room.controller!.level >= requiredRCL) {
				let ret = Pathing.findShortestPath(flag.pos, room.controller!.pos,
												   {restrictDistance: restrictDistance});
				if (!ret.incomplete) {
					if (ret.path.length < minDistance) {
						nearestColonyName = room.name;
						minDistance = ret.path.length;
					}
					if (verbose) log.info(`Path length to ${room.name}: ${ret.path.length}`);
				} else {
					if (verbose) log.info(`Incomplete path found to ${room.name}`);
				}
			} else {
				if (verbose) {
					log.info(`RCL for ${room.name} insufficient: ` +
							 `needs ${requiredRCL}, is ${room.controller!.level}`);
				}
			}

		}
		if (nearestColonyName != '') {
			log.info(`Colony ${nearestColonyName!} assigned to ${flag.name}.`);
			flag.memory.colony = nearestColonyName;
		} else {
			log.warning(`Could not find colony match for ${flag.name} in ${flag.pos.roomName}!`);
		}
	}

	// Wrapped flag methods ============================================================================================
	remove(): number | undefined {
		if (!this.memory.persistent) {
			delete this.memory;
			return this.flag.remove();
		}
	}

	setColor(color: ColorConstant, secondaryColor?: ColorConstant): number {
		if (secondaryColor) {
			return this.flag.setColor(color, secondaryColor);
		} else {
			return this.flag.setColor(color);
		}
	}

	setPosition(pos: RoomPosition): number {
		// Ignore the (x,y) setPosition option since I never use it
		return this.flag.setPosition(pos);
	}

	// Custom directive methods ========================================================================================

	/* Create an appropriate flag to instantiate this directive in the next tick */
	static create(pos: RoomPosition, opts: DirectiveCreateOptions = {}): number | string {
		let name = opts.name;
		if (!name) {
			name = this.directiveName + ':' + pos.roomName;
			if (Game.flags[name]) {
				let i = 0;
				while (Game.flags[name + i]) {
					i += 1;
				}
				name = name + i;
			}
		}
		if (!opts.quiet) {
			log.alert(`Creating ${this.directiveName} directive at ${pos.print}!`);
		}
		let result = pos.createFlag(name, this.color, this.secondaryColor) as string | number;
		if (result == name && opts.memory) {
			Memory.flags[name] = opts.memory;
		}
		return result;
	}

	/* Create a directive if one of the same type is not already present (in room | at position) */
	static createIfNotPresent(pos: RoomPosition, scope: 'room' | 'pos',
							  opts: DirectiveCreateOptions = {}): number | string | void {
		let room = Game.rooms[pos.roomName];
		if (!room) {
			log.error(`No vision at ${pos.print}; can't create directive!`);
		}
		let flagsOfThisType: Flag[];
		switch (scope) {
			case 'room':
				// TODO: room can be undefined
				flagsOfThisType = _.filter(room.flags, flag => this.filter(flag));
				if (flagsOfThisType.length == 0) {
					return this.create(pos, opts);
				}
				break;
			case 'pos':
				flagsOfThisType = _.filter(pos.lookFor(LOOK_FLAGS), flag => this.filter(flag));
				if (flagsOfThisType.length == 0) {
					return this.create(pos, opts);
				}
				break;
			default:
				log.error(`Directive.createIfNotPresent: scope must be "room" or "pos"!`);
				break;
		}
	}

	/* Filter for _.filter() that checks if a flag is of the matching type */
	static filter(flag: Flag): boolean {
		return flag.color == this.color && flag.secondaryColor == this.secondaryColor;
	}

	/* Map a list of flags to directives, accepting a filter */
	static find(flags: Flag[]): Directive[] {
		flags = _.filter(flags, flag => this.filter(flag));
		return _.compact(_.map(flags, flag => Game.directives[flag.name]));
	}

	/* Initialization logic goes here, called in overseer.init() */
	abstract init(): void

	/* Runtime logic goes here, called in overseer.run() */
	abstract run(): void

	// Overwrite this in child classes to display relevant information
	visuals(): void {

	}
}