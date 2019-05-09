// Jump table to instantiate flags based on type

import {DirectiveClearRoom} from './colony/clearRoom';
import {DirectiveColonize} from './colony/colonize';
import {DirectiveIncubate} from './colony/incubate';
import {DirectiveOutpost} from './colony/outpost';
import {DirectiveSKOutpost} from './colony/outpostSK';
import {DirectiveGuard} from './defense/guard';
import {DirectiveInvasionDefense} from './defense/invasionDefense';
import {DirectiveOutpostDefense} from './defense/outpostDefense';
import {Directive} from './Directive';
import {DirectiveControllerAttack} from './offense/controllerAttack';
import {DirectivePairDestroy} from './offense/pairDestroy';
import {DirectiveSwarmDestroy} from './offense/swarmDestroy';
import {DirectiveExtract} from './resource/extract';
import {DirectiveHarvest} from './resource/harvest';
import {DirectiveHaul} from './resource/haul';
import {DirectiveRPBunker} from './roomPlanner/roomPlanner_bunker';
import {DirectiveRPCommandCenter} from './roomPlanner/roomPlanner_commandCenter';
import {DirectiveRPHatchery} from './roomPlanner/roomPlanner_hatchery';
import {DirectiveBootstrap} from './situational/bootstrap';
import {DirectiveNukeResponse} from './situational/nukeResponse';
import {DirectiveDismantle} from './targeting/dismantle';
import {DirectiveTargetSiege} from './targeting/siegeTarget';
import {DirectiveTerminalEmergencyState} from './terminalState/terminalState_emergency';
import {DirectiveTerminalEvacuateState} from './terminalState/terminalState_evacuate';
import {DirectiveTerminalRebuildState} from './terminalState/terminalState_rebuild';

/**
 * This is the initializer for directives, which maps flags by their color code to the corresponding directive
 */
export function DirectiveWrapper(flag: Flag): Directive | undefined {

	switch (flag.color) {

		// Colony directives ===========================================================================================
		case COLOR_PURPLE:
			switch (flag.secondaryColor) {
				case COLOR_PURPLE:
					return new DirectiveOutpost(flag);
				case COLOR_YELLOW:
					return new DirectiveSKOutpost(flag);
				case COLOR_WHITE:
					return new DirectiveIncubate(flag);
				case COLOR_GREY:
					return new DirectiveColonize(flag);
				case COLOR_ORANGE:
					return new DirectiveClearRoom(flag);
			}
			break;

		// Offensive combat directives =================================================================================
		case COLOR_RED:
			switch (flag.secondaryColor) {
				case COLOR_RED:
					return new DirectiveSwarmDestroy(flag);
				case COLOR_CYAN:
					return new DirectivePairDestroy(flag);
				case COLOR_PURPLE:
					return new DirectiveControllerAttack(flag);
			}
			break;

		// Defensive combat directives =================================================================================
		case COLOR_BLUE:
			switch (flag.secondaryColor) {
				case COLOR_BLUE:
					return new DirectiveGuard(flag);
				case COLOR_RED:
					return new DirectiveOutpostDefense(flag);
				case COLOR_PURPLE:
					return new DirectiveInvasionDefense(flag);
			}
			break;

		// Situational directives ======================================================================================
		case COLOR_ORANGE:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveBootstrap(flag);
				case COLOR_BLUE:
					return new DirectiveNukeResponse(flag);
			}
			break;

		// Resource directives =========================================================================================
		case COLOR_YELLOW:
			switch (flag.secondaryColor) {
				case COLOR_YELLOW:
					return new DirectiveHarvest(flag);
				case COLOR_CYAN:
					return new DirectiveExtract(flag);
				case COLOR_BLUE:
					return new DirectiveHaul(flag);
			}
			break;

		// Terminal state directives ===================================================================================
		case COLOR_BROWN:
			switch (flag.secondaryColor) {
				case COLOR_RED:
					return new DirectiveTerminalEvacuateState(flag);
				case COLOR_ORANGE:
					return new DirectiveTerminalEmergencyState(flag);
				case COLOR_YELLOW:
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
