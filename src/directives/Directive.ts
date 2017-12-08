import {log} from '../lib/logger/log';
export abstract class Directive implements IDirective {

	flag: Flag;								// The flag instantiating this directive
	name: string;							// The name of the flag
	colony: IColony | undefined; 			// The colony of the flag
	colonyName: string | undefined; 		// The name of the colony of the flag
	assignedTo: string | undefined;  		// The name of the colony responsible for this directive (usually same)
	pos: RoomPosition; 						// Flag position
	room: Room | undefined;					// Flag room
	memory: FlagMemory;						// Flag memory
	color: ColorConstant; 					// Flag color
	secondaryColor: ColorConstant;			// Flag secondaryColor

	static directiveName: string;			// Name of the type of directive, e.g. "incubate"
	static colorCode: ColorCode;			// Colors of the flag of this directive

	constructor(flag: Flag) {
		this.flag = flag;
		this.name = flag.name;
		this.colony = flag.colony;
		this.colonyName = flag.colonyName;
		if (this.colony) {					// a separate this.assignedTo property allows for colonization flexibility
			this.assignedTo = this.colony.name;
		}
		this.pos = flag.pos;
		this.room = flag.room;
		this.memory = flag.memory;
		this.color = flag.color;
		this.secondaryColor = flag.secondaryColor;
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
	getAssignedCreeps(roleName: string): ICreep[] {
		return this.flag.getAssignedCreeps(roleName);
	}

	// Custom directive methods ========================================================================================

	/* Create an appropriate flag to instantiate this directive in the next tick */
	static create(pos: RoomPosition, options: { name?: string, allowMultiple?: boolean } = {}): number {
		_.defaults(options, {
			name         : this.directiveName + pos.roomName,
			allowMultiple: false,
		});
		// TODO: cache flags by type and room so that you can do room.flags when you don't have vision
		log.alert(`Creating ${this.directiveName} directive in room ${pos.roomName}!`);
		return Game.rooms[pos.roomName].createFlag(pos, options.name,
												   this.colorCode.color, this.colorCode.secondaryColor);
	}

	/* Filter for _.filter() that checks if a flag is of the matching type */
	static filter(flag: Flag): boolean {
		return flag.color == this.colorCode.color && flag.secondaryColor == this.colorCode.secondaryColor;
	}

	/* Initialization logic goes here, called in overlord.init() */
	abstract init(): void

	/* Runtime logic goes here, called in overlord.run() */
	abstract run(): void
}