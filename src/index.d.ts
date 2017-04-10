// import {OM} from "../src/Overmind";
// import {Task} from "../src/Task";

interface Memory {
    uuid: number;
    log: any;
}

// declare function require(path: string): any;

declare var global: any;

declare var Overmind: any;

interface Creep {
    run(): void;
    publicMessage(sayList: string[]): void;
    getBodyparts(partType: string): void;
    needsReplacing: boolean;
    workRoom: Room;
    lifetime: number;
    assignment: RoomObject;
    task: any;
    assign(task: any, target?: any): string;
    moveSpeed: number;
    repairNearbyDamagedRoad(): number;
    travelTo(destination: { pos: RoomPosition }, options?: any): number;
}

// interface Task {
//     name: string;
//     creepName: string;
//     targetID: string;
//     targetCoords: { x: number; y: number; roomName: string; };
//     maxPerTarget: number;
//     maxPerTask: number;
//     targetRange: number;
//     moveColor: string;
//     data: any;
// }

interface RoomObject {
    log(message: string): void;
    inSameRoomAs(otherObject: RoomObject): boolean;
    ref: string;
    assignedCreepNames: { [role: string]: string };
    getAssignedCreeps(role: string): Creep[];
    getAssignedCreepAmounts(role: string): number;
    assignedCreepAmounts: { [role: string]: number };
    targetedBy: string[];
    flagged: boolean;
    flaggedWith(filter: Function): boolean;
    linked: boolean;
    links: StructureLink[];
    pathLengthToStorage: number;
    roomName: string;
    pathLengthTo(otherObject: RoomObject): number;
}

interface RoomPosition {
    flagged: boolean;
    flaggedWith(filter: Function): boolean;
}

interface Room {
    brain: any;
    my: boolean;
    reservedByMe: boolean;
    signedByMe: boolean;
    spawns: StructureSpawn[];
    creeps: Creep[];
    // assignedCreeps: Creep[];
    tasks: any[];
    taskTargets: RoomObject[];
    hostiles: Creep[];
    hostileStructures: Structure[];
    flags: Flag[];
    assignedFlags: Flag[];
    remainingConstructionProgress: number;
    fullestContainer(): StructureContainer;
    findCached(findKey: string, findFunction: Function, reCache?: boolean): RoomObject[];
    containers: StructureContainer[];
    storageUnits: (StructureContainer | StructureStorage)[];
    towers: StructureTower[];
    labs: StructureLab[];
    sources: Source[];
    sinks: (StructureSpawn | StructureExtension | StructureLab | StructureTower)[];
    repairables: Structure[];
    constructionSites: ConstructionSite[];
    structureSites: ConstructionSite[];
    roadSites: ConstructionSite[];
    barriers: (StructureWall | StructureRampart)[]
    remoteContainers: StructureContainer[];
    run(): void;
}

interface RoomVisual {
    multitext(textArray: string[], x: number, starty: number, fontSize: number, style: any): number;
}

interface StructureContainer {
    miningFlag: Flag;
    predictedEnergyOnArrival: number;
}

interface StructureLab {
    assignedMineralType: string;
    IO: string;
    maxAmount: number;
}

interface StructureLink {
    refillThis: boolean;
}

interface StructureTerminal {
    brain: any;
}

interface StructureSpawn {
    creepName(role: string): string;
    cost(bodyArray: string[]): number;
    uptime: number;
    statusMessage: string;
}

interface StructureTower {
    run(): void;
    attackNearestEnemy(): number;
    healNearestAlly(): number;
    repairNearestStructure(): number;
    preventRampartDecay(): number;
}

interface Flag {
    assign(roomName: string): number;
    unassign(): number;
    assignedRoom: Room;
    setMineral(mineralType: string): number;
    IO: string;
    category: any;
    type: any;
    action: Function;
    getAssignedCreepAmounts(role: string): number;
    assignedCreepAmounts: { [role: string]: number };
    getRequiredCreepAmounts(role: string): number;
    requiredCreepAmounts: { [role: string]: number };
    needsAdditional(role: string): boolean;
    requestCreepIfNeeded(brain: any, role: string, {assignment: any, workRoom: string, patternRepetitionLimit: number}): any;
    pathLengthToAssignedRoomStorage: number;
    haulingNeeded: boolean;
}

