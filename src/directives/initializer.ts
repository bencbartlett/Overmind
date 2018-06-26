// Jump table to instantiate flags based on type

import {DirectiveGuard} from './defense/guard';
import {DirectiveIncubate} from './colonization/incubate';
import {DirectiveOutpost} from './core/outpost';
import {DirectiveBootstrap} from './core/bootstrap';
import {Directive} from './Directive';
import {DirectiveRPHatchery} from './roomPlanner/roomPlanner_hatchery';
import {DirectiveRPCommandCenter} from './roomPlanner/roomPlanner_commandCenter';
import {DirectiveColonize} from './colonization/colonize';
import {DirectiveTargetSiege} from './targeting/siegeTarget';
import {DirectiveSiege} from './offense/siege';
import {DirectiveHealPoint} from './offense/healPoint';
import {DirectiveGuardSwarm} from './defense/guardSwarm';
import {DirectiveDestroy} from './offense/destroy';
import {DirectiveInvasionDefense} from './defense/invasionDefense';
// import {DirectivePickup} from './logistics/logisticsRequest';
import {DirectiveHaul} from './logistics/haul';
import {DirectiveDismantle} from './targeting/dismantle';
import {DirectiveNukeResponse} from './defense/nukeResponse';
import {DirectiveTerminalEmergencyState} from './logistics/terminalState_emergency';
import {DirectiveRPBunker} from './roomPlanner/roomPlanner_bunker';
import {DirectiveTerminalRebuildState} from './logistics/terminalState_rebuild';
import {DirectiveTerminalEvacuateState} from './logistics/terminalState_evacuate';

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
				case COLOR_BLUE:
					return new DirectiveHaul(flag);
				case COLOR_ORANGE:
					return new DirectiveTerminalEmergencyState(flag);
				case COLOR_RED:
					return new DirectiveTerminalEvacuateState(flag);
				case COLOR_BROWN:
					return new DirectiveTerminalRebuildState(flag);
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
				case COLOR_RED:
					return new DirectiveRPBunker(flag);
			}
			break;
	}
}
