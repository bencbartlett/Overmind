// Jump table to instantiate flags based on type

import {DirectiveGuard} from './combat/directive_guard';
import {DirectiveIncubate} from './colonization/directive_incubate';
import {DirectiveOutpost} from './core/directive_outpost';
import {DirectiveBootstrap} from './core/directive_bootstrap';
import {Directive} from './Directive';
import {DirectiveRPHatchery} from './roomPlanner/directive_roomPlanner_hatchery';
import {DirectiveRPCommandCenter} from './roomPlanner/directive_roomPlanner_commandCenter';
import {DirectiveRPUpgradeSite} from './roomPlanner/directive_roomPlanner_upgradeSite';
import {DirectiveRPMiningGroup} from './roomPlanner/directive_roomPlanner_miningGroup';
import {DirectiveColonize} from './colonization/directive_colonize';
import {DirectiveTargetSiege} from './targeting/directive_target_siege';
import {DirectiveSiege} from './combat/directive_siege';
import {DirectiveHealPoint} from './combat/directive_healPoint';
import {DirectiveGuardSwarm} from './combat/directive_guard_swarm';
import {DirectiveLabMineral} from './logistics/directive_labMineralType';
import {DirectiveDestroy} from './combat/directive_destroy';
import {DirectiveInvasionDefense} from './combat/directive_invasion';
import {DirectiveLogisticsRequest} from './logistics/directive_logisticsRequest';
import {DirectiveHaul} from './logistics/directive_haul';
import {DirectiveDismantle} from './targeting/directive_dismantle';
import {DirectiveNukeResponse} from './defense/directive_nukeResponse';

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

		// Combat directives ===========================================================================================
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

		// Combat directives ===========================================================================================

		// Situational directives ======================================================================================
		case COLOR_ORANGE:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveBootstrap(flag);
				case COLOR_RED:
					return new DirectiveInvasionDefense(flag);
				case COLOR_BLUE:
					return new DirectiveNukeResponse(flag);
			}
			break;

		// Logistics directives ========================================================================================
		case COLOR_YELLOW:
			switch (flag.secondaryColor) {
				case COLOR_YELLOW:
					return new DirectiveLogisticsRequest(flag);
				case COLOR_BLUE:
					return new DirectiveHaul(flag);
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
				case COLOR_YELLOW:
					return new DirectiveDismantle(flag);
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
