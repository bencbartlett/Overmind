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
//
// To-do list: ====================
// TODO: ignore pathing only for haulers/friendly creeps on track? Gets stuck against enemies
// TODO: DEFCON + dynamically generated guards (patrolling cops?)
// TODO: spawn queue - duplicate creeps can be built from double-spawn rooms

// Import everything needed
'use strict';

import OM from "./Overmind";
import {flagCodesMap} from "./maps/map_flag_codes";

import profiler = require('./lib/screeps-profiler');

import "./require";
import {Preprocessing} from "./Preprocessing";
import {dataLogger} from './logging/data_logger';
import {visuals} from './visuals/visuals';

declare var Overmind: OM;
declare var flagCodes: { [category: string]: flagCat };

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
    Overmind.initializeAllBrains();

    // Animation ===================================================================================================
    // Animate each creep
    for (let name in Game.creeps) {
        // if (name == 'destroyer_0') {
        //     continue;
        // }
        Game.creeps[name].run();
    }
    // Animate each room
    for (let name in Game.rooms) {
        // Object.defineProperty(Game.rooms[name], 'brain', brains[name]);
        // Animate each room brain, but only for owned rooms
        let room = Game.rooms[name];
        if (room.my) {
            room.run();
            room.brain.run();
        }
    }

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

