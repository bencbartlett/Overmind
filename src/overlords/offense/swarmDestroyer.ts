// Destroyer overlord - spawns attacker/healer pairs for sustained combat

import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatIntel} from '../../intel/CombatIntel';
import {boostResources} from '../../resources/map_resources';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {CombatOverlord} from '../CombatOverlord';
import {DirectiveSwarmDestroy} from '../../directives/offense/swarmDestroy';
import {Swarm} from '../../zerg/Swarm';
import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {Visualizer} from '../../visuals/Visualizer';
import {Mem} from '../../memory/Memory';

@profile
export class SwarmDestroyerOverlord extends CombatOverlord {

	memory: any;
	directive: DirectiveSwarmDestroy;
	intel: CombatIntel;
	zerglings: CombatZerg[];
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
		this.healers = this.combatZerg(Roles.healer, {
			notifyWhenAttacked: false,
			boostWishlist     : [boostResources.heal[3], boostResources.tough[3], boostResources.move[3],]
		});
		this.makeSwarms();
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, this.name);
		this.makeSwarms();
	}

	get fallback(): RoomPosition {
		return $.pos(this, 'fallback', () => this.intel.findSimpleSiegeFallback())!;
	}

	private makeSwarms(): void {
		log.debug(`Making swarms`);
		this.swarms = {};
		let allZerg: CombatZerg[] = [...this.zerglings, ...this.healers];
		log.debug(`allZerg: ${_.map(allZerg, zerg => zerg.name)}`);
		let maxPerSwarm = {[Roles.melee]: 2, [Roles.healer]: 2};
		let zergBySwarm = _.groupBy(allZerg, zerg => zerg.findSwarm(allZerg, maxPerSwarm));
		for (let ref in zergBySwarm) {
			log.debug(`Swarm ref: ${ref}`);
			if (ref != undefined) {
				log.debug(`Making swarm for ${_.map(zergBySwarm[ref], z => z.name)}`);
				this.swarms[ref] = new Swarm(this, ref, zergBySwarm[ref]);
			}
		}
	}

	private handleSwarm(swarm: Swarm) {
		// Swarm initially groups up at fallback location
		if (!swarm.memory.initialAssembly) {
			log.debug(`Assmbling at ${this.fallback.print}`);
			swarm.memory.initialAssembly = swarm.assemble(this.fallback);
			return;
		}

		// Swarm has now initially assembled with all members present
		// log.debug(`Done assmbling`);

		// Siege the room
		swarm.autoSiege(this.pos.roomName);
	}

	init() {
		const numSwarms = 1;
		let zerglingPriority = this.zerglings.length < this.healers.length ? this.priority - 0.1 : this.priority + 0.1;
		let zerglingSetup = this.canBoostSetup(CombatSetups.zerglings.boosted_T3) ? CombatSetups.zerglings.boosted_T3
																				  : CombatSetups.zerglings.default;
		this.wishlist(2 * numSwarms, zerglingSetup, {priority: zerglingPriority});

		let healerPriority = this.healers.length < this.zerglings.length ? this.priority - 0.1 : this.priority + 0.1;
		let healerSetup = this.canBoostSetup(CombatSetups.healers.boosted_T3) ? CombatSetups.healers.boosted_T3
																			  : CombatSetups.healers.default;
		this.wishlist(2 * numSwarms, healerSetup, {priority: healerPriority});
	}

	run() {
		this.autoRun(this.zerglings, zergling => undefined); // handle boosting
		this.autoRun(this.healers, healer => undefined);
		for (let ref in this.swarms) {
			this.handleSwarm(this.swarms[ref]);
		}
	}

	visuals() {
		Visualizer.marker(this.fallback, {color: 'green'});
		for (let ref in this.swarms) {
			const swarm = this.swarms[ref];
			Visualizer.marker(swarm.anchor, {color: 'blue'});
			if (swarm.target) {
				Visualizer.marker(swarm.target.pos, {color: 'orange'});
			}
		}
	}
}
