// Map of flag codes and associated filters

import profiler = require('../lib/screeps-profiler');
import {millitaryFlagActions} from '../flags/flag_millitary';
import {industryFlagActions} from '../flags/flag_industry';
import {territoryFlagActions} from '../flags/flag_territory';
import {visionFlagActions} from '../flags/flag_vision';
import {rallyFlagActions} from '../flags/flag_rally';

var flagActions: { [category: string]: flagActions } = {
	millitary: millitaryFlagActions,
	industry : industryFlagActions,
	territory: territoryFlagActions,
	vision   : visionFlagActions,
	rally    : rallyFlagActions,
};

export var flagCodesMap: { [category: string]: flagCat } = {
	millitary: { // actions involving the creation and direction of offensive or defensive creeps; requires assign()
		color    : COLOR_RED,
		filter   : (flag: Flag) => flag.color == COLOR_RED,
		action   : flagActions.millitary,
		destroyer: <flagSubCat> { // spawn and send guard to this flag, primarily for outpost guarding
			color         : COLOR_RED,
			secondaryColor: COLOR_RED,
			filter        : (flag: Flag) => flag.color == COLOR_RED && flag.secondaryColor == COLOR_RED,
			action        : flagActions.millitary.destroyer,
		},
		guard    : <flagSubCat>  { // spawn and send guard to this flag, primarily for outpost guarding
			color         : COLOR_RED,
			secondaryColor: COLOR_BLUE,
			filter        : (flag: Flag) => flag.color == COLOR_RED && flag.secondaryColor == COLOR_BLUE,
			action        : flagActions.millitary.guard,
		},
		sieger   : <flagSubCat>  { // spawn and send sieger/dismantler to this flag
			color         : COLOR_RED,
			secondaryColor: COLOR_YELLOW,
			filter        : (flag: Flag) => flag.color == COLOR_RED && flag.secondaryColor == COLOR_YELLOW,
			action        : flagActions.millitary.sieger,
		},
	},

	destroy: { // directs millitary creeps to prioritize these objects; flags are removed when object is destroyed
		color    : COLOR_ORANGE,
		filter   : (flag: Flag) => flag.color == COLOR_ORANGE,
		action   : null,
		attack   : <flagSubCat> { // dismantle this structure (with siegers); usually walls
			color         : COLOR_ORANGE,
			secondaryColor: COLOR_RED,
			filter        : (flag: Flag) => flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_RED,
			action        : null,
		},
		dismantle: <flagSubCat> { // dismantle this structure (with siegers); usually walls
			color         : COLOR_ORANGE,
			secondaryColor: COLOR_YELLOW,
			filter        : (flag: Flag) => flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_YELLOW,
			action        : null,
		},
	},

	industry: { // actions related to remote gathering of resources; requires assign()
		color     : COLOR_YELLOW,
		filter    : (flag: Flag) => flag.color == COLOR_YELLOW,
		action    : flagActions.industry,
		remoteMine: <flagSubCat> {
			color         : COLOR_YELLOW,
			secondaryColor: COLOR_YELLOW,
			filter        : (flag: Flag) => flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW,
			action        : flagActions.industry.remoteMine,
		},
		refillThis: <flagSubCat> {
			color         : COLOR_YELLOW,
			secondaryColor: COLOR_YELLOW,
			filter        : (flag: Flag) => flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_WHITE,
			action        : null,
		},
	},

	minerals: { // flags to indicate mineral types. Doesn't have internal color coding; types are put in flag memory
		color : COLOR_CYAN,
		filter: (flag: Flag) => flag.color == COLOR_CYAN,
		action: null,
	},

	territory: { // actions related to claiming or reserving a room; requires assign()
		color           : COLOR_PURPLE,
		filter          : (flag: Flag) => flag.color == COLOR_PURPLE,
		action          : flagActions.territory,
		colony          : <flagSubCat> { // reserve a neutral room
			color         : COLOR_PURPLE,
			secondaryColor: COLOR_PURPLE,
			filter        : (flag: Flag) => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE,
			action        : null, // flagActions.territory.colony,
		},
		// reserveAndHarvest: { // reserve a neutral room and harvest from all available sources
		//     color: COLOR_PURPLE,
		//     secondaryColor: COLOR_YELLOW,
		//     filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_YELLOW,
		//     action: flagActions.territory.reserveAndHarvest
		// },
		claimAndIncubate: <flagSubCat> { // claim a neutral room and allow it to piggyback off spanws
			color         : COLOR_PURPLE,
			secondaryColor: COLOR_WHITE,
			filter        : (flag: Flag) => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_WHITE,
			action        : flagActions.territory.claimAndIncubate,
		},
		// claim: { // claim a new room
		//     color: COLOR_PURPLE,
		//     secondaryColor: COLOR_WHITE,
		//     filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_WHITE,
		//     action: flagActions.territory.claim
		// }
	},

	vision: { // actions related to gathering intel; requires assign()
		color     : COLOR_GREY,
		filter    : (flag: Flag) => flag.color == COLOR_GREY,
		action    : flagActions.vision,
		stationary: <flagSubCat> { // go here and stay here, used for scouts in reserved rooms to preserve vision
			color         : COLOR_GREY,
			secondaryColor: COLOR_GREY,
			filter        : (flag: Flag) => flag.color == COLOR_GREY && flag.secondaryColor == COLOR_GREY &&
											(flag.room == undefined || !flag.room.my),
			action        : flagActions.vision.stationary,
		},
	},

	rally: { // directs creeps to rally points for various conditions
		color    : COLOR_WHITE,
		filter   : (flag: Flag) => flag.color == COLOR_WHITE,
		action   : flagActions.rally,
		idlePoint: <flagSubCat>  {
			color         : COLOR_WHITE,
			secondaryColor: COLOR_WHITE,
			filter        : (flag: Flag) => flag.color == COLOR_WHITE && flag.secondaryColor == COLOR_WHITE,
			action        : null,
		},
		// healPoint: { // come to me for healing! Ich kummere mich um dich.
		//     color: COLOR_WHITE,
		//     secondaryColor: COLOR_GREEN,
		//     filter: flag => flag.color == COLOR_WHITE && flag.secondaryColor == COLOR_GREEN,
		//     action: flagActions.rally.rallyHealer
		// }
	},
};

// export default flagCodesMap;

profiler.registerObject(flagCodesMap, 'flagCodes');
