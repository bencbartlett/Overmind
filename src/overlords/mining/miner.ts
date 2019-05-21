import {$} from '../../caching/GlobalCache';
import {ColonyStage} from '../../Colony';
import {log} from '../../console/log';
import {bodyCost, CreepSetup} from '../../creepSetups/CreepSetup';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveOutpost} from '../../directives/colony/outpost';
import {DirectiveHarvest} from '../../directives/resource/harvest';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {maxBy, minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

export const StandardMinerSetupCost = bodyCost(Setups.drones.miners.standard.generateBody(Infinity));

export const DoubleMinerSetupCost = bodyCost(Setups.drones.miners.double.generateBody(Infinity));


const BUILD_OUTPUT_FREQUENCY = 15;
const SUICIDE_CHECK_FREQUENCY = 3;
const MINER_SUICIDE_THRESHOLD = 200;

/**
 * Spawns miners to harvest from remote, owned, or sourcekeeper energy deposits. Standard mining actions have been
 * heavily CPU-optimized
 */
@profile
export class MiningOverlord extends Overlord {

	directive: DirectiveHarvest;
	room: Room | undefined;
	source: Source | undefined;
	container: StructureContainer | undefined;
	link: StructureLink | undefined;
	constructionSite: ConstructionSite | undefined;
	harvestPos: RoomPosition | undefined;
	miners: Zerg[];
	energyPerTick: number;
	miningPowerNeeded: number;
	mode: 'early' | 'SK' | 'link' | 'standard' | 'double';
	setup: CreepSetup;
	minersNeeded: number;
	allowDropMining: boolean;

	static settings = {
		minLinkDistance : 10,
		dropMineUntilRCL: 3,
	};

	constructor(directive: DirectiveHarvest, priority: number) {
		super(directive, 'mine', priority);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.miners = this.zerg(Roles.drone);
		// Populate structures
		this.populateStructures();
		// Compute energy output
		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
			this.energyPerTick = SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME;
		} else if (this.colony.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL) {
			this.energyPerTick = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
		} else {
			this.energyPerTick = SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME;
		}
		this.miningPowerNeeded = Math.ceil(this.energyPerTick / HARVEST_POWER) + 1;
		// Decide operating mode
		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
			this.mode = 'SK';
			this.setup = Setups.drones.miners.sourceKeeper;
		} else if (this.colony.room.energyCapacityAvailable < StandardMinerSetupCost) {
			this.mode = 'early';
			this.setup = Setups.drones.miners.default;
		} else if (this.link) {
			this.mode = 'link';
			this.setup = Setups.drones.miners.default;
		} else {
			this.mode = 'standard';
			this.setup = Setups.drones.miners.standard;
			// todo: double miner condition
		}
		const miningPowerEach = this.setup.getBodyPotential(WORK, this.colony);
		this.minersNeeded = Math.min(Math.ceil(this.miningPowerNeeded / miningPowerEach),
									 this.pos.availableNeighbors(true).length);
		// Allow drop mining at low levels
		this.allowDropMining = this.colony.level < MiningOverlord.settings.dropMineUntilRCL;
		if (this.mode != 'early' && !this.allowDropMining) {
			if (this.container) {
				this.harvestPos = this.container.pos;
			} else if (this.link) {
				this.harvestPos = _.find(this.link.pos.availableNeighbors(true),
										 pos => pos.getRangeTo(this) == 1)!;
			} else {
				this.harvestPos = this.calculateContainerPos();
			}
		}
	}

	get distance(): number {
		return this.directive.distance;
	}

	private populateStructures() {
		if (Game.rooms[this.pos.roomName]) {
			this.source = _.first(this.pos.lookFor(LOOK_SOURCES));
			this.constructionSite = _.first(this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2));
			this.container = this.pos.findClosestByLimitedRange(Game.rooms[this.pos.roomName].containers, 1);
			this.link = this.pos.findClosestByLimitedRange(this.colony.availableLinks, 2);
			// if (this.link) { // this won't cause repopulation problems since link rooms are always visible
			// 	this.colony.linkNetwork.claimLink(this.link);
			// }
		}
	}

	refresh() {
		if (!this.room && Game.rooms[this.pos.roomName]) { // if you just gained vision of this room
			this.populateStructures();
		}
		// if (!this.allowDropMining && Game.time % 100 == 0 && !this.container && !this.link) {
		// 	log.warning(`Mining site at ${this.pos.print} has no output!`);
		// }
		super.refresh();
		$.refresh(this, 'source', 'container', 'link', 'constructionSite');
	}

	/**
	 * Calculate where the container output will be built for this site
	 */
	private calculateContainerPos(): RoomPosition {
		// log.debug(`Computing container position for mining overlord at ${this.pos.print}...`);
		let originPos: RoomPosition | undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		}
		if (originPos) {
			const path = Pathing.findShortestPath(this.pos, originPos).path;
			const pos = _.find(path, pos => pos.getRangeTo(this) == 1);
			if (pos) return pos;
		}
		// Shouldn't ever get here
		log.warning(`Last resort container position calculation for ${this.print}!`);
		return _.first(this.pos.availableNeighbors(true));
	}

	/**
	 * Add or remove containers as needed to keep exactly one of contaner | link
	 */
	private addRemoveContainer(): void {
		if (this.allowDropMining) {
			return; // only build containers in reserved, owned, or SK rooms
		}
		// Create container if there is not already one being built and no link
		if (!this.container && !this.constructionSite && !this.link) {
			const containerPos = this.calculateContainerPos();
			const container = containerPos.lookForStructure(STRUCTURE_CONTAINER) as StructureContainer | undefined;
			if (container) {
				log.warning(`${this.print}: this.container out of sync at ${containerPos.print}`);
				this.container = container;
				return;
			}
			log.info(`${this.print}: building container at ${containerPos.print}`);
			const result = containerPos.createConstructionSite(STRUCTURE_CONTAINER);
			if (result != OK) {
				log.error(`${this.print}: cannot build container at ${containerPos.print}! Result: ${result}`);
			}
			return;
		}
		// Destroy container if link is nearby
		if (this.container && this.link) {
			// safety checks
			if (this.colony.hatchery && this.container.pos.getRangeTo(this.colony.hatchery) > 2 &&
				this.container.pos.getRangeTo(this.colony.upgradeSite) > 3) {
				log.info(`${this.print}: container and link present; destroying container at ${this.container.pos.print}`);
				this.container.destroy();
			}
		}
	}

	private registerEnergyRequests(): void {
		if (this.container) {
			const transportCapacity = 200 * this.colony.level;
			const threshold = this.colony.stage > ColonyStage.Larva ? 0.8 : 0.5;
			if (_.sum(this.container.store) > threshold * transportCapacity) {
				this.colony.logisticsNetwork.requestOutput(this.container, {
					resourceType: 'all',
					dAmountdt   : this.energyPerTick
				});
			}
		}
		if (this.link) {
			// If the link will be full with next deposit from the miner
			const minerCapacity = 150;
			if (this.link.energy + minerCapacity > this.link.energyCapacity) {
				this.colony.linkNetwork.requestTransmit(this.link);
			}
		}
	}

	init() {
		this.wishlist(this.minersNeeded, this.setup);
		this.registerEnergyRequests();
	}

	/**
	 * Actions for handling mining at early RCL, when multiple miners and drop mining are used
	 */
	private earlyMiningActions(miner: Zerg) {

		if (miner.room != this.room) {
			return miner.goToRoom(this.pos.roomName);
		}

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.goRepair(this.container);
			} else {
				if (_.sum(miner.carry) < miner.carryCapacity) {
					return miner.goHarvest(this.source!);
				} else {
					return miner.goTransfer(this.container);
				}
			}
		}

		// Build output site
		if (this.constructionSite) {
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.goBuild(this.constructionSite);
			} else {
				return miner.goHarvest(this.source!);
			}
		}

		// Drop mining
		if (this.allowDropMining) {
			miner.goHarvest(this.source!);
			if (miner.carry.energy > 0.8 * miner.carryCapacity) { // try to drop on top of largest drop if full
				const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
				if (biggestDrop) {
					miner.goDrop(biggestDrop.pos, RESOURCE_ENERGY);
				}
			}
			return;
		}
	}

	/**
	 * Suicide outdated miners when their replacements arrive
	 */
	private suicideOldMiners(): boolean {
		if (this.miners.length > this.minersNeeded && this.source) {
			// if you have multiple miners and the source is visible
			const targetPos = this.harvestPos || this.source.pos;
			const minersNearSource = _.filter(this.miners,
											miner => miner.pos.getRangeTo(targetPos) <= SUICIDE_CHECK_FREQUENCY);
			if (minersNearSource.length > this.minersNeeded) {
				// if you have more miners by the source than you need
				const oldestMiner = minBy(minersNearSource, miner => miner.ticksToLive || 9999);
				if (oldestMiner && (oldestMiner.ticksToLive || 9999) < MINER_SUICIDE_THRESHOLD) {
					// if the oldest miner will die sufficiently soon
					oldestMiner.suicide();
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Actions for handling link mining
	 */
	private linkMiningActions(miner: Zerg) {

		// Approach mining site
		if (this.goToMiningSite(miner)) return;

		// Link mining
		if (this.link) {
			miner.harvest(this.source!);
			if (miner.carry.energy > 0.9 * miner.carryCapacity) {
				miner.transfer(this.link, RESOURCE_ENERGY);
			}
			return;
		} else {
			log.warning(`Link miner ${miner.print} has no link!`);
		}
	}

	/**
	 * Actions for handling mining at RCL high enough to spawn ideal miner body to saturate source
	 */
	private standardMiningActions(miner: Zerg) {

		// Approach mining site
		if (this.goToMiningSite(miner)) return;

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.repair(this.container);
			} else {
				return miner.harvest(this.source!);
			}
		}

		// Build output site
		if (this.constructionSite) {
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.build(this.constructionSite);
			} else {
				return miner.harvest(this.source!);
			}
		}

		// Drop mining
		if (this.allowDropMining) {
			miner.harvest(this.source!);
			if (miner.carry.energy > 0.8 * miner.carryCapacity) { // move over the drop when you're close to full
				const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
				if (biggestDrop) {
					miner.goTo(biggestDrop);
				}
			}
			if (miner.carry.energy == miner.carryCapacity) { // drop when you are full
				miner.drop(RESOURCE_ENERGY);
			}
			return;
		}
	}

	/**
	 * Move onto harvesting position or near to source (depending on early/standard mode)
	 */
	private goToMiningSite(miner: Zerg): boolean {
		if (this.harvestPos) {
			if (!miner.pos.inRangeToPos(this.harvestPos, 0)) {
				miner.goTo(this.harvestPos);
				return true;
			}
		} else {
			if (!miner.pos.inRangeToPos(this.pos, 1)) {
				miner.goTo(this);
				return true;
			}
		}
		return false;
	}

	private handleMiner(miner: Zerg) {
		// Flee hostiles
		if (miner.flee(miner.room.fleeDefaults, {dropEnergy: true})) {
			return;
		}

		// Move onto harvesting position or near to source (depending on early/standard mode)
		if (this.mode == 'early' || !this.harvestPos) {
			if (!miner.pos.inRangeToPos(this.pos, 1)) {
				return miner.goTo(this);
			}
		} else {
			if (!miner.pos.inRangeToPos(this.harvestPos, 0)) {
				return miner.goTo(this.harvestPos, {range: 0});
			}
		}

		switch (this.mode) {
			case 'early':
				return this.earlyMiningActions(miner);
			case 'link':
				return this.linkMiningActions(miner);
			case 'standard':
				return this.standardMiningActions(miner);
			case 'SK':
				return this.standardMiningActions(miner);
			case 'double':
				return this.standardMiningActions(miner);
			default:
				log.error(`UNHANDLED MINER STATE FOR ${miner.print} (MODE: ${this.mode})`);
		}

	}

	run() {
		for (const miner of this.miners) {
			this.handleMiner(miner);
		}
		if (this.room && Game.time % BUILD_OUTPUT_FREQUENCY == 1) {
			this.addRemoveContainer();
		}
		if (Game.time % SUICIDE_CHECK_FREQUENCY == 0) {
			this.suicideOldMiners();
		}
	}
}
