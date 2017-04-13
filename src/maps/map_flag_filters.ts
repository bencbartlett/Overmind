// Map of flag codes and associated filters

export interface flagSubCat {
    color: number;
    secondaryColor: number;
    filter: Function;
}

export interface flagCat {
    color: number;
    filter: Function;
    [subcat: string]: any;
}

export var flagFilters: { [category: string]: flagCat } = {
    millitary: { // actions involving the creation and direction of offensive or defensive creeps; requires assign()
        color: COLOR_RED,
        filter: (flag: Flag) => flag.color == COLOR_RED,
        destroyer: <flagSubCat> { // spawn and send guard to this flag, primarily for outpost guarding
            color: COLOR_RED,
            secondaryColor: COLOR_RED,
            filter: (flag: Flag) => flag.color == COLOR_RED && flag.secondaryColor == COLOR_RED,
        },
        guard: <flagSubCat>  { // spawn and send guard to this flag, primarily for outpost guarding // TODO: call in reinforcements
            color: COLOR_RED,
            secondaryColor: COLOR_BLUE,
            filter: (flag: Flag) => flag.color == COLOR_RED && flag.secondaryColor == COLOR_BLUE,
        },
        sieger: <flagSubCat>  { // spawn and send sieger/dismantler to this flag; removed when all owned objects in room destroyed
            color: COLOR_RED,
            secondaryColor: COLOR_YELLOW,
            filter: (flag: Flag) => flag.color == COLOR_RED && flag.secondaryColor == COLOR_YELLOW,
        },
    },

    destroy: { // directs millitary creeps to prioritize these objects; flags are removed when object is destroyed
        color: COLOR_ORANGE,
        filter: (flag: Flag) => flag.color == COLOR_ORANGE,
        attack: <flagSubCat> { // dismantle this structure (with siegers); usually walls
            color: COLOR_ORANGE,
            secondaryColor: COLOR_RED,
            filter: (flag: Flag) => flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_RED,
        },
        dismantle: <flagSubCat> { // dismantle this structure (with siegers); usually walls
            color: COLOR_ORANGE,
            secondaryColor: COLOR_YELLOW,
            filter: (flag: Flag) => flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_YELLOW,
        },
    },

    industry: { // actions related to remote gathering of resources; requires assign()
        color: COLOR_YELLOW,
        filter: (flag: Flag) => flag.color == COLOR_YELLOW,
        remoteMine: <flagSubCat> { // send remote miners to this source and send remote haulers once construction is finished
            color: COLOR_YELLOW,
            secondaryColor: COLOR_YELLOW,
            filter: (flag: Flag) => flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW,
        },
        refillThis: <flagSubCat> {
            color: COLOR_YELLOW,
            secondaryColor: COLOR_YELLOW,
            filter: (flag: Flag) => flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_WHITE,
        },
    },

    minerals: { // flags to indicate mineral types. Doesn't have internal color coding; types are put in flag memory
        color: COLOR_CYAN,
        filter: (flag: Flag) => flag.color == COLOR_CYAN,
    },

    territory: { // actions related to claiming or reserving a room; requires assign()
        color: COLOR_PURPLE,
        filter: (flag: Flag) => flag.color == COLOR_PURPLE,
        reserve: <flagSubCat> { // reserve a neutral room
            color: COLOR_PURPLE,
            secondaryColor: COLOR_PURPLE,
            filter: (flag: Flag) => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE,
        },
        // reserveAndHarvest: { // reserve a neutral room and harvest from all available sources
        //     color: COLOR_PURPLE,
        //     secondaryColor: COLOR_YELLOW,
        //     filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_YELLOW,
        //     action: flagActions.territory.reserveAndHarvest
        // },
        claimAndIncubate: <flagSubCat> { // claim a neutral room and allow it to piggyback off spanws
            color: COLOR_PURPLE,
            secondaryColor: COLOR_WHITE,
            filter: (flag: Flag) => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_WHITE,
        },
        // claim: { // claim a new room
        //     color: COLOR_PURPLE,
        //     secondaryColor: COLOR_WHITE,
        //     filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_WHITE,
        //     action: flagActions.territory.claim
        // }
    },

    vision: { // actions related to gathering intel; requires assign()
        color: COLOR_GREY,
        filter: (flag: Flag) => flag.color == COLOR_GREY,
        stationary: <flagSubCat> { // go here and stay here, used for scouts in reserved rooms to preserve vision
            color: COLOR_GREY,
            secondaryColor: COLOR_GREY,
            filter: (flag: Flag) => flag.color == COLOR_GREY && flag.secondaryColor == COLOR_GREY &&
                                    (flag.room == undefined || !flag.room.my),
        },
    },

    rally: { // directs creeps to rally points for various conditions
        color: COLOR_WHITE,
        filter: (flag: Flag) => flag.color == COLOR_WHITE,
        idlePoint: <flagSubCat>  {
            color: COLOR_WHITE,
            secondaryColor: COLOR_WHITE,
            filter: (flag: Flag) => flag.color == COLOR_WHITE && flag.secondaryColor == COLOR_WHITE,
        },
        // healPoint: { // come to me for healing! Ich kummere mich um dich.
        //     color: COLOR_WHITE,
        //     secondaryColor: COLOR_GREEN,
        //     filter: flag => flag.color == COLOR_WHITE && flag.secondaryColor == COLOR_GREEN,
        //     action: flagActions.rally.rallyHealer
        // }
    },
};

