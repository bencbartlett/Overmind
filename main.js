/*

 ___________________________________________________________

  _____  _    _ _______  ______ _______ _____ __   _ ______
 |     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
 |_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/

 ___________ Artificial Intelligence for Screeps ___________


*/







// Overmind repository: github.com/bencbartlett/screeps

// To-do list: ====================
// TODO: once we have storage, workers should only spawn when repairs or construction; upgrader creep with varying size
// TODO: supplier inefficiencies; wasted time ticks between assignments
// TODO: nearest function that works across rooms and for possibly undefined rooms
// TODO: attack capability; calculations for how large of an invasion/defense group to make

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
    // });
};