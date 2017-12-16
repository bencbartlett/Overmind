declare namespace NodeJS {
	interface Global {
		deref(ref: string): RoomObject | null;
		derefRoomPosition(protoPos: protoPos): RoomPosition;
		Overmind: IOvermind;
		flagCodes: { [category: string]: flagCat };
		taskFromPrototask(protoTask: protoTask): ITask;
		log: any;
		Profiler: any;
	}
}

declare var Overmind: IOvermind;
declare var flagCodes: { [category: string]: flagCat };
declare function taskFromPrototask(protoTask: protoTask): ITask;

interface Game {
	cache: {
		assignments: { [ref: string]: { [roleName: string]: string[] } };
		targets: { [ref: string]: string[] };
		objectives: { [ref: string]: string[] };
		structures: { [roomName: string]: { [structureType: string]: Structure[] } };
		drops: { [roomName: string]: { [resourceType: string]: Resource[] } };
		constructionSites: { [roomName: string]: ConstructionSite[] };
	};
	icreeps: { [name: string]: ICreep };
	directives: { [name: string]: IDirective };
}

interface IOvermind {
	name: string;
	Colonies: { [roomName: string]: IColony };
	colonyMap: { [roomName: string]: string };
	invisibleRooms: string[];
	Overlords: { [roomName: string]: IOverlord };
	init(): void;
	run(): void;
}

