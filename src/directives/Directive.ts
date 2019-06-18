import {Colony, getAllColonies} from '../Colony';
import {log} from '../console/log';
import {Pathing} from '../movement/Pathing';
import {Overlord} from '../overlords/Overlord';
import {profile} from '../profiler/decorator';
import {equalXYR, getPosFromString, randomHex} from '../utilities/utils';
import {NotifierPriority} from './Notifier';

interface DirectiveCreationOptions {
	memory?: FlagMemory;
	name?: string;
	quiet?: boolean;
}

const DEFAULT_MAX_PATH_LENGTH = 600;
const DEFAULT_MAX_LINEAR_RANGE = 10;

/**
 * Directives are contextual wrappers for flags and serve as attachment points for Overlords, acting as a sort of
 * "process table" for the bot, with individual processes (Overlords) run by the scheulder (Overseer)
 */
@profile
export abstract class Directive {

	static directiveName: string;				// Name of the type of directive, e.g. "incubate"
	static color: ColorConstant; 				// Flag color
	static secondaryColor: ColorConstant;		// Flag secondaryColor

	name: string;								// The name of the flag
	ref: string;								// Also the name of the flag; used for task targeting
	colony: Colony; 							// The colony of the directive (directive is removed if undefined)
	colonyFilter?: (colony: Colony) => boolean; // Requirements to assign to a colony
	pos: RoomPosition; 							// Flag position
	room: Room | undefined;						// Flag room
	memory: FlagMemory;							// Flag memory
	overlords: { [name: string]: Overlord };	// Overlords
	waypoints?: RoomPosition[];					// List of portals to travel through to reach destination

	constructor(flag: Flag, colonyFilter?: (colony: Colony) => boolean) {
		this.memory = flag.memory;
		if (this.memory.suspendUntil) {
			if (Game.time < this.memory.suspendUntil) {
				return;
			} else {
				delete this.memory.suspendUntil;
			}
		}
		this.name = flag.name;
		this.ref = flag.ref;
		if (!this.memory[_MEM.TICK]) {
			this.memory[_MEM.TICK] = Game.time;
		}
		if (this.memory.waypoints) {
			this.waypoints = _.map(this.memory.waypoints, posName => getPosFromString(posName)!);
		}
		// Relocate flag if needed; this must be called before the colony calculations
		const needsRelocating = this.handleRelocation();
		if (!needsRelocating) {
			this.pos = flag.pos;
			this.room = flag.room;
		}
		const colony = this.getColony(colonyFilter);
		// Delete the directive if the colony is dead
		if (!colony) {
			if (Overmind.exceptions.length == 0) {
				log.alert(`Could not get colony for directive ${this.print}; removing flag!`);
				flag.remove();
			} else {
				log.alert(`Could not get colony for directive ${this.print}; ` +
						  `exceptions present this tick, so won't remove`);
			}
			return;
		}
		// Delete the directive if expired
		if (this.memory[_MEM.EXPIRATION] && Game.time > this.memory[_MEM.EXPIRATION]!) {
			log.alert(`Removing expired directive ${this.print}!`);
			flag.remove();
			return;
		}
		// Register colony and add flags to colony.flags
		this.colony = colony;
		this.colony.flags.push(flag);
		this.overlords = {};
		// Register directive on Overmind
		global[this.name] = this;
		Overmind.overseer.registerDirective(this);
		Overmind.directives[this.name] = this;
	}

	/**
	 * Gets an effective room position for a directive; allows you to reference this.pos in constructor super() without
	 * throwing an error
	 */
	static getPos(flag: Flag): RoomPosition {
		if (flag.memory && flag.memory.setPosition) {
			const pos = derefRoomPosition(flag.memory.setPosition);
			return pos;
		}
		return flag.pos;
	}

	// Flag must be a getter to avoid caching issues
	get flag(): Flag {
		return Game.flags[this.name];
	}

	// get isSuspended(): boolean {
	// 	return !!this.memory.suspendUntil && Game.time < this.memory.suspendUntil;
	// }
	//
	// suspend(ticks: number) {
	// 	this.memory.suspendUntil = Game.time + ticks;
	// }
	//
	// suspendUntil(tick: number) {
	// 	this.memory.suspendUntil = tick;
	// }

	refresh(): void {
		const flag = this.flag;
		if (!flag) {
			log.warning(`Missing flag for directive ${this.print}! Removing directive.`);
			this.remove();
			return;
		}
		this.memory = flag.memory;
		this.pos = flag.pos;
		this.room = flag.room;
	}

