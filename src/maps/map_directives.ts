// Jump table to instantiate flags based on type

import {DirectiveGuard} from '../directives/directive_guard';
import {DirectiveIncubate} from '../directives/directive_incubate';
import {DirectiveOutpost} from '../directives/directive_outpost';
import {DirectiveBootstrap} from '../directives/directive_bootstrap';

// function codeToString(colorCode: ColorCode): string {
// 	return `${colorCode.color}/${colorCode.secondaryColor}`;
// }
//


export function DirectiveWrapper(flag: Flag): IDirective | undefined {
	switch (flag.color) {
		// Colony directives =================================================
		case COLOR_PURPLE:
			switch (flag.secondaryColor) {
				case COLOR_PURPLE:
					return new DirectiveOutpost(flag);
				case COLOR_WHITE:
					return new DirectiveIncubate(flag);
			}
			break;

		// Military directives ===============================================
		case COLOR_RED:
			switch (flag.secondaryColor) {
				case COLOR_BLUE:
					return new DirectiveGuard(flag);
			}
			break;

		// Operation directives ==============================================
		case COLOR_ORANGE:
			switch (flag.secondaryColor) {
				case COLOR_ORANGE:
					return new DirectiveBootstrap(flag);
			}
			break;

		// Energy directives =================================================
		case COLOR_YELLOW:
			switch (flag.secondaryColor) {

			}
			break;

		// Routing directives ================================================
		case COLOR_WHITE:
			switch (flag.secondaryColor) {

			}
			break;

		// Room planning directives ==========================================
		case COLOR_GREY:
			switch (flag.secondaryColor) {

			}
			break;
	}
}

//
// function MilitaryDirectiveWrapper(flag: Flag): IDirective | undefined {
// 	switch (flag.secondaryColor) {
// 		case COLOR_BLUE:
// 			return new DirectiveGuard(flag);
// 	}
// }
//
//
// var military = {
// 	// COLOR_RED: DirectiveAttack,
// 	COLOR_BLUE: DirectiveGuard,
// };
//
// var operation = {
// 	COLOR_ORANGE: DirectiveBootstrap,
// };
//
// var energy = {
// 	// COLOR_YELLOW: DirectiveMine,
// };
//
// var routing = {
// 	// COLOR_WHITE: DirectiveRoute,
// };
//
// var hiveClusters = {};
//
// var colony = {
// 	// COLOR_PURPLE: DirectiveColony,
// 	COLOR_BLUE : DirectiveOutpost,
// 	COLOR_WHITE: DirectiveIncubate,
// };
//
//
// export var FlagMap = {
// 	COLOR_RED   : military,
// 	COLOR_ORANGE: operation,
// 	COLOR_YELLOW: energy,
// 	COLOR_WHITE : routing,
// 	COLOR_GREY  : hiveClusters,
// 	COLOR_PURPLE: colony,
// };



