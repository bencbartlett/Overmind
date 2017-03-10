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
// TODO: supplier inefficiencies; wasted time ticks between assignments
// TODO: nearest function that works across rooms and for possibly undefined rooms
// TODO: attack capability; calculations for how large of an invasion/defense group to make

// Import everything needed
'use strict';
require('require');

// Enable screeps profiler
const profiler = require('screeps-profiler');
// profiler.enable();

// Main loop
module.exports.loop = function () {
    profiler.wrap(function () {
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
        var preprocessing = require('preprocessing');
        preprocessing.run();
        // Set up room brains
        var roomBrain = require('Brain_Room');
        global.Brains = {};
        for (let name in Game.rooms) {
            Brains[name] = new roomBrain(name);
        }
        // Animation ===================================================================================================
        // Animate each creep
        for (let name in Game.creeps) {
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
        var LoggerClass = require('data_logger');
        var logger = new LoggerClass;
        logger.run();
        // Draw visuals
        if (Game.cpu.bucket > 7500) {
            var visuals = require('visuals');
            visuals.drawGlobalVisuals();
        }
    });
};

