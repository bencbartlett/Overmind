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
    };
    icreeps: { [name: string]: ICreep };
}

interface ISetup {
    name: string;
    settings: any;
    roleRequirements: Function;
    bodyPatternCost: number;
    bodyCost(bodyArray: string[]): number;
    generateBody(availableEnergy: number, maxRepeats?: number): string[];
    generateLargestCreep(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep;
    onCreate(pCreep: protoCreep): protoCreep;
    create(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep;
}

interface ICreep {
    // Creep properties
    creep: Creep;
    body: BodyPartDefinition[];
    carry: StoreDefinition;
    carryCapacity: number;
    fatigue: number;
    hits: number;
    hitsMax: number;
    id: string;
    memory: any;
    name: string;
    pos: RoomPosition;
    ref: string;
    roleName: string;
    room: Room;
    spawning: boolean;
    ticksToLive: number;
    // Custom properties
    settings: any;
    // Creep methods
    attack(target: Creep | Structure): number;
    attackController(controller: StructureController): number;
    build(target: ConstructionSite): number;
    claimController(controller: StructureController): number;
    dismantle(target: Structure): number;
    drop(resourceType: string, amount?: number): number;
    getActiveBodyparts(type: string): number;
    harvest(source: Source | Mineral): number;
    move(direction: number): number;
    pickup(resource: Resource): number;
    rangedAttack(target: Creep | Structure): number;
    rangedMassAttack(): number;
    repair(target: Structure): number;
    reserveController(controller: StructureController): number;
    say(message: string, pub?: boolean): number;
    signController(target: Controller, text: string): number;
    suicide(): number;
    upgradeController(controller: StructureController): number;
    heal(target: Creep | ICreep): number;
    rangedHeal(target: Creep | ICreep): number;
    transfer(target: Creep | ICreep | Structure, resourceType: string, amount?: number): number;
    withdraw(target: Creep | ICreep | Structure, resourceType: string, amount?: number): number;
    travelTo(destination: { pos: RoomPosition }, options?: any): number;
    // Custom creep methods
    log(...args: any[]): void;
    task: ITask;
    assign(task: ITask): string;
    colony: IColony;
    lifetime: number;
    moveSpeed: number;
    needsReplacing: boolean;
    getBodyparts(partType: string): number;
    publicMessage(sayList: string[]): void;
    repairNearbyDamagedRoad(): number;
    assignment: RoomObject;
    assignmentPos: RoomPosition;
    objective: IObjective;
    requestTask(): string;
    recharge(): string;
    newTask(): void;
    executeTask(): number | void;
    renewIfNeeded(): string;
    onRun(): any;
    run(): any;
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
    creeps: ICreep[];
    creepsByRole: { [roleName: string]: ICreep[] };
    getCreepsByRole(roleName: string): ICreep[];
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
    creep: ICreep;
    target: RoomObject;
    targetPos: RoomPosition;
    remove(): void;
    assign(creep: ICreep): string;
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
    assignableTo(creep: ICreep): boolean;
    getTask(): ITask;
    assignTo(creep: ICreep): string;
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
    miners: ICreep[];
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
    assignTask(creep: ICreep): string;
    handleCoreSpawnOperations(): void;
    handleIncubationSpawnOperations(): void;
    handleAssignedSpawnOperations(): void;
    handleSpawnOperations(): void;
    handleTerminalOperations(): void;
    handleSafeMode(): void;
    run(): void;
}

