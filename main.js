/*

 ___________________________________________________________

  _____  _    _ _______  ______ _______ _____ __   _ ______
 |     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
 |_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/

 ___________ Artificial Intelligence for Screeps ___________


*/

// TypeError: Cannot read property 'id' of null
// at taskRecharge.set target [as target] (Task:42:31)
// at taskRecharge.assign (Task:49:21)
// at Creep.assign (prototypes_Creep:31:17)
// at roleHauler.collect (role_hauler:40:15)
// at roleHauler.newTask (role_hauler:62:22)
// at roleHauler.run (Role:203:18)
// at Creep.run (prototypes_Creep:6:36)
// at Object.module.exports.loop (main:47:27)
// at __mainLoop:1:52
// Overmind repository: github.com/bencbartlett/overmind

// To-do list: ====================
// TODO: supplier inefficiencies; wasted time ticks between assignments
// TODO: nearest function that works across rooms and for possibly undefined rooms
// TODO: attack capability; calculations for how large of an invasion/defense group to make
// TODO: avoid room edges

// Import everything needed
'use strict';
require('require');

// Enable screeps profiler
//const profiler = require('screeps-profiler');
//profiler.enable();

// Main loop
module.exports.loop = function () {
    // profiler.wrap(function() {
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
    // Animate each creep
    for (let name in Game.creeps) {
        Game.creeps[name].run();
    }
    // Animate each room
    for (let name in Game.rooms) {
        var room = Game.rooms[name];
        // Animate each room brain, but only for owned rooms
        if (room.controller && room.controller.my) {
            room.run();
            room.brain.run();
        }
    }
    // Log stats
    var LoggerClass = require('data_logger');
    var logger = new LoggerClass;
    logger.run();
    // Draw global visuals
    var visuals = require('visuals');
    visuals.drawGlobalVisuals();
    // });
};