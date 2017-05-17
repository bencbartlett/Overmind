interface Creep {
//     run(): void;
//     publicMessage(sayList: string[]): void;
    getBodyparts(partType: string): number;
//     needsReplacing: boolean;
//     // workRoom: Room;
    colony: IColony;
    lifetime: number;
//     assignment: RoomObject;
//     objective: IObjective | null;
//     task: ITask;
//     assign(task: ITask): string;
//     moveSpeed: number;
//     repairNearbyDamagedRoad(): number;
    travelTo(destination: { pos: RoomPosition }, options?: any): number;
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
    // getAssignedCreepAmounts(role: string): number;
    // assignedCreepAmounts: { [role: string]: number };
    getRequiredCreepAmounts(role: string): number;
    requiredCreepAmounts: { [role: string]: number };
    needsAdditional(role: string): boolean;
    requestCreepIfNeeded(role: ISetup, options: protoCreepOptions): void;
    pathLengthToAssignedRoomStorage: number;
    haulingNeeded: boolean;
}

type Sink = StructureSpawn | StructureExtension | StructureLab | StructureTower | StructurePowerSpawn;

interface Room {
    // brain: any;
    colonyFlag: Flag;
    colony: IColony;
    overlord: IOverlord;
    my: boolean;
    reservedByMe: boolean;
    signedByMe: boolean;
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
    // Preprocessed structures
    structures: { [structureType: string]: Structure[] };
    spawns: Spawn[];
    extensions: Extension[];
    containers: StructureContainer[];
    storageUnits: (StructureContainer | StructureStorage)[];
    towers: StructureTower[];
    links: StructureLink[];
    labs: StructureLab[];
    sources: Source[];
    sinks: Sink[];
    repairables: Structure[];
    constructionSites: ConstructionSite[];
    structureSites: ConstructionSite[];
    roadSites: ConstructionSite[];
    barriers: (StructureWall | StructureRampart)[]
    remoteContainers: StructureContainer[];
    sinkContainers: StructureContainer[];
    sinkLinks: StructureLink[];
    run(): void;
}

interface RoomObject {
    log(message: string): void;
    inSameRoomAs(otherObject: RoomObject): boolean;
    ref: string;
    colony: IColony;
    assignedCreepNames: { [role: string]: string };
    getAssignedCreeps(role: string): ICreep[];
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
    name: string;
    flagged: boolean;
    flaggedWith(filter: Function): boolean;
}

interface RoomVisual {
    multitext(textArray: string[], x: number, starty: number, fontSize: number, style: any): number;
}

interface StructureContainer {
    refillThis: boolean;
    miningFlag: Flag;
    miningSite: IMiningSite;
    predictedEnergyOnArrival: number;
}

interface StructureController {
    reservedByMe: boolean;
    signedByMe: boolean;
}

interface StructureLab {
    assignedMineralType: string;
    IO: string;
    maxAmount: number;
}

interface StructureLink {
    refillThis: boolean;
}

interface StructureSpawn {
    cost(bodyArray: string[]): number;
    uptime: number;
    statusMessage: string;
}

interface StructureTerminal {
    brain: any;
}

interface StructureTower {
    run(): void;
    attackNearestEnemy(): number;
    healNearestAlly(): number;
    repairNearestStructure(): number;
    preventRampartDecay(): number;
}
