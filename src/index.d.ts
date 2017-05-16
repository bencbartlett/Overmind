declare var global: any;
declare var Overmind: any;
declare var flagCodes: { [category: string]: flagCat };

interface Game {
    cache: {
        assignments: { [ref: string]: { [roleName: string]: string[] } };
        targets: { [ref: string]: string[] };
        objectives: { [ref: string]: string[] };
        structures: { [roomName: string]: { [structureType: string]: Structure[] } };
        constructionSites: { [roomName: string]: ConstructionSite[] };
    }
}

interface IColony {
    name: string;
    memory: any;
    room: Room;
    hatchery: any;
    storage: StructureStorage;
    terminal: StructureTerminal;
    incubating: boolean;
    outposts: Room[];
    rooms: Room[];
    flags: Flag[];
    creeps: Creep[];
    creepsByRole: { [roleName: string]: Creep[] };
    getCreepsByRole(roleName: string): Creep[];
    sources: Source[];
    miningSites: { [sourceID: string]: IMiningSite };
    haulingPowerNeeded: number;
    overlord: IOverlord;
}

interface flagActions {
    [actionType: string]: Function;
}

interface flagSubCat {
    color: number;
    secondaryColor: number;
    filter: Function;
    action: Function | null;
}

interface flagCat {
    color: number;
    filter: Function;
    action: flagActions | null;
    [subcat: string]: any;
}

interface protoCreep {
    body: string[];
    name: string;
    memory: any;
}

interface protoCreepOptions {
    assignment?: RoomObject;
    patternRepetitionLimit?: number;
}

interface Creep {
    run(): void;
    publicMessage(sayList: string[]): void;
    getBodyparts(partType: string): number;
    needsReplacing: boolean;
    // workRoom: Room;
    colony: IColony;
    lifetime: number;
    assignment: RoomObject;
    objective: IObjective | null;
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
    remove(): void;
    assign(creep: Creep): string;
    onAssignment(): void;
    isValidTask(): boolean;
    isValidTarget(): boolean;
    isValid(): boolean;
    move(): number;
    step(): number | void;
    work(): number;
}

interface IObjective {
    name: string;
    target: RoomObject;
    pos: RoomPosition;
    ref: string;
    creepNames: string[];
    maxCreeps: number;
    assignableToRoles: string[];
    assignableTo(creep: Creep): boolean;
    getTask(): ITask;
    assignTo(creep: Creep): string;
}

interface IRole {
    name: string;
    settings: any;
    roleRequirements: Function;
    bodyPatternCost: number;
    bodyCost(bodyArray: string[]): number;
    generateBody(availableEnergy: number, maxRepeats?: number): string[];
    generateLargestCreep(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep;
    onCreate(pCreep: protoCreep): protoCreep;
    create(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep;
    requestTask(creep: Creep): string;
    recharge(creep: Creep): string;
    newTask(creep: Creep): void;
    executeTask(creep: Creep): number | void;
    renewIfNeeded(creep: Creep): string;
    onRun(creep: Creep): any;
    run(creep: Creep): any;
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

interface StructureTerminal {
    brain: any;
}

interface StructureSpawn {
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
    requestCreepIfNeeded(role: IRole, options: protoCreepOptions): void;
    pathLengthToAssignedRoomStorage: number;
    haulingNeeded: boolean;
}

interface IMiningSite {
    name: string;
    room: Room;
    pos: RoomPosition;
    source: Source;
    energyPerTick: number;
    miningPowerNeeded: number;
    output: Container | Link | null;
    outputConstructionSite: ConstructionSite | null;
    fullness: number;
    predictedStore: number;
    miners: Creep[];
}

interface IOverlord {
    name: string;
    memory: any;
    room: Room;
    colony: IColony;
    settings: any;
    directives: any[]; // TODO: IDirective[]
    objectives: { [objectiveName: string]: IObjective[] };
    objectivesByRef: { [objectiveRef: string]: IObjective };
    objectivePriorities: string[];
    spawnPriorities: { [role: string]: number };
    log(message: string): void;
    init(): void;
    getObjectives(): { [objectiveName: string]: IObjective[] };
    countObjectives(name: string): number;
    assignTask(creep: Creep): string;
    handleCoreSpawnOperations(): void;
    handleIncubationSpawnOperations(): void;
    handleAssignedSpawnOperations(): void;
    handleSpawnOperations(): void;
    handleTerminalOperations(): void;
    handleSafeMode(): void;
    run(): void;
}

