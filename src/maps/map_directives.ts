// Jump table to instantiate flags based on type

import {DirectiveGuard} from '../directives/directive_guard';
import {DirectiveIncubate} from '../directives/directive_incubate';
import {DirectiveOutpost} from '../directives/directive_outpost';
import {DirectiveBootstrap} from '../directives/directive_bootstrap';
import {Directive} from '../directives/Directive';

export function DirectiveWrapper(flag: Flag): Directive | undefined {
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

		// Room planning directives ==========================================
		case COLOR_WHITE:
			switch (flag.secondaryColor) {

			}
			break;

	}
}




