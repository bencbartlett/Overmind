import {log} from '../../console/log';
import {CombatCreepSetup} from '../../creepSetups/CombatCreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveHarass} from '../../directives/offense/harass';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {BOOST_TIERS} from '../../resources/map_resources';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

/**
 * Spawns ranged harassers to stop mining for an enemy room
 */
@profile
export class HarassOverlord extends CombatOverlord {

	hydralisks: CombatZerg[];
	nibblers: CombatZerg[];
	targetRemoteToHarass: string;
	directive: DirectiveHarass;


	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
		prespawn           : 200,
	};

	constructor(directive: DirectiveHarass,
				priority = OverlordPriority.outpostOffense.harass) {
		super(directive, 'harass', priority, 1);
		this.directive = directive;
		this.nibblers = this.combatZerg(Roles.melee);
		this.hydralisks = this.combatZerg(Roles.ranged);
	}

	private handleHarass(hydralisk: CombatZerg): void {
		hydralisk.autoCombat(this.targetRemoteToHarass || hydralisk.room.name);

		// this.chooseRemoteToHarass(hydralisk, hydralisk.room.name);
		if (!this.targetRemoteToHarass) {
			this.chooseRemoteToHarass(hydralisk, hydralisk.room.name);
		}
		if (this.targetRemoteToHarass && hydralisk.room.name != this.targetRemoteToHarass) {
			hydralisk.goToRoom(this.targetRemoteToHarass);
		} else if (hydralisk.room.dangerousHostiles.length > 2) {
			// Time to move on
			// Track when defense spawned
			hydralisk.room.dangerousHostiles.forEach(hostile => {
				const nextSafeSpawn = (Game.time - HarassOverlord.settings.prespawn + (hostile.ticksToLive || 0));
				if (nextSafeSpawn > this.directive.memory.nextSpawnTime) {
					this.directive.memory.nextSpawnTime = nextSafeSpawn;
				}
			});
			if (hydralisk.room.name != this.targetRemoteToHarass) {
				hydralisk.goToRoom(this.targetRemoteToHarass);
			} else {
				const nextRoom = this.chooseRemoteToHarass(hydralisk, hydralisk.room.name);
				if (nextRoom) {
					hydralisk.goToRoom(this.targetRemoteToHarass);
				}
			}
		}
		// Clean up construction sites then move on to another room
	}

	private chooseRemoteToHarass(hydralisk: CombatZerg, currentRoom: string) {
		if (!this.directive.memory.roomsToHarass || this.directive.memory.roomsToHarass.length == 0) {
			this.directive.memory.roomsToHarass = this.directive.findNearbyReservedRoomsForHarassment();
		}
		const nextRoom = this.directive.memory.roomsToHarass.shift();
		if (nextRoom) {
			this.directive.memory.roomsToHarass.push(nextRoom);
			this.targetRemoteToHarass = nextRoom;
			log.debug(`Selecting new target of ${this.targetRemoteToHarass} for ${hydralisk.print} from ` +
					  `${this.directive.memory.roomsToHarass}`);
			hydralisk.say(`Tgt ${this.targetRemoteToHarass}`);
			return nextRoom;
		}
	}

	init() {
		this.reassignIdleCreeps(Roles.ranged);
		this.reassignIdleCreeps(Roles.melee);
		const setup = CombatSetups.hydralisks.default;
		const numtoSpawn = (!this.directive.memory.nextSpawnTime || Game.time >= this.directive.memory.nextSpawnTime) ? 1 : 0;
		this.wishlist(numtoSpawn, setup);
	}

	run() {
		this.autoRun(this.hydralisks, hydralisk => this.handleHarass(hydralisk));
		this.autoRun(this.nibblers, hydralisk => this.handleHarass(hydralisk));
	}
}
