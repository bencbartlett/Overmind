'use strict';

// To-do list: ====================
// TODO: attack capability; calculations for how large of an invasion/defense group to make

// Import everything needed
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
    // Animate each creep
    for (let name in Game.creeps) {
        Game.creeps[name].run();
    }
    // Animate each room
    for (let name in Game.rooms) {
        var room = Game.rooms[name];
        // Animate each room brain, but only for owned rooms
        if (room.controller.my) {
            room.run();
            room.brain.run();
        }
    }
    // });
};