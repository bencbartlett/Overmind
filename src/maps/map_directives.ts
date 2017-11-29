// Jump table to instantiate flags based on type

import {DirectiveGuard} from '../directives/directive_guard';
import {DirectiveIncubate} from '../directives/directive_incubate';
import {DirectiveOccupy} from '../directives/directive_occupy';

function codeToString(colorCode: ColorCode): string {
	return `${colorCode.color}/${colorCode.secondaryColor}`;
}

export function DirectiveWrapper(flag: Flag): IDirective | undefined {
	let colorCode = {
		color         : flag.color,
		secondaryColor: flag.secondaryColor
	};
	let directive: any;

	switch (codeToString(colorCode)) {
		case codeToString(DirectiveGuard.colorCode):
			directive = new DirectiveGuard(flag);
			break;

		case codeToString(DirectiveOccupy.colorCode):
			directive = new DirectiveOccupy(flag);
			break;

		case codeToString(DirectiveIncubate.colorCode):
			directive = new DirectiveIncubate(flag);
			break;

		// default:
		// 	console.log(`Error instantiating ${flag.name}: ${flag.color}/${flag.secondaryColor}` +
		// 				' is not a valid color code.');
		// 	break;

	}
	return directive!;
}

// export function CreateDirectiveFlag(directiveName: string, pos: RoomPosition, name?: string): void {
// 	if (!name) {
// 		name = directiveName + pos.roomName;
// 	}
// 	let colorCode;
// 	switch (directiveName) {
// 		case DirectiveGuard.directiveName:
// 			colorCode = DirectiveGuard.colorCode;
// 			break;
// 		case DirectiveOccupy.directiveName:
// 			colorCode = DirectiveOccupy.colorCode;
// 			break;
// 		case DirectiveIncubate.directiveName:
// 			colorCode = DirectiveIncubate.colorCode;
// 			break;
// 		default:
// 			console.log(`Error creating directive flag: ${directiveName} is not a valid directive name.`);
// 			break;
// 	}
// 	Game.rooms[pos.roomName].createFlag(pos, name, colorCode!.color, colorCode!.secondaryColor);
// }