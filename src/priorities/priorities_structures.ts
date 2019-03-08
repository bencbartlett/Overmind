/**
 * Prioritized list of what order structures should be built in
 */
export const BuildPriorities: BuildableStructureConstant[] = [
	STRUCTURE_SPAWN,
	STRUCTURE_TOWER,
	STRUCTURE_EXTENSION,
	STRUCTURE_STORAGE,
	STRUCTURE_TERMINAL,
	STRUCTURE_CONTAINER,
	STRUCTURE_LINK,
	STRUCTURE_EXTRACTOR,
	STRUCTURE_LAB,
	STRUCTURE_NUKER,
	STRUCTURE_OBSERVER,
	STRUCTURE_POWER_SPAWN,
	STRUCTURE_WALL,
	STRUCTURE_RAMPART,
	STRUCTURE_ROAD,
];

/**
 * Prioritized list of what order structures should be fortified in case of nuclear strike
 */
export const FortifyPriorities: BuildableStructureConstant[] = [
	STRUCTURE_TERMINAL,
	STRUCTURE_STORAGE,
	STRUCTURE_SPAWN,
	STRUCTURE_TOWER,
	STRUCTURE_LAB,
	STRUCTURE_NUKER,
];

/**
 * Prioritized list of what order enemy structures should be attacked in
 */
export const AttackStructurePriorities: BuildableStructureConstant[] = [
	STRUCTURE_SPAWN,
	STRUCTURE_TOWER,
	STRUCTURE_EXTENSION,
	STRUCTURE_LINK,
	STRUCTURE_LAB,
	STRUCTURE_NUKER,
	STRUCTURE_OBSERVER,
	STRUCTURE_EXTRACTOR,
	STRUCTURE_POWER_SPAWN,
	STRUCTURE_CONTAINER,
	STRUCTURE_ROAD,
	STRUCTURE_STORAGE,
	STRUCTURE_TERMINAL,
	STRUCTURE_RAMPART,
	STRUCTURE_WALL,
];

export const AttackStructureScores = _.zipObject(_.map(AttackStructurePriorities, type =>
	[type, AttackStructurePriorities.length - _.indexOf(AttackStructurePriorities, type)])) as { [t: string]: number };

/**
 * Prioritized list of what order owned structures should be demolished (and then moved) in
 */
export const DemolishStructurePriorities: {
	structureType: BuildableStructureConstant,
	maxRemoved?: number,
	// dismantle?: boolean
}[] = [
	{structureType: STRUCTURE_EXTENSION, maxRemoved: 15},
	{structureType: STRUCTURE_SPAWN, maxRemoved: 1},
	{structureType: STRUCTURE_CONTAINER},
	{structureType: STRUCTURE_TOWER, maxRemoved: 1},
	{structureType: STRUCTURE_LINK},
	{structureType: STRUCTURE_LAB},
	{structureType: STRUCTURE_NUKER},
	{structureType: STRUCTURE_OBSERVER},
	// {structureType: STRUCTURE_EXTRACTOR, maxRemoved: 1}, // skip extractor; doesn't need to be relocated
	{structureType: STRUCTURE_POWER_SPAWN},
	// {structureType: STRUCTURE_ROAD}, // just let roads decay
	{structureType: STRUCTURE_CONTAINER},
	{structureType: STRUCTURE_STORAGE, maxRemoved: 1},
	{structureType: STRUCTURE_TERMINAL, maxRemoved: 1},
	{structureType: STRUCTURE_WALL},
	{structureType: STRUCTURE_RAMPART},
];


