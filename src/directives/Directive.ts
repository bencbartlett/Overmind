import {log} from '../lib/logger/log';
import {profile} from '../lib/Profiler';


@profile
export abstract class Directive implements IDirective {

	static directiveName: string;			// Name of the type of directive, e.g. "incubate"
	static color: ColorConstant; 			// Flag color
	static secondaryColor: ColorConstant;	// Flag secondaryColor

	flag: Flag;								// The flag instantiating this directive
	name: string;							// The name of the flag
	colony: IColony; 						// The colony of the directive (directive is removed if undefined)
	// assignedTo: string | undefined;  		// The name of the colony responsible for this directive (usually same)
	pos: RoomPosition; 						// Flag position
	room: Room | undefined;					// Flag room
	memory: FlagMemory;						// Flag memory
	overlords: { [name: string]: IOverlord };	// Overlords

	// static colorCode: ColorCode;			// Colors of the flag of this directive

	constructor(flag: Flag) {
		this.flag = flag;
		this.name = flag.name;
		this.colony = flag.colony;
		// if (this.colony) {					// a separate this.assignedTo property allows for colonization flexibility
		// 	this.assignedTo = this.colony.name;
		// }
		this.pos = flag.pos;
		this.room = flag.room;
		this.memory = flag.memory;
		// this.color = flag.color;
		// this.secondaryColor = flag.secondaryColor;
		this.overlords = {};
		// Register to colony overseer or delete the directive if the colony is dead
		if (!this.colony) {
			this.remove();
		} else {
			this.colony.overseer.directives.push(this);
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

	// Mirrored from prototypes
	// getAssignedCreeps(roleName: string): Zerg[] {
	// 	return this.flag.getAssignedCreeps(roleName);
	// }

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
		return Game.rooms[pos.roomName].createFlag(pos, name, this.color, this.secondaryColor);
	}

	/* Filter for _.filter() that checks if a flag is of the matching type */
	static filter(flag: Flag): boolean {
		return flag.color == this.color && flag.secondaryColor == this.secondaryColor;
	}

	// protected initOverlords(): void {
	// 	for (let name in this.overlords) {
	// 		this.overlords[name].init();
	// 	}
	// }
	//
	// protected runOverlords(): void {
	// 	for (let name in this.overlords) {
	// 		this.overlords[name].run();
	// 	}
	// }

	/* Initialization logic goes here, called in overseer.init() */
	abstract init(): void

	/* Runtime logic goes here, called in overseer.run() */
	abstract run(): void
}