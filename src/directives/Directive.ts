import {log} from '../lib/logger/log';
import {profile} from '../lib/Profiler';
import {Colony} from '../Colony';
import {Overlord} from '../overlords/Overlord';


@profile
export abstract class Directive {

	static directiveName: string;				// Name of the type of directive, e.g. "incubate"
	static color: ColorConstant; 				// Flag color
	static secondaryColor: ColorConstant;		// Flag secondaryColor

	flag: Flag;									// The flag instantiating this directive
	name: string;								// The name of the flag
	colony: Colony; 							// The colony of the directive (directive is removed if undefined)
	pos: RoomPosition; 							// Flag position
	room: Room | undefined;						// Flag room
	memory: FlagMemory;							// Flag memory
	overlords: { [name: string]: Overlord };	// Overlords

	constructor(flag: Flag) {
		this.flag = flag;
		this.name = flag.name;
		this.colony = Directive.getFlagColony(flag);
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

	static getFlagColony(flag: Flag): Colony {
		if (flag.memory.colony) {
			return Overmind.Colonies[flag.memory.colony];
		} else {
			let colonyName = Overmind.colonyMap[flag.pos.roomName];
			if (colonyName) {
				return Overmind.Colonies[colonyName];
			} else {
				flag.recalculateColony();
				return Overmind.Colonies[flag.memory.colony!];
			}
		}
	}

	// Wrapped flag methods ============================================================================================
	remove(): number {
		return this.flag.remove();
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
	static create(pos: RoomPosition, name?: string): number {
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
		log.alert(`Creating ${this.directiveName} directive in room ${pos.roomName}!`);
		return pos.createFlag(name, this.color, this.secondaryColor);
	}

	/* Filter for _.filter() that checks if a flag is of the matching type */
	static filter(flag: Flag): boolean {
		return flag.color == this.color && flag.secondaryColor == this.secondaryColor;
	}

	/* Initialization logic goes here, called in overseer.init() */
	abstract init(): void

	/* Runtime logic goes here, called in overseer.run() */
	abstract run(): void

	// Overwrite this in child classes to display relevant information
	visuals(): void {

	}
}