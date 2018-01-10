declare namespace NodeJS {
	interface Global {
		Overmind: IOvermind;
		log: any;
		Profiler: any;

		deref(ref: string): RoomObject | null;

		derefRoomPosition(protoPos: protoPos): RoomPosition;

		taskFromPrototask(protoTask: protoTask): ITask;
	}
}

interface Game {
	zerg: { [name: string]: Zerg };
	directives: { [name: string]: IDirective };
}

interface ICache {
	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	constructionSites: { [roomName: string]: ConstructionSite[] };
	structureSites: { [roomName: string]: ConstructionSite[] };
	roadSites: { [roomName: string]: ConstructionSite[] };
	drops: { [roomName: string]: { [resourceType: string]: Resource[] } };

	build(): void;

	rebuild(): void;
}

interface IOvermind {
	cache: ICache;
	Colonies: { [roomName: string]: any };
	colonyMap: { [roomName: string]: string };
	invisibleRooms: string[];

	build(): void;

	rebuild(): void;

	init(): void;

	run(): void;
}

declare var Overmind: IOvermind;

declare function taskFromPrototask(protoTask: protoTask): ITask;
