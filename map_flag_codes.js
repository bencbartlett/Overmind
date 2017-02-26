// Map of flag codes and associated filters

var flagCodes = {
    millitary: { // actions involving offensive or defensive creeps
        color: COLOR_RED,
        filter: flag => flag.color == COLOR_RED,
        guard: { // send guard to this area, primarily for outpost guarding // TODO: call in reinforcements
            color: COLOR_RED,
            secondaryColor: COLOR_BLUE,
            filter: flag => flag.color == COLOR_RED && flag.secondaryColor == COLOR_BLUE
        }
    },

    destroy: { // millitary, but prioritize destroying these objects
        color: COLOR_ORANGE,
        filter: flag => flag.color == COLOR_ORANGE,
        dismantle: { // dismantle this structure (with siegers); usually walls
            color: COLOR_ORANGE,
            secondaryColor: COLOR_YELLOW,
            filter: flag => flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_YELLOW
        }
    },

    industry: { // actions related to gathering resources
        color: COLOR_YELLOW,
        filter: flag => flag.color == COLOR_YELLOW,
        mine: { // send remote miners to this source and send haulers once construction is finished
            color: COLOR_YELLOW,
            secondaryColor: COLOR_YELLOW,
            filter: flag => flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW
        }
    },

    territory: { // actions related to claiming or reserving a room
        color: COLOR_PURPLE,
        filter: flag => flag.color == COLOR_PURPLE,
        reserve: { // reserve a neutral room
            color: COLOR_PURPLE,
            secondaryColor: COLOR_PURPLE,
            filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE,
        },
        claim: { // claim a new room
            color: COLOR_PURPLE,
            secondaryColor: COLOR_WHITE,
            filter: flag => flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_WHITE,
        }
    },

    vision: { // actions related to gathering intel
        color: COLOR_GREY,
        filter: flag => flag.color == COLOR_GREY,
        stationary: { // go here and stay here, used for scouts in reserved rooms to preserve vision
            color: COLOR_GREY,
            secondaryColor: COLOR_GREY,
            filter: flag => flag.color == COLOR_GREY && flag.secondaryColor == COLOR_GREY &&
                            (flag.room == undefined || !flag.room.my)
        }
    }
};

module.exports = flagCodes;