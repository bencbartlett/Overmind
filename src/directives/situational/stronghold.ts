import {log} from '../../console/log';
import {StrongholdOverlord} from '../../overlords/situational/stronghold';
import {profile} from '../../profiler/decorator';
import {getCacheExpiration} from '../../utilities/utils';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';
import {DirectiveHaul} from '../resource/haul';
import {DirectiveModularDismantle} from '../targeting/modularDismantle';
import {DirectiveNukeTarget} from './nukeTarget';


export const STRONGHOLD_SETUPS = {
	5: 9, // L5 is 1 fortifier, 8 of [1 fortifier, 7 melee, 9 rangers] 17
	4: 4, // L4 is 4 of [1 fortifier, 3 rangers, 4 melee] 8
	3: 2, // L3 is 2 25A melee creeps
	2: 1,
	1: 0,
};


interface DirectiveStrongholdMemory extends FlagMemory {
	/*
		0: Init
		1: Assault is launched
		2: Assault final stage - attacking core
		3: No more attackers are needed
		4: Core is dead, cleanup
		5: hauling picking is complete
	 */
	state: number;
	strongholdLevel: number;
	// target : {
	// 	id?:
	// 	ref : string,
	// 	_pos: string,
	// }
	// targetId?: string;
	// attackingPosition?: string;
	totalResources?: number;
	waveCount: number; // Count each attempt, if it fails after 6 attempts stop trying
}


/**
 * Stronghold directive contributed by @Davaned
 */
@profile
export class DirectiveStronghold extends Directive {

	static directiveName = 'stronghold';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_PURPLE;
	static requiredRCL = 7;
	private _core: StructureInvaderCore | undefined;

