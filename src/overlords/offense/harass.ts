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
		console.log(`Matt: hydralisk harassment in ${hydralisk.print}`);
		//this.moveToNearbyRoom(hydralisk, hydralisk.room.name);
		if (!this.nextTarget) {
			this.moveToNearbyRoom(hydralisk, hydralisk.room.name);
		}
		if (this.nextTarget && this.directive.pos.roomName != this.nextTarget) {
			hydralisk.goToRoom(this.nextTarget);
		} else if (hydralisk.room.dangerousPlayerHostiles.length > 2) {
			// Time to move on
			this.moveToNearbyRoom(hydralisk, hydralisk.room.name);
		}
		hydralisk.autoCombat(this.nextTarget || hydralisk.room.name);
		// Clean up construction sites then move on to another room
	}

	moveToNearbyRoom(hydralisk: CombatZerg, currentRoom: string) {
		this.nextTarget = _.sample(this.directive.memory.roomsToHarass);
		if (this.nextTarget) {
			console.log(`Selecting new target of ${this.nextTarget} for ${hydralisk.print}`);
			hydralisk.say(`Tgt ${this.nextTarget}`);
			hydralisk.goToRoom(this.nextTarget);
		} else {
			console.log(`Tried to select new harass target from ${currentRoom} but failed for ${this.directive.print} with list ${this.directive.memory.roomsToHarass}`);
		}
	}

	init() {
		this.reassignIdleCreeps(Roles.ranged);
		const setup = CombatSetups.hydralisks.default;
		this.wishlist(1, setup);
	}

	run() {
		console.log(`Matt: Running directive harass in ${this.directive.print}`);
		this.autoRun(this.hydralisks, hydralisk => this.handleHarass(hydralisk));
	}
}
