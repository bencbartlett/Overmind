// Type guards library: this allows for instanceof - like behavior for much lower CPU cost. Each type guard
// differentiates an ambiguous input by recognizing one or more unique properties.

import {Directive} from '../directives/Directive';
import {AnyZerg} from '../zerg/AnyZerg';
import {CombatZerg} from '../zerg/CombatZerg';
import {NeuralZerg} from '../zerg/NeuralZerg';
import {PowerZerg} from '../zerg/PowerZerg';
import {Zerg} from '../zerg/Zerg';

// export interface EnergyStructure extends Structure {
// 	energy: number;
// 	energyCapacity: number;
// }

// export interface StoreStructure extends Structure {
// 	store: StoreDefinition;
// 	storeCapacity: number;
// }

// export function isEnergyStructure(obj: RoomObject): obj is EnergyStructure {
// 	return (<EnergyStructure>obj).energy != undefined && (<EnergyStructure>obj).energyCapacity != undefined;
// }
//
// export function isStoreStructure(obj: RoomObject): obj is StoreStructure {
// 	return (<StoreStructure>obj).store != undefined && (<StoreStructure>obj).storeCapacity != undefined;
// }

export function isStructure(obj: RoomObject): obj is Structure {
	return (<Structure>obj).structureType != undefined;
}

export function isOwnedStructure(structure: Structure): structure is OwnedStructure {
	return (<OwnedStructure>structure).owner != undefined;
}

export function isExtension(structure: Structure): structure is StructureExtension {
	return structure.structureType == STRUCTURE_EXTENSION;
}

export function isRampart(structure: Structure): structure is StructureRampart {
	return structure.structureType == STRUCTURE_RAMPART;
}

export function isRoad(structure: Structure): structure is StructureRoad {
	return structure.structureType == STRUCTURE_ROAD;
}

export function isSpawn(structure: Structure): structure is StructureSpawn {
	return structure.structureType == STRUCTURE_SPAWN;
}

export function isLink(structure: Structure): structure is StructureLink {
	return structure.structureType == STRUCTURE_LINK;
}

export function isWall(structure: Structure): structure is StructureWall {
	return structure.structureType == STRUCTURE_WALL;
}

export function isStorage(structure: Structure): structure is StructureStorage {
	return structure.structureType == STRUCTURE_STORAGE;
}

export function isTower(structure: Structure): structure is StructureTower {
	return structure.structureType == STRUCTURE_TOWER;
}

export function isObserver(structure: Structure): structure is StructureObserver {
	return structure.structureType == STRUCTURE_OBSERVER;
}

export function isPowerSpawn(structure: Structure): structure is StructurePowerSpawn {
	return structure.structureType == STRUCTURE_POWER_SPAWN;
}

export function isExtractor(structure: Structure): structure is StructureExtractor {
	return structure.structureType == STRUCTURE_EXTRACTOR;
}

export function isLab(structure: Structure): structure is StructureLab {
	return structure.structureType == STRUCTURE_LAB;
}

export function isTerminal(structure: Structure): structure is StructureTerminal {
	return structure.structureType == STRUCTURE_TERMINAL;
}

export function isContainer(structure: Structure): structure is StructureContainer {
	return structure.structureType == STRUCTURE_CONTAINER;
}

export function isNuker(structure: Structure): structure is StructureNuker {
	return structure.structureType == STRUCTURE_NUKER;
}

export function isFactory(structure: Structure): structure is StructureFactory {
	return structure.structureType == STRUCTURE_FACTORY;
}

export function isSource(obj: Source | Mineral): obj is Source {
	return (<Source>obj).energy != undefined;
}

export function isTombstone(obj: RoomObject | HasPos): obj is Tombstone {
	return (<Tombstone>obj).deathTime != undefined;
}

export function isRuin(obj: RoomObject | HasPos): obj is Ruin {
	return (<Ruin>obj).destroyTime != undefined;
}

export function isResource(obj: RoomObject | HasPos): obj is Resource {
	return (<Resource>obj).amount != undefined;
}

export function hasPos(obj: HasPos | RoomPosition): obj is HasPos {
	return (<HasPos>obj).pos != undefined;
}

export function isDirective(thing: any): thing is Directive {
	return (<Directive>thing).isDirective || false;
}

export function isCreep(obj: RoomObject): obj is Creep {
	return (<Creep>obj).fatigue != undefined;
}

export function isPowerCreep(obj: RoomObject): obj is PowerCreep {
	return (<PowerCreep>obj).powers != undefined;
}

export function isAnyZerg(thing: any): thing is AnyZerg {
	return (<AnyZerg>thing).isAnyZerg || false;
}

export function isStandardZerg(creep: AnyCreep | AnyZerg): creep is Zerg {
	return (<Zerg>creep).isStandardZerg || false;
}

export function isPowerZerg(creep: AnyCreep | AnyZerg): creep is PowerZerg {
	return (<PowerZerg>creep).isPowerZerg || false;
}

export function isCombatZerg(zerg: AnyCreep | AnyZerg): zerg is CombatZerg {
	return (<CombatZerg>zerg).isCombatZerg || false;
}

export function isNeuralZerg(zerg: AnyCreep | AnyZerg): zerg is NeuralZerg {
	return (<NeuralZerg>zerg).isNeuralZerg || false;
}