	memory: DirectiveStrongholdMemory;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectiveStronghold.requiredRCL);
		this.memory.state = this.memory.state || 0;
		if (this.core) {
			this.memory.strongholdLevel = this.core.level;
		}
		this.memory.waveCount = this.memory.waveCount || 0;
	}

	spawnMoarOverlords() {
		// this.overlords.strongholdKiller = new StrongholdOverlord(this);
		if (this.memory.state < 3) {
			// this.overlords.haul = new PowerDrillOverlord(this);
		}
		if (this.memory.state > 0 && this.memory.state <= 4) {
			this.overlords.strongholdKiller = new StrongholdOverlord(this);
		}
	}

	get core(): StructureInvaderCore | undefined {
		if (this.room) {
			return <StructureInvaderCore>this._core || this.room.find(FIND_HOSTILE_STRUCTURES)
														   .filter(struct => struct.structureType == STRUCTURE_INVADER_CORE)[0];
		}
	}

	getResourcePickupLocations() {
		if (this.room) {
			let returns: (StructureContainer | Ruin)[] = [];
			const containers = this.room.containers;
			const ruins = this.room.ruins;
			if (containers) {
				returns = returns.concat(containers.filter(container =>
															   container.pos.getRangeTo(this.pos) < 5 && _.sum(container.store) > 0));
			}
			if (ruins) {
				returns = returns.concat(ruins.filter(ruin => ruin.pos.getRangeTo(this.pos) <= 3 && _.sum(ruin.store) > 0));
			}
			return returns;
		}
	}

	manageState() {
		const currentState = this.memory.state;

		if (this.core && this.core.level == 5) {
			// this.handleL5();
		}

		// Starting
		if (this.room && this.core && currentState == 0) {
			// Time to start
			if (!this.core.ticksToDeploy || this.core.ticksToDeploy < 150) {
				this.memory.state = 1;
			}
		} else if (this.room && this.memory.state == 0) {


		} else if (this.pos.isVisible && !this.core && this.pos.lookFor(LOOK_RUINS).length > 0) {
			this.memory.state = 4;
			if (Game.time % 50 == 0) {
				// log.notify(`Now looting stronghold ${this.print} in ${this.pos.roomName}`);
				this.handleLooting();
			}
		} else if (this.pos.isVisible && !this.core && this.pos.lookFor(LOOK_RUINS).length == 0) {
			// Stronghold is dead
			this.remove();
		}
	}


	handleLooting() {
		const lootSpots = this.getResourcePickupLocations();
		if (lootSpots && lootSpots.length > 0) {
			lootSpots.forEach(spot => {
				const isRamparted = spot.pos.lookFor(LOOK_STRUCTURES)
										.filter(struct => struct.structureType == STRUCTURE_RAMPART).length > 0;
				if (isRamparted) {
					DirectiveModularDismantle.createIfNotPresent(spot.pos, 'pos');
				} else {
					DirectiveHaul.createIfNotPresent(spot.pos, 'pos');
				}
			});

			const openingToCore = this.pos.getPositionAtDirection(TOP);
			const isRamparted = openingToCore.lookFor(LOOK_STRUCTURES)
											 .filter(struct => struct.structureType == STRUCTURE_RAMPART).length > 0;
			if (isRamparted) {
				DirectiveModularDismantle.createIfNotPresent(openingToCore, 'pos');
			}
		}
	}

	checkStrongholdUnitComposition(defenders: Creep[]) {

	}

	handleL5() {
		// Well this, this is an L5. Can't deal with it now so just nuke it's ugly mug
		// Wait for deploy
		if (!this.pos.isVisible || !this.core || Game.time % 5 != 0) {
			return;
		}
		if (this.core.ticksToDeploy) {
			log.info(`Stronghold is still deploying! ${this.print}`);
			return;
		}
		// const remainingDuration = this.core.effects.find(effect => effect.effect == EFFECT_COLLAPSE_TIMER);
		const ramparts = this.core.room.ramparts;
		if (ramparts.length == 0 || ramparts[0].ticksToDecay < NUKE_LAND_TIME + 10000) {
			log.info(`Stronghold decaying too soon! ${this.print}`);
			return;
		}
		// if (remainingDuration != undefined && remainingDuration.ticksRemaining < NUKE_LAND_TIME + 10000) {
		// 	// It's too late, don't nuke
		// 	log.info(`Stronghold decaying too soon at ${remainingDuration.ticksRemaining}! ${this.print}`);
		// 	return;
		// }

		const bestTarget = this.pos.getPositionAtDirection(TOP_RIGHT);
		const nukes = this.core.room.find(FIND_NUKES);
		const nukesPrepped = DirectiveNukeTarget.isPresent(this.core.room.name);
		if (nukes.length < 2 && !nukesPrepped) {
			log.alert(`Nuking Stronghold! ${this.print}`);
			const res1 = DirectiveNukeTarget.create(bestTarget, {memory: {maxLinearRange: 10, pathNotRequired: true}});
			const res2 = DirectiveNukeTarget.create(bestTarget, {memory: {maxLinearRange: 10, pathNotRequired: true}});
			return res1 == OK && res2 == OK;
		} else {
			const strongholdDefenders = this.core.pos.findInRange(FIND_HOSTILE_CREEPS, 4);
			const reinforcers = strongholdDefenders.filter(creep =>
															   creep.body.find(bodyPart => bodyPart.type == WORK) != undefined);
			if (reinforcers.length >= nukes.length - 1) {
				log.alert(`Launching additional nuke against Stronghold with reinforcers ${reinforcers.length}! ${this.print}`);
				return DirectiveNukeTarget.create(bestTarget, {memory: {maxLinearRange: 11, pathNotRequired: true}});
			}
		}
	}

	manageDirectives() {

	}

	lootPositions() {
		this.pos.findInRange(FIND_STRUCTURES, 4);
	}

	init(): void {
		let alert;
		alert = `Stronghold ${this.memory.strongholdLevel} is state ${this.memory.state}`;
		this.alert(alert);
	}

	run(): void {
		// Check frequently when almost mined and occasionally otherwise
		if (this.colony.commandCenter && this.colony.commandCenter.observer) {
			this.colony.commandCenter.requestRoomObservation(this.pos.roomName);
		}


		const duration = Game.time - (this.memory[MEM.TICK] || Game.time);
		if (duration % 50000 == 0) {
			log.notify(`DirectiveStronghold ${this.print} in ${this.pos.roomName} has been active for ${duration} ticks`);
		}

		this.manageState();
	}
}

