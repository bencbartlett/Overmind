// Map of flag codes and associated filters

var flagCodes = {
    millitary: { // actions involving the creation and direction of offensive or defensive creeps; requires assign()
        color: COLOR_RED,
        filter: flag => flag.color == COLOR_RED,
        guard: { // spawn and send guard to this flag, primarily for outpost guarding // TODO: call in reinforcements
            color: COLOR_RED,
            secondaryColor: COLOR_BLUE,
            filter: flag => flag.color == COLOR_RED && flag.secondaryColor == COLOR_BLUE
        },
        sieger: { // spawn and send sieger/dismantler to this flag; removed when all owned objects in room destroyed
            color: COLOR_RED,
            secondaryColor: COLOR_YELLOW,
            filter: flag => flag.color == COLOR_RED && flag.secondaryColor == COLOR_YELLOW
        }
    },

    destroy: { // directs millitary creeps to prioritize these objects; flags are removed when object is destroyed
        color: COLOR_ORANGE,
        filter: flag => flag.color == COLOR_ORANGE,
        dismantle: { // dismantle this structure (with siegers); usually walls
            color: COLOR_ORANGE,
            secondaryColor: COLOR_YELLOW,
            filter: flag => flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_YELLOW
        }
    },

    industry: { // actions related to remote gathering of resources; requires assign()
        color: COLOR_YELLOW,
        filter: flag => flag.color == COLOR_YELLOW,
        mine: { // send remote miners to this source and send remote haulers once construction is finished
            color: COLOR_YELLOW,
            secondaryColor: COLOR_YELLOW,
            filter: flag => flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW
        }
    },

    territory: { // actions related to claiming or reserving a room; requires assign()
        color: COLOR_PURPLE,
        filter: flag => flag.color == COLOR_PURPLE,
        reserve: { // reserve a neutral room
            color: COLOR_PURPLE,
            secondaryColor: COLOR_PURPLE,
            filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE
        },
        claim: { // claim a new room
            color: COLOR_PURPLE,
            secondaryColor: COLOR_WHITE,
            filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_WHITE
        }
    },

    vision: { // actions related to gathering intel; requires assign()
        color: COLOR_GREY,
        filter: flag => flag.color == COLOR_GREY,
        stationary: { // go here and stay here, used for scouts in reserved rooms to preserve vision
            color: COLOR_GREY,
            secondaryColor: COLOR_GREY,
            filter: flag => flag.color == COLOR_GREY && flag.secondaryColor == COLOR_GREY &&
                            (flag.room == undefined || !flag.room.my)
        }
    },

    rally: { // directs creeps to rally points for various conditions
        color: COLOR_WHITE,
        filter: flag => flag.color == COLOR_WHITE,
        healPoint: { // come to me for healing! Ich kummere mich um dich.
            color: COLOR_WHITE,
            secondaryColor: COLOR_GREEN,
            filter: flag => flag.color == COLOR_WHITE && flag.secondaryColor == COLOR_GREEN
        }
    }
};

module.exports = flagCodes;