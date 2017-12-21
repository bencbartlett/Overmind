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

interface Game {
	// cache: {
	// 	assignments: { [ref: string]: { [roleName: string]: string[] } };
	// 	targets: { [ref: string]: string[] };
	// 	objectives: { [ref: string]: string[] };
	// 	structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	// 	drops: { [roomName: string]: { [resourceType: string]: Resource[] } };
	// 	constructionSites: { [roomName: string]: ConstructionSite[] };
	// };
	icreeps: { [name: string]: ICreep };
	directives: { [name: string]: IDirective };
}

interface ICache {
	assignments: { [ref: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	objectives: { [ref: string]: string[] };
	structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	constructionSites: { [roomName: string]: ConstructionSite[] };
	structureSites: { [roomName: string]: ConstructionSite[] };
	roadSites: { [roomName: string]: ConstructionSite[] };
	drops: { [roomName: string]: { [resourceType: string]: Resource[] } };

	// constructionSites: { [roomName: string]: ConstructionSite[] };
	build(): void;

	rebuild(): void;
}

interface IOvermind {
	cache: ICache;
	Colonies: { [roomName: string]: IColony };
	colonyMap: { [roomName: string]: string };
	invisibleRooms: string[];
	Overlords: { [roomName: string]: IOverlord };

	build(): void;

	rebuild(): void;
	init(): void;
	run(): void;
}

declare var Overmind: IOvermind;
declare var flagCodes: { [category: string]: flagCat };

declare function taskFromPrototask(protoTask: protoTask): ITask;