	alert(message: string, priority = NotifierPriority.Normal): void {
		Overmind.overseer.notifier.alert(message, this.pos.roomName, priority);
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.name + ']</a>';
	}

	private handleRelocation(): boolean {
		if (this.memory.setPosition) {
			const pos = derefRoomPosition(this.memory.setPosition);
			if (!this.flag.pos.isEqualTo(pos)) {
				const result = this.flag.setPosition(pos);
				if (result == OK) {
					log.debug(`Moving ${this.name} from ${this.flag.pos.print} to ${pos.print}.`);
				} else {
					log.warning(`Could not set room position to ${JSON.stringify(this.memory.setPosition)}!`);
				}
			} else {
				delete this.memory.setPosition;
			}
			this.pos = pos;
			this.room = Game.rooms[pos.roomName];
			return true;
		}
		return false;
	}

	private getColony(colonyFilter?: (colony: Colony) => boolean, verbose = false): Colony | undefined {
		// If something is written to flag.colony, use that as the colony
		if (this.memory[_MEM.COLONY]) {
			return Overmind.colonies[this.memory[_MEM.COLONY]!];
		} else {
			// If flag contains a colony name as a substring, assign to that colony, regardless of RCL
			const colonyNames = _.keys(Overmind.colonies);
			for (const name of colonyNames) {
				if (this.name.includes(name)) {
					if (this.name.split(name)[1] != '') continue; // in case of other substring, e.g. E11S12 and E11S1
					this.memory[_MEM.COLONY] = name;
					return Overmind.colonies[name];
				}
			}
			// If flag is in a room belonging to a colony and the colony has sufficient RCL, assign to there
			const colony = Overmind.colonies[Overmind.colonyMap[this.pos.roomName]] as Colony | undefined;
			if (colony) {
				if (!colonyFilter || colonyFilter(colony)) {
					this.memory[_MEM.COLONY] = colony.name;
					return colony;
				}
			}
			// Otherwise assign to closest colony
			const nearestColony = this.findNearestColony(colonyFilter, verbose);
			if (nearestColony) {
				log.info(`Colony ${nearestColony.room.print} assigned to ${this.name}.`);
				this.memory[_MEM.COLONY] = nearestColony.room.name;
				return nearestColony;
			} else {
				log.error(`Could not find colony match for ${this.name} in ${this.pos.roomName}! ` +
						  `Try setting memory.maxPathLength and memory.maxLinearRange.`);
			}
		}
	}

	private findNearestColony(colonyFilter?: (colony: Colony) => boolean, verbose = false): Colony | undefined {
		const maxPathLength = this.memory.maxPathLength || DEFAULT_MAX_PATH_LENGTH;
		const maxLinearRange = this.memory.maxLinearRange || DEFAULT_MAX_LINEAR_RANGE;
		if (verbose) log.info(`Recalculating colony association for ${this.name} in ${this.pos.roomName}`);
		let nearestColony: Colony | undefined;
		let minDistance = Infinity;
		const colonyRooms = _.filter(Game.rooms, room => room.my);
		for (const colony of getAllColonies()) {
			if (Game.map.getRoomLinearDistance(this.pos.roomName, colony.name) > maxLinearRange) {
				continue;
			}
			if (!colonyFilter || colonyFilter(colony)) {
				const ret = Pathing.findPath((colony.hatchery || colony).pos, this.pos);
				if (!ret.incomplete) {
					if (ret.path.length < maxPathLength && ret.path.length < minDistance) {
						nearestColony = colony;
						minDistance = ret.path.length;
					}
					if (verbose) log.info(`Path length to ${colony.room.print}: ${ret.path.length}`);
				} else {
					if (verbose) log.info(`Incomplete path from ${colony.room.print}`);
				}
			}
		}
		if (nearestColony) {
			return nearestColony;
		}
	}

