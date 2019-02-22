// Jump table to instantiate flags based on type

import {DirectiveGuard} from './defense/guard';
import {DirectiveIncubate} from './colony/incubate';
import {DirectiveOutpost} from './colony/outpost';
import {DirectiveBootstrap} from './situational/bootstrap';
import {Directive} from './Directive';
import {DirectiveRPHatchery} from './roomPlanner/roomPlanner_hatchery';
import {DirectiveRPCommandCenter} from './roomPlanner/roomPlanner_commandCenter';
import {DirectiveColonize} from './colony/colonize';
import {DirectiveTargetSiege} from './targeting/siegeTarget';
import {DirectivePairDestroy} from './offense/pairDestroy';
import {DirectiveInvasionDefense} from './defense/invasionDefense';
import {DirectiveHaul} from './resource/haul';
import {DirectiveDismantle} from './targeting/dismantle';
import {DirectiveNukeResponse} from './situational/nukeResponse';
import {DirectiveTerminalEmergencyState} from './terminalState/terminalState_emergency';
import {DirectiveRPBunker} from './roomPlanner/roomPlanner_bunker';
import {DirectiveTerminalRebuildState} from './terminalState/terminalState_rebuild';
import {DirectiveTerminalEvacuateState} from './terminalState/terminalState_evacuate';
import {DirectiveControllerAttack} from './offense/controllerAttack';
import {DirectiveSKOutpost} from './colony/outpostSK';
import {DirectiveHarvest} from './resource/harvest';
import {DirectiveExtract} from './resource/extract';
import {DirectiveSwarmDestroy} from './offense/swarmDestroy';
import {DirectiveOutpostDefense} from './defense/outpostDefense';
import {DirectiveClearRoom} from './colony/clearRoom';

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
