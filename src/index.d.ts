// import {OM} from "../src/Overmind";
// import {Task} from "../src/Task";

interface Memory {
    uuid: number;
    log: any;
}

// declare function require(path: string): any;

declare var global: any;

declare var Overmind: any;

interface protoCreep {
    body: string[];
    name: string;
    memory: any;
}

interface creepCall {
    assignment: RoomObject;
    workRoom: string;
    patternRepetitionLimit?: number;
}

interface Creep {
    run(): void;
    publicMessage(sayList: string[]): void;
    getBodyparts(partType: string): number;
    needsReplacing: boolean;
    workRoom: Room;
    lifetime: number;
    assignment: RoomObject;
    task: any;
    assign(task: ITask): string;
    moveSpeed: number;
    repairNearbyDamagedRoad(): number;
    travelTo(destination: { pos: RoomPosition }, options?: any): number;
}

interface ITask {
    name: string;
    creepName: string;
    targetRef: string;
    targetCoords: { x: number | null; y: number | null; roomName: string; };
    maxPerTarget: number;
    maxPerTask: number;
    targetRange: number;
    moveColor: string;
    data: any;
    creep: Creep;
    target: RoomObject;
    targetPos: RoomPosition;
    assign(creep: Creep): string;
    onAssignment(): void;
    isValidTask(): boolean;
    isValidTarget(): boolean;
    move(): number;
    step(): number | void;
    work(): number;
}

interface IRole {
    name: string;
    settings: any;
    roleRequirements: Function;
    bodyPatternCost: number;
    bodyCost(bodyArray: string[]): number;
    generateBody(availableEnergy: number, maxRepeats?: number): string[];
    generateLargestCreep(spawn: Spawn, {assignment, workRoom, patternRepetitionLimit}: creepCall): protoCreep;
    onCreate(pCreep: protoCreep): protoCreep;
    create(spawn: StructureSpawn, {assignment, workRoom, patternRepetitionLimit}: creepCall): protoCreep;
    requestTask(creep: Creep): string;
    recharge(creep: Creep): string;
    newTask(creep: Creep): void;
    executeTask(creep: Creep): number | void;
    renewIfNeeded(creep: Creep): string;
    onRun(creep: Creep): any;
    run(creep: Creep): any;
}

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

type Sink = StructureSpawn | StructureExtension | StructureLab | StructureTower | StructurePowerSpawn;

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
    sinks: Sink[];
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
    assign(roomName: string): void;
    unassign(): void;
    assignedRoom: Room;
    setMineral(mineralType: string): void;
    IO: string;
    category: any;
    type: any;
    action: Function;
    getAssignedCreepAmounts(role: string): number;
    assignedCreepAmounts: { [role: string]: number };
    getRequiredCreepAmounts(role: string): number;
    requiredCreepAmounts: { [role: string]: number };
    needsAdditional(role: string): boolean;
    requestCreepIfNeeded(brain: any, role: IRole, info: creepCall): protoCreep | void;
    pathLengthToAssignedRoomStorage: number;
    haulingNeeded: boolean;
}



