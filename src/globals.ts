// Useful functions
declare var deref;
global.deref = function (ref: string): RoomObject | Room { // dereference any object from identifier; see ref in RoomObjects
    return Game.getObjectById(ref) as RoomObject||
           Game.flags[ref] as Flag||
           Game.creeps[ref] as Creep ||
           Game.spawns[ref] as Spawn ||
           Game.rooms[ref] as Room ||
           null;
};

