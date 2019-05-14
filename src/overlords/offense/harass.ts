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

/**
 * Spawns ranged harassers to stop mining for an enemy room
 */
@profile
export class HarassOverlord extends CombatOverlord {

	hydralisks: CombatZerg[];
	room: Room;
	nextTarget: string;
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
		if (this.nextTarget && this.room.name != this.nextTarget) {
			hydralisk.goToRoom(this.nextTarget);
		} else if (hydralisk.room.dangerousPlayerHostiles.length > 2) {
			// Time to move on
			this.moveToNearbyRoom(hydralisk, hydralisk.room.name);
		}
		hydralisk.autoCombat(this.room.name);
		// Clean up infra then move on to another room
	}

	moveToNearbyRoom(hydralisk: CombatZerg, currentRoom: string) {
		this.nextTarget = _.sample(this.directive.memory.roomsToHarass);
		hydralisk.goToRoom(this.nextTarget);
	}

	init() {
		this.reassignIdleCreeps(Roles.ranged);
		const setup = CombatSetups.hydralisks.default;
		this.wishlist(1, setup);
	}

	run() {
		console.log(`Matt: Running directive harass in ${this.room.print}`);
		this.autoRun(this.hydralisks, hydralisk => this.handleHarass(hydralisk));
	}
}
