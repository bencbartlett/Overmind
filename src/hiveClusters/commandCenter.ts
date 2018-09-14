// Command center: groups many RCL8 components, storge, lab, terminal, and some towers

import {HiveCluster} from './_HiveCluster';
import {profile} from '../profiler/decorator';
import {CommandCenterOverlord} from '../overlords/core/manager';
import {Colony} from '../Colony';
import {Mem} from '../memory/Memory';
import {TerminalNetwork} from '../logistics/TerminalNetwork';
import {Energetics} from '../logistics/Energetics';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {Priority} from '../priorities/priorities';
import {Cartographer} from '../utilities/Cartographer';
import {$} from '../caching/GlobalCache';

export const MAX_OBSERVE_DISTANCE = 7;

interface CommandCenterMemory {
	idlePos?: protoPos
}

@profile
export class CommandCenter extends HiveCluster {
	memory: CommandCenterMemory;
	storage: StructureStorage;								// The colony storage, also the instantiation object
	link: StructureLink | undefined;						// Link closest to storage
	terminal: StructureTerminal | undefined;				// The colony terminal
	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
	towers: StructureTower[];								// Towers within range 3 of storage are part of cmdCenter
	powerSpawn: StructurePowerSpawn | undefined;			// Colony Power Spawn
	nuker: StructureNuker | undefined;						// Colony nuker
	observer: StructureObserver | undefined;				// Colony observer
	transportRequests: TransportRequestGroup;				// Box for energy requests
	private _idlePos: RoomPosition;							// Cached idle position

	static settings = {
		linksTransmitAt  : LINK_CAPACITY - 100,
		refillTowersBelow: 750,
	};

	constructor(colony: Colony, storage: StructureStorage) {
		super(colony, storage, 'commandCenter');
		this.memory = Mem.wrap(this.colony.memory, 'commandCenter');
		// Register physical components
		this.storage = storage;
		this.terminal = colony.terminal;
		this.powerSpawn = colony.powerSpawn;
		this.nuker = colony.nuker;
		this.observer = colony.observer;
		if (this.colony.bunker) {
			this.link = this.colony.bunker.anchor.findClosestByLimitedRange(colony.availableLinks, 1);
			this.colony.linkNetwork.claimLink(this.link);
			this.towers = this.colony.bunker.anchor.findInRange(colony.towers, 1);
		} else {
			this.link = this.pos.findClosestByLimitedRange(colony.availableLinks, 2);
			this.colony.linkNetwork.claimLink(this.link);
			this.towers = this.pos.findInRange(colony.towers, 3);
		}
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.transportRequests = new TransportRequestGroup(); // commandCenter always gets its own request group
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'commandCenter');
		$.refreshRoom(this);
		$.refresh(this, 'storage', 'terminal', 'powerSpawn', 'nuker', 'observer', 'link', 'towers');
		this.transportRequests.refresh();
	}

	spawnMoarOverlords() {
		if (this.link || this.terminal) {
			this.overlord = new CommandCenterOverlord(this);
		}
	}

	// Idle position
	get idlePos(): RoomPosition {
		if (this.colony.bunker) {
			return this.colony.bunker.anchor;
		}
		if (!this.memory.idlePos || Game.time % 25 == 0) {
			this.memory.idlePos = this.findIdlePos();
		}
		return derefRoomPosition(this.memory.idlePos);
	}

	/* Find the best idle position */
	private findIdlePos(): RoomPosition {
		// Try to match as many other structures as possible
		let proximateStructures: Structure[] = _.compact([this.link!,
														  this.terminal!,
														  this.powerSpawn!,
														  this.nuker!,
														  ...this.towers]);
		let numNearbyStructures = (pos: RoomPosition) =>
			_.filter(proximateStructures, s => s.pos.isNearTo(pos) && !s.pos.isEqualTo(pos)).length;
		return _.last(_.sortBy(this.storage.pos.neighbors, pos => numNearbyStructures(pos)));
	}

	/* Register a link transfer store if the link is sufficiently full */
	private registerLinkTransferRequests(): void {
		if (this.link) {
			if (this.link.energy > CommandCenter.settings.linksTransmitAt) {
				this.colony.linkNetwork.requestTransmit(this.link);
			}
		}
	}

	private registerRequests(): void {

		// Supply requests:

		// If the link is empty and can send energy and something needs energy, fill it up
		if (this.link && this.link.energy < 0.9 * this.link.energyCapacity && this.link.cooldown <= 1) {
			if (this.colony.linkNetwork.receive.length > 0) { 	// If something wants energy
				this.transportRequests.requestInput(this.link, Priority.Critical);
			}
		}
		// Refill towers as needed with variable priority
		let refillTowers = _.filter(this.towers, tower => tower.energy < CommandCenter.settings.refillTowersBelow);
		_.forEach(refillTowers, tower => this.transportRequests.requestInput(tower, Priority.High));
		// Refill terminal if it is below threshold
		if (this.terminal && this.terminal.energy < Energetics.settings.terminal.energy.inThreshold) {
			this.transportRequests.requestInput(this.terminal, Priority.NormalHigh);
		}
		// Refill core spawn (only applicable to bunker layouts)
		if (this.colony.bunker && this.colony.bunker.coreSpawn) {
			if (this.colony.bunker.coreSpawn.energy < this.colony.bunker.coreSpawn.energyCapacity) {
				this.transportRequests.requestInput(this.colony.bunker.coreSpawn, Priority.Normal);
			}
		}
		// Refill power spawn
		if (this.powerSpawn && this.powerSpawn.energy < this.powerSpawn.energyCapacity) {
			this.transportRequests.requestInput(this.powerSpawn, Priority.NormalLow);
		}
		// Refill nuker with low priority
		if (this.nuker && this.nuker.energy < this.nuker.energyCapacity && this.storage.energy > 100000) {
			this.transportRequests.requestInput(this.nuker, Priority.Low);
		}

		// Withdraw requests:

		// If the link has energy and nothing needs it, empty it
		if (this.link && this.link.energy > 0) {
			if (this.colony.linkNetwork.receive.length == 0 || this.link.cooldown > 3) {
				this.transportRequests.requestOutput(this.link, Priority.High);
			}
		}
	}

	private runObserver(): void {
		if (this.observer) {
			let dx = Game.time % MAX_OBSERVE_DISTANCE;
			let dy = Game.time % (MAX_OBSERVE_DISTANCE ** 2);
			let roomToObserve = Cartographer.findRelativeRoomName(this.pos.roomName, dx, dy);
			this.observer.observeRoom(roomToObserve);
		}
	}

	// Initialization and operation ====================================================================================

	init(): void {
		this.registerLinkTransferRequests();
		this.registerRequests();
	}

	run(): void {
		// this.runObserver();
	}

	visuals() {
		// let info = [
		// 	`Energy: ${Math.floor(this.storage.store[RESOURCE_ENERGY] / 1000)} K`,
		// ];
		// Visualizer.showInfo(info, this);
	}
}

