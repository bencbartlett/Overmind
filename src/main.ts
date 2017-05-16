// ___________________________________________________________
//
//  _____  _    _ _______  ______ _______ _____ __   _ ______
// |     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
// |_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/
//
// ___________ Artificial Intelligence for Screeps ___________
//
//
// Overmind repository: github.com/bencbartlett/overmind
//

// Import everything needed
'use strict';
// Globals
import "./globals";
// import "./utilities";
import "./settings/settings_user";
// Libraries
import "./pathing/pathing"; // Used for calculating road distances to prioritize assigned operations
import "./lib/Traveler"; // BonzAI's excellent moveTo() replacement
// Prototypes
import "./prototypes/prototypes_Creep";
import "./prototypes/prototypes_Flag";
import "./prototypes/prototypes_RoomObject";
import "./prototypes/prototypes_RoomPosition";
import "./prototypes/prototypes_RoomVisual";
import "./prototypes/prototypes_Room";
import "./prototypes/prototypes_Structures";
// Global objects
import OM from "./Overmind";
import {flagCodesMap} from "./maps/map_flag_codes";
declare var Overmind: OM;
declare var flagCodes: { [category: string]: flagCat };
// CPU profiler
import profiler = require('./lib/screeps-profiler');
// Other stuff
import {Preprocessing} from "./preprocessing";
import {dataLogger} from './logging/data_logger';
import {visuals} from './visuals/visuals';

// Enable screeps profiler
// profiler.enable();

// Main loop
export function loop() {
    // profiler.wrap(function () {
    // Memory management ===========================================================================================
    // Clear memory for non-existent creeps
    for (let name in Memory.creeps) {
        if (Game.creeps[name] == undefined) {
            delete Memory.creeps[name];
        }
    }
    // Clear memory for non-existent flags
    for (let name in Memory.flags) {
        if (Game.flags[name] == undefined) {
            delete Memory.flags[name];
        }
    }

    // Setup =======================================================================================================
    // Preprocessing
    let preprocessing = new Preprocessing();
    preprocessing.run();
    // Create global flagCodes reference (avoids circular imports)
    global.flagCodes = flagCodesMap;
    // Initialize Overmind object
    global.Overmind = new OM;
    Overmind.init();

    // Animation ===================================================================================================
    // Animate each overlord
    for (let name in Overmind.Colonies) {
        Overmind.Overlords[name].run(); // Run the colony overlord
        Game.rooms[name].run(); // Run the (owned) room
        Overmind.Colonies[name].hatchery.run(); // Run the hatchery
    }
    // Animate each creep
    for (let name in Game.creeps) {
        Game.creeps[name].run();
    }

    // for (let name in Game.rooms) {
    //     // Animate each room brain, but only for owned rooms
    //     let room = Game.rooms[name];
    //     if (room.my) {
    //         room.run();
    //         room.brain.run();
    //     }
    // }

    // Postprocessing ==============================================================================================
    // Log stats
    var logger = new dataLogger;
    logger.run();
    // Draw visuals
    if (Game.cpu.bucket > 7500) {
        visuals.drawGlobalVisuals();
    }
    // });
}

