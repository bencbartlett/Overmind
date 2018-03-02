// Jump table to instantiate flags based on type

import {DirectiveGuard} from '../directives/combat/directive_guard';
import {DirectiveIncubate} from '../directives/colonization/directive_incubate';
import {DirectiveOutpost} from '../directives/core/directive_outpost';
import {DirectiveBootstrap} from '../directives/core/directive_bootstrap';
import {Directive} from '../directives/Directive';
import {DirectiveRPHatchery} from '../directives/roomPlanner/directive_roomPlanner_hatchery';
import {DirectiveRPCommandCenter} from '../directives/roomPlanner/directive_roomPlanner_commandCenter';
import {DirectiveRPUpgradeSite} from '../directives/roomPlanner/directive_roomPlanner_upgradeSite';
import {DirectiveRPMiningGroup} from '../directives/roomPlanner/directive_roomPlanner_miningGroup';
import {DirectiveColonize} from '../directives/colonization/directive_colonize';
import {DirectiveTargetSiege} from '../directives/targeting/directive_target_siege';
import {DirectiveSiege} from '../directives/combat/directive_siege';
import {DirectiveHealPoint} from '../directives/combat/directive_healPoint';
import {DirectiveGuardSwarm} from '../directives/combat/directive_guard_swarm';
import {DirectiveLabMineral} from '../directives/labs/directive_labMineralType';
import {DirectiveDestroy} from '../directives/combat/directive_destroy';

export function DirectiveWrapper(flag: Flag): Directive | undefined {
	switch (flag.color) {

		// Colony directives ===========================================================================================
		case COLOR_PURPLE:
			switch (flag.secondaryColor) {
				case COLOR_PURPLE:
					return new DirectiveOutpost(flag);
				case COLOR_WHITE:
					return new DirectiveIncubate(flag);
				case COLOR_GREY:
					return new DirectiveColonize(flag);
			}
			break;

		// Military directives =========================================================================================
		case COLOR_RED:
			switch (flag.secondaryColor) {
				case COLOR_BLUE:
					return new DirectiveGuard(flag);
				case COLOR_PURPLE:
					return new DirectiveGuardSwarm(flag);
				case COLOR_ORANGE:
					return new DirectiveSiege(flag);
				case COLOR_GREEN:
					return new DirectiveHealPoint(flag);
				case COLOR_CYAN:
					return new DirectiveDestroy(flag);
			}
			break;

		// Operation directives ========================================================================================
		case COLOR_ORANGE:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveBootstrap(flag);
			}
			break;

		// Energy directives ===========================================================================================
		case COLOR_YELLOW:
			switch (flag.secondaryColor) {

			}
			break;

		// Lab directives ==============================================================================================
		case COLOR_CYAN:
			switch (flag.secondaryColor) {
				case COLOR_CYAN:
					return new DirectiveLabMineral(flag);
			}
			break;

		// Targeting colors ============================================================================================
		case COLOR_GREY:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveTargetSiege(flag);
			}
			break;

		// Room planning directives ====================================================================================
		case COLOR_WHITE:
			switch (flag.secondaryColor) {
				case COLOR_GREEN:
					return new DirectiveRPHatchery(flag);
				case COLOR_BLUE:
					return new DirectiveRPCommandCenter(flag);
				case COLOR_PURPLE:
					return new DirectiveRPUpgradeSite(flag);
				case COLOR_YELLOW:
					return new DirectiveRPMiningGroup(flag);
				case COLOR_WHITE:
					break; // Reserved for road routing hints
			}
			break;

	}
}




