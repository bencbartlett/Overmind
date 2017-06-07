// Hatchery - groups all spawns in a colony

import {ObjectiveGroup} from '../objectives/ObjectiveGroup';
import {ObjectiveSupply, ObjectiveSupplyTower} from '../objectives/objectives';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskDeposit} from '../tasks/task_deposit';
import {AbstractHiveCluster} from './AbstractHiveCluster';
import {SupplierSetup} from '../roles/supplier';

export class Hatchery extends AbstractHiveCluster implements IHatchery {

	memory: any; 											// Memory.colonies.hatchery
	spawns: Spawn[]; 										// List of spawns in the hatchery
	availableSpawns: Spawn[]; 								// Spawns that are available to make stuff right now
	extensions: Extension[]; 								// List of extensions in the hatchery
	link: StructureLink; 									// The input link
	towers: StructureTower[]; 								// All towers that aren't in the command center
	battery: StructureContainer;							// The container to provide an energy buffer
	private objectivePriorities: string[]; 					// Priorities for objectives in the objectiveGroup
	objectiveGroup: ObjectiveGroup; 						// Objectives for hatchery operation and maintenance
	spawnPriorities: { [role: string]: number }; 			// Default priorities for spawning creeps of various roles
	private settings: {										// Settings for hatchery operation
		refillTowersBelow: number,  							// What value to refill towers at?
		linksRequestEnergyBelow: number, 						// What value will links request more energy at?
	};
	private productionQueue: { [priority: number]: protoCreep[] };  // Priority queue of protocreeps
	private _supplier: ICreep; 										// The supplier working the hatchery
	private _idlePos: RoomPosition; 								// Idling position for the supplier


	constructor(colony: IColony, headSpawn: StructureSpawn) {
		super(colony, headSpawn, 'hatchery');
		// Set up memory
		this.memory = colony.memory.hatchery;
		// Register structure components
		this.spawns = colony.spawns;
		this.availableSpawns = _.filter(this.spawns, (spawn: Spawn) => !spawn.spawning);
		this.extensions = colony.extensions;
		this.link = this.pos.findClosestByLimitedRange(colony.links, 2);
		this.battery = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		// Associate all towers that aren't part of the command center if there is one
		if (colony.commandCenter) {
			this.towers = _.difference(colony.towers, colony.commandCenter.towers);
		} else {
			this.towers = colony.towers;
		}
		// Objective groups for supplier tasks
		this.objectivePriorities = [
			'supplyTower',
			'supply',
		];
		this.objectiveGroup = new ObjectiveGroup(this.objectivePriorities);
		// Priorities for the productionQueue
		this.spawnPriorities = {
			supplier       : 0,
			scout          : 1,
			linker         : 1,
			manager        : 1,
			guard          : 2,
			mineralSupplier: 3,
			miner          : 4,
			hauler         : 5,
			worker         : 6,
			reserver       : 6,
			upgrader       : 7,
		};
		// Set up production queue in memory so we can inspect it easily
		this.memory.productionQueue = {}; // cleared every tick; only in memory for inspection purposes
		this.productionQueue = this.memory.productionQueue; // reference this outside of memory for typing purposes
		this.settings = {
			refillTowersBelow      : 500,
			linksRequestEnergyBelow: 0,
		};
	}

	get supplier(): ICreep {
		if (!this._supplier) {
			this._supplier = this.colony.getCreepsByRole('supplier')[0];
		}
		return this._supplier;
	}

	get uptime(): number { // TODO
		// Calculate the approximate rolling average uptime
		return 0;
	}

	get energySpentInLastLifetime(): number { // TODO
		// Energy spent making creeps over the last 1500 ticks
		return 0;
	}

	// Objective management ============================================================================================

	/* Request more energy when appropriate either via link or hauler */
	private registerEnergyRequests(): void {
		if (this.link) {
			if (this.link.isEmpty) {
				this.overlord.resourceRequests.registerResourceRequest(this.link);
			}
		} else {
			if (this.battery && this.battery.energy < 0.25 * this.battery.storeCapacity) {
				this.overlord.resourceRequests.registerResourceRequest(this.battery);
			}
		}
	}

	private registerObjectives(): void {
		// Supply all of the hatchery components with energy
		let supplySpawns = _.filter(this.spawns, spawn => !spawn.isFull);
		let supplySpawnObjectives = _.map(supplySpawns, spawn => new ObjectiveSupply(spawn));
		let supplyExtensions = _.filter(this.extensions, extension => !extension.isFull);
		let supplyExtensionObjectives = _.map(supplyExtensions, extension => new ObjectiveSupply(extension));
		let supplyTowers: Tower[];
		if (supplySpawnObjectives.length + supplyExtensionObjectives.length > 0) {
			// If there are other things to do, don't worry about filling towers to completely full levels
			supplyTowers = _.filter(this.towers, tower => tower.energy < this.settings.refillTowersBelow);
		} else {
			// If nothing else to do, go ahead and fill up towers
			supplyTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
		}
		let supplyTowerObjectives = _.map(supplyTowers, tower => new ObjectiveSupplyTower(tower));
		// Register the objectives in the objectiveGroup
		this.objectiveGroup.registerObjectives(supplySpawnObjectives, supplyExtensionObjectives, supplyTowerObjectives);
	}


	// Creep queueing and spawning =====================================================================================

