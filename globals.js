global.deref = function (ref) {
    return Game.getObjectById(ref) ||
        Game.flags[ref] ||
        Game.creeps[ref] ||
        Game.spawns[ref] ||
        Game.rooms[ref] ||
        null;
};
