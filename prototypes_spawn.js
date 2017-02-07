StructureSpawn.prototype.work = function () {
    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    // console.log('Harvesters: ' + harvesters.length);

    if (harvesters.length < 4) {
        let newName = Game.spawns['Spawn1'].createCreep([WORK, CARRY, MOVE], undefined, {role: 'harvester'});
        //Game.creeps[newName].test = "hello";
        // console.log('result: ' + newName);
        // if(typeof newName == "string") { // Successful spawn
        //     let assignment = roleHarvester.getAssignment(Game.creeps[newName]);
        //
        // }
        //console.log('Spawning new harvester: ' + newName );//+ ' assigned to: ' + assignment);

    } else if (builders.length < 3) {
        let newName = Game.spawns['Spawn1'].createCreep([WORK, CARRY, CARRY, MOVE], undefined, {role: 'builder'});
        //console.log('Spawning new builder: ' + newName);
    } else if (upgraders.length < 2) {
        let newName = Game.spawns['Spawn1'].createCreep([WORK, CARRY, CARRY, MOVE], undefined, {role: 'upgrader'});
        //console.log('Spawning new upgrader: ' + newName);
    }
};
