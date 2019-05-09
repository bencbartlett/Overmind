import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveSwarmDestroy} from '../../directives/offense/swarmDestroy';
import {CombatIntel} from '../../intel/CombatIntel';
import {RoomIntel} from '../../intel/RoomIntel';
import {Mem} from '../../memory/Memory';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {Visualizer} from '../../visuals/Visualizer';
import {CombatZerg} from '../../zerg/CombatZerg';
import {Swarm} from '../../zerg/Swarm';
import {SwarmOverlord} from '../SwarmOverlord';

const DEBUG = false;

/**
 * Spawns squads of attackers and healers to siege a hostile room, moving with swarm logic in a coordinated fashion
 */
@profile
export class SwarmDestroyerOverlord extends SwarmOverlord {

	memory: any;
	directive: DirectiveSwarmDestroy;
	fallback: RoomPosition;
	assemblyPoints: RoomPosition[];
	intel: CombatIntel;
	zerglings: CombatZerg[];
	// hydralisks: CombatZerg[];
	healers: CombatZerg[];
	swarms: { [ref: string]: Swarm };

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveSwarmDestroy, priority = OverlordPriority.offense.destroy) {
		super(directive, 'destroy', priority, 8);
		this.directive = directive;
		this.memory = Mem.wrap(this.directive.memory, this.name);
		this.intel = new CombatIntel(this.directive);
		this.zerglings = this.combatZerg(Roles.melee, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.attack[3], boostResources.tough[3], boostResources.move[3]]
		});
		// this.hydralisks = this.combatZerg(Roles.ranged, {
		// 	notifyWhenAttacked: false,
		// 	boostWishlist     : [boostResources.ranged_attack[3], boostResources.tough[3], boostResources.move[3]]
		// });
		this.healers = this.combatZerg(Roles.healer, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.heal[3], boostResources.tough[3], boostResources.move[3],]
		});
		// Make swarms
		this.makeSwarms();
		// Compute fallback positions and assembly points
		this.fallback = $.pos(this, 'fallback', () =>
			this.intel.findSwarmAssemblyPointInColony({width: 2, height: 2}), 200)!;
		this.assemblyPoints = [];
		for (let i = 0; i < _.keys(this.swarms).length + 1; i++) {
			this.assemblyPoints.push($.pos(this, `assemble_${i}`, () =>
				this.intel.findSwarmAssemblyPointInColony({width: 2, height: 2}, i + 1), 200)!);
		}
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, this.name);
		this.makeSwarms();
	}

	makeSwarms(): void {
		this.swarms = {};
		const meleeZerg: CombatZerg[] = [...this.zerglings, ...this.healers];
		// let rangedZerg: CombatZerg[] = this.hydralisks;
		const maxPerSwarm = {[Roles.melee]: 2, [Roles.healer]: 2, [Roles.ranged]: 4};
		const meleeZergBySwarm = _.groupBy(meleeZerg, zerg => zerg.findSwarm(meleeZerg, maxPerSwarm));
		// let rangedZergBySwarm = _.groupBy(rangedZerg, zerg => zerg.findSwarm(rangedZerg, maxPerSwarm));
		// let zergBySwarm = _.merge(meleeZergBySwarm, rangedZergBySwarm);
		for (const ref in meleeZergBySwarm) {
			if (ref != undefined) {
				if (DEBUG) log.debug(`Making swarm for ${_.map(meleeZergBySwarm[ref], z => z.name)}`);
				this.swarms[ref] = new Swarm(this, ref, meleeZergBySwarm[ref]);
			}
		}
		// for (let ref in rangedZergBySwarm) { // todo: finish changing
		// 	if (ref != undefined) {
		// 		if (DEBUG) log.debug(`Making swarm for ${_.map(meleeZergBySwarm[ref], z => z.name)}`);
		// 		this.swarms[ref] = new Swarm(this, ref, meleeZergBySwarm[ref]);
		// 	}
		// }
	}

	private handleSwarm(swarm: Swarm, index: number, waypoint = this.directive.pos) {
		// Swarm initially groups up at fallback location
		if (!swarm.memory.initialAssembly) {
			const assemblyPoint = this.assemblyPoints[index] || this.fallback;
			log.debug(`Assmbling at ${assemblyPoint.print}`);
			swarm.memory.initialAssembly = swarm.assemble(assemblyPoint);
			return;
		}

		// Swarm has now initially assembled with all members present
		// log.debug(`Done assmbling`);

		const room = swarm.rooms[0];
		if (!room) {
			log.warning(`${this.print} No room! (Why?)`);
		}
		// Siege the room
		const nearbyHostiles = _.filter(room.hostiles, creep => swarm.minRangeTo(creep) <= 3 + 1);
		const attack = _.sum(nearbyHostiles, creep => CombatIntel.getAttackDamage(creep));
		const rangedAttack = _.sum(nearbyHostiles, creep => CombatIntel.getRangedAttackDamage(creep));
		const myDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(_.map(swarm.creeps, c => c.creep));

		const canPopShield = (attack + rangedAttack + CombatIntel.towerDamageAtPos(swarm.anchor)) * myDamageMultiplier
							 > _.min(_.map(swarm.creeps, creep => 100 * creep.getActiveBodyparts(TOUGH)));

		if (canPopShield || room.hostileStructures.length == 0 || _.values(this.swarms).length > 1) {
			swarm.autoCombat(this.pos.roomName, waypoint);
		} else {
			swarm.autoSiege(this.pos.roomName, waypoint);
		}
	}

	init() {
		let numSwarms = this.directive.memory.amount || 1;
		if (RoomIntel.inSafeMode(this.pos.roomName)) {
			numSwarms = 0;
		}

		const zerglingPriority = this.zerglings.length <= this.healers.length ? this.priority - 0.1 : this.priority + 0.1;
		const zerglingSetup = this.canBoostSetup(CombatSetups.zerglings.boosted_T3) ? CombatSetups.zerglings.boosted_T3
																					: CombatSetups.zerglings.default;

		const healerPriority = this.healers.length < this.zerglings.length ? this.priority - 0.1 : this.priority + 0.1;
		const healerSetup = this.canBoostSetup(CombatSetups.healers.boosted_T3) ? CombatSetups.healers.boosted_T3
																				: CombatSetups.healers.default;

		const hydraliskPriority = this.healers.length < this.zerglings.length ? this.priority - 0.1 : this.priority + 0.1;
		const hydraliskSetup = this.canBoostSetup(CombatSetups.hydralisks.siege_T3) ? CombatSetups.healers.boosted_T3
																					: CombatSetups.healers.default;

		const swarmConfig = [{setup: zerglingSetup, amount: 2, priority: zerglingPriority},
							 {setup: healerSetup, amount: 2, priority: healerPriority}];
		this.swarmWishlist(numSwarms, swarmConfig);

		// const rangedSwarmConfig = [{setup: hydraliskSetup, amount: 4, priority: hydraliskPriority}];
		// this.swarmWishlist(numSwarms, rangedSwarmConfig);

	}

	run() {
		this.autoRun(this.zerglings, zergling => undefined); // zergling => undefined is to handle boosting
		this.autoRun(this.healers, healer => undefined);
		// this.autoRun(this.hydralisks, hydralisk => undefined);
		// Run swarms in order
		const refs = _.keys(this.swarms).sort();
		let i = 0;
		for (const ref of refs) {
			this.handleSwarm(this.swarms[ref], i);
			i++;
		}
	}

	visuals() {
		Visualizer.marker(this.fallback, {color: 'green'});
		for (const ref in this.swarms) {
			const swarm = this.swarms[ref];
			Visualizer.marker(swarm.anchor, {color: 'blue'});
			if (swarm.target) {
				Visualizer.marker(swarm.target.pos, {color: 'orange'});
			}
		}
	}
}