	private generateCreepName(roleName: string): string {
		// generate a creep name based on the role and add a suffix to make it unique
		let i = 0;
		while (Game.creeps[(roleName + '_' + i)]) {
			i++;
		}
		return (roleName + '_' + i);
	};

	private createCreep(protoCreep: protoCreep): number {
		let spawnToUse = this.availableSpawns.shift(); // get a spawn to use
		if (spawnToUse) { // if there is a spawn, create the creep
			protoCreep.name = this.generateCreepName(protoCreep.name); // modify the creep name to make it unique
			let result = spawnToUse.createCreep(protoCreep.body, protoCreep.name, protoCreep.memory);
			if (result == OK) {
				return result;
			} else {
				this.availableSpawns.unshift(spawnToUse); // return the spawn to the available spawns list
				return result;
			}
		} else { // otherwise, return busy
			return ERR_BUSY;
		}
	}

	enqueue(protoCreep: protoCreep): void {
		let roleName = protoCreep.name; // This depends on creeps being named for their roles (before generateCreepName)
		let priority = this.spawnPriorities[roleName];
		if (priority == undefined) {
			priority = 1000; // some large but finite priority for all the remaining stuff to make
		}
		if (!this.productionQueue[priority]) {
			this.productionQueue[priority] = [];
		}
		this.productionQueue[priority].push(protoCreep);
	}

	private spawnHighestPriorityCreep(): number | void {
		let priorities: number[] = _.map(Object.keys(this.productionQueue), key => parseInt(key, 10)).sort();
		for (let priority of priorities) {
			let protocreep = this.productionQueue[priority].shift();
			if (protocreep) {
				let result = this.createCreep(protocreep);
				if (result == OK) {
					return result;
				} else {
					this.productionQueue[priority].unshift(protocreep);
					return result;
				}
			}
		}
	}

	private spawnEmergencySupplier(): number {
		let emergencySupplier = new SupplierSetup().create(this.colony, {
			assignment            : this.room.controller,
			patternRepetitionLimit: 1
		});
		let result = this.createCreep(emergencySupplier);
		if (result != OK) {
			this.log('Cannot create emergency supplier: ', result);
		}
		return result;
	}

	// Idle position for suppliers =====================================================================================

	get idlePos(): RoomPosition {
		if (this.memory.idlePos && Game.time % 100 != 0) {
			let memPos = this.memory.idlePos;
			this._idlePos = new RoomPosition(memPos.x, memPos.y, memPos.roomName);
		} else {
			this._idlePos = this.findIdlePos();
			this.memory.idlePos = this._idlePos;
		}
		return this._idlePos;
	}

	/* Find the best position for suppliers to idle at */
	private findIdlePos(): RoomPosition {
		let possiblePositions = this.spawns[0].pos.getAdjacentPositions();
		let proximateStructures = [
			this.spawns[1],
			this.spawns[2],
			this.link,
			this.battery,
		];
		for (let structure of proximateStructures) {
			if (structure) {
				let filteredPositions = _.filter(possiblePositions, p => p.isNearTo(structure) &&
																		 !p.isEqualTo(structure));
				if (filteredPositions.length == 0) { // stop when it's impossible to match any more structures
					return possiblePositions[0];
				} else {
					possiblePositions = filteredPositions;
				}
			}
		}
		return possiblePositions[0];
	}

	private handleSuppliers(): void {
		// Handle the supplier
		let supplier = this.supplier;
		if (!supplier) {
			return;
		}
		// Try to ensure the supplier has something to do
		supplier.assertValidTask();
		// If there aren't any tasks that need to be done, recharge the battery from link
		if (supplier.isIdle) {
			if (this.battery && this.link) { // is there a battery and a link?
				// Can energy be moved from the link to the battery?
				if (!this.battery.isFull && !this.link.isEmpty) { 	// move energy to battery
					if (supplier.carry.energy < supplier.carryCapacity) {
						supplier.task = new TaskWithdraw(this.link);
					} else {
						supplier.task = new TaskDeposit(this.battery);
					}
				} else {
					if (supplier.carry.energy < supplier.carryCapacity) { // make sure you're recharged
						supplier.task = new TaskWithdraw(this.link);
					}
				}
			}
		}
		// If all of the above is done, move to the idle point
		if (supplier.isIdle && !supplier.pos.isEqualTo(this.idlePos)) {
			supplier.travelTo(this.idlePos);
		}
	}

	private handleSpawns(): void {
		// See if an emergency supplier needs to be spawned
		let numSuppliers = this.colony.getCreepsByRole('supplier').length;
		let supplierSize = this.overlord.settings.supplierPatternRepetitionLimit;
		// Emergency suppliers spawn when numSuppliers = 0 and when there isn't enough energy to spawn new supplier
		if (numSuppliers == 0 && supplierSize * (new SupplierSetup().bodyPatternCost) > this.room.energyAvailable) {
			this.spawnEmergencySupplier();
		}
		// Spawn all queued creeps that you can
		while (this.availableSpawns.length > 0) {
			if (this.spawnHighestPriorityCreep() != OK) {
				break;
			}
		}
	}

	// Runtime operation ===============================================================================================
	init(): void {
		this.registerObjectives();
		this.registerEnergyRequests();
	}

	run(): void {
		this.handleSuppliers();
		this.handleSpawns();
	}
}

