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