	// Wrapped flag methods ============================================================================================
	remove(force = false): number | undefined {
		if (!this.memory.persistent || force) {
			delete Overmind.directives[this.name];
			delete global[this];
			Overmind.overseer.removeDirective(this);
			if (this.colony) {
				_.remove(this.colony.flags, flag => flag.name == this.name);
			}
			if (this.flag) { // check in case flag was removed manually in last build cycle
				return this.flag.remove();
			}
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
	static create(pos: RoomPosition, opts: DirectiveCreationOptions = {}): number | string {
		let flagName = opts.name || undefined;
		if (!flagName) {
			flagName = this.directiveName + ':' + randomHex(6);
			if (Game.flags[flagName]) {
				return ERR_NAME_EXISTS;
			}
		}
		if (!opts.quiet) {
			log.alert(`Creating ${this.directiveName} directive at ${pos.print}!`);
		}
		const result = pos.createFlag(flagName, this.color, this.secondaryColor) as string | number;
		if (result == flagName && opts.memory) {
			Memory.flags[flagName] = opts.memory;
		}
		log.debug(`Result: ${result}, memory: ${JSON.stringify(Memory.flags[result])}`);
		return result;
	}


	/* Whether a directive of the same type is already present (in room | at position) */
	static isPresent(pos: RoomPosition, scope: 'room' | 'pos'): boolean {
		const room = Game.rooms[pos.roomName] as Room | undefined;
		switch (scope) {
			case 'room':
				if (room) {
					return _.filter(room.flags,
									flag => this.filter(flag) &&
											!(flag.memory.setPosition
											&& flag.memory.setPosition.roomName != pos.roomName)).length > 0;
				} else {
					const flagsInRoom = _.filter(Game.flags, function(flag) {
						if (flag.memory.setPosition) { // does it need to be relocated?
							return flag.memory.setPosition.roomName == pos.roomName;
						} else { // properly located
							return flag.pos.roomName == pos.roomName;
						}
					});
					return _.filter(flagsInRoom, flag => this.filter(flag)).length > 0;
				}
			case 'pos':
				if (room) {
					return _.filter(pos.lookFor(LOOK_FLAGS),
									flag => this.filter(flag) &&
											!(flag.memory.setPosition
											&& !equalXYR(pos, flag.memory.setPosition))).length > 0;
				} else {
					const flagsAtPos = _.filter(Game.flags, function(flag) {
						if (flag.memory.setPosition) { // does it need to be relocated?
							return equalXYR(flag.memory.setPosition, pos);
						} else { // properly located
							return equalXYR(flag.pos, pos);
						}
					});
					return _.filter(flagsAtPos, flag => this.filter(flag)).length > 0;
				}
		}
	}

	/* Create a directive if one of the same type is not already present (in room | at position).
	 * Calling this method on positions in invisible rooms can be expensive and should be used sparingly. */
	static createIfNotPresent(pos: RoomPosition, scope: 'room' | 'pos',
							  opts: DirectiveCreationOptions = {}): number | string | undefined {
		if (this.isPresent(pos, scope)) {
			return; // do nothing if flag is already here
		}
		const room = Game.rooms[pos.roomName] as Room | undefined;
		if (!room) {
			if (!opts.memory) {
				opts.memory = {};
			}
			opts.memory.setPosition = pos;
		}
		switch (scope) {
			case 'room':
				if (room) {
					return this.create(pos, opts);
				} else {
					log.info(`Creating directive at ${pos.print}... ` +
							 `No visibility in room; directive will be relocated on next tick.`);
					let createAtPos: RoomPosition;
					if (opts.memory && opts.memory[_MEM.COLONY]) {
						createAtPos = Pathing.findPathablePosition(opts.memory[_MEM.COLONY]!);
					} else {
						createAtPos = Pathing.findPathablePosition(_.first(getAllColonies()).room.name);
					}
					return this.create(createAtPos, opts);
				}
			case 'pos':
				if (room) {
					return this.create(pos, opts);
				} else {
					log.info(`Creating directive at ${pos.print}... ` +
							 `No visibility in room; directive will be relocated on next tick.`);
					let createAtPos: RoomPosition;
					if (opts.memory && opts.memory[_MEM.COLONY]) {
						createAtPos = Pathing.findPathablePosition(opts.memory[_MEM.COLONY]!);
					} else {
						createAtPos = Pathing.findPathablePosition(_.first(getAllColonies()).room.name);
					}
					return this.create(createAtPos, opts);
				}
		}
	}

	/* Filter for _.filter() that checks if a flag is of the matching type */
	static filter(flag: Flag): boolean {
		return flag.color == this.color && flag.secondaryColor == this.secondaryColor;
	}

	/* Map a list of flags to directives, accepting a filter */
	static find(flags: Flag[]): Directive[] {
		flags = _.filter(flags, flag => this.filter(flag));
		return _.compact(_.map(flags, flag => Overmind.directives[flag.name]));
	}

	abstract spawnMoarOverlords(): void;

	/* Initialization logic goes here, called in overseer.init() */
	abstract init(): void;

	/* Runtime logic goes here, called in overseer.run() */
	abstract run(): void;

	// Overwrite this in child classes to display relevant information
	visuals(): void {

	}
}
