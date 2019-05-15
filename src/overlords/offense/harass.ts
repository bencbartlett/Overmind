import {CreepSetup} from '../../creepSetups/CreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {CombatIntel} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';
import {DirectiveHarass} from "../../directives/offense/harass";
import {log} from "../../console/log";

/**
 * Spawns ranged harassers to stop mining for an enemy room
 */
@profile
export class HarassOverlord extends CombatOverlord {

	hydralisks: CombatZerg[];
	room: Room;
	targetRemoteToHarass: string;
	directive: DirectiveHarass;


	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveHarass,
				boosted  = false,
				priority = OverlordPriority.offense.harass) {
		super(directive, 'harass', priority, 1);
		this.directive = directive;
		this.hydralisks = this.combatZerg(Roles.ranged, {
			boostWishlist: boosted ? [boostResources.ranged_attack[3], boostResources.heal[3], boostResources.move[3]]
								   : undefined
		});
	}

	private handleHarass(hydralisk: CombatZerg): void {
		hydralisk.autoCombat(this.targetRemoteToHarass || hydralisk.room.name);

		//this.chooseRemoteToHarass(hydralisk, hydralisk.room.name);
		if (!this.targetRemoteToHarass) {
			this.chooseRemoteToHarass(hydralisk, hydralisk.room.name);
		}
		if (this.targetRemoteToHarass && hydralisk.room.name != this.targetRemoteToHarass) {
			hydralisk.goToRoom(this.targetRemoteToHarass);
		} else if (hydralisk.room.dangerousPlayerHostiles.length > 2) {
			// Time to move on
			this.chooseRemoteToHarass(hydralisk, hydralisk.room.name);
		}
		// Clean up construction sites then move on to another room
	}

	chooseRemoteToHarass(hydralisk: CombatZerg, currentRoom: string) {
		if (!this.directive.memory.roomsToHarass || this.directive.memory.roomsToHarass.length == 0) {
			this.directive.memory.roomsToHarass = this.directive.findNearbyReservedRoomsForHarassment();
		}
		let nextRoom = this.directive.memory.roomsToHarass.shift();
		if (nextRoom) {
			this.directive.memory.roomsToHarass.push(nextRoom);
			this.targetRemoteToHarass = nextRoom;
			log.debug(`Selecting new target of ${this.targetRemoteToHarass} for ${hydralisk.print} from ${this.directive.memory.roomsToHarass}`);
			hydralisk.say(`Tgt ${this.targetRemoteToHarass}`);
			hydralisk.goToRoom(this.targetRemoteToHarass);
		}
	}

	init() {
		this.reassignIdleCreeps(Roles.ranged);
		const setup = CombatSetups.hydralisks.default;
		this.wishlist(1, setup);
	}

	run() {
		this.autoRun(this.hydralisks, hydralisk => this.handleHarass(hydralisk));
	}
}
