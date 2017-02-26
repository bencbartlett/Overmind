// Custom error codes
global.ERR_NO_TARGET_FOUND = 1;
global.ERR_NO_SPAWN_IN_ROOM = 2;
global.ERR_NOT_IN_SERVICE_ROOM = 3;
// Cached find strings
global.SOURCES = 'sources';
// Useful functions
// global.print = function (msg) {
//     console.log(msg);
// };

// Object.defineProperty(String.prototype, 'deref', { // dereference any object from identifier; see ref in RoomObjects
//     get: function () {
//         return Game.getObjectById(this) || Game.flags[this] || Game.creeps[this] || Game.rooms[this] || null;
//     }
// });

global.deref = function (ref) { // dereference any object from identifier; see ref in RoomObjects
    return Game.getObjectById(ref) ||
           Game.flags[ref] ||
           Game.creeps[ref] ||
           Game.spawns[ref] ||
           Game.rooms[ref] ||
           null;
};