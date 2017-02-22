var rolesMap = require('rolesMap');

StructureSpawn.prototype.creepName = function (roleName) {
    // generate a creep name based on the role and add a suffix to make it unique
    var i = 0;
    while (Game.creeps[(roleName + '_' + i)] != undefined) {
        i++;
    }
    return (roleName + '_' + i);
};

StructureSpawn.prototype.cost = function (bodyArray) {
    var partCosts = {
        'move': 50,
        'work': 100,
        'carry': 50,
        'attack': 80,
        'ranged_attack': 150,
        'heal': 250,
        'claim': 600,
        'tough': 10
    };
    var cost = 0;
    for (let part of bodyArray) {
        cost += partCosts[part];
    }
    return cost;
};

StructureSpawn.prototype.createBiggestCreep = function (roleName, partsLimit = Infinity) {
    // create a balanced body as big as possible with the given energy
    var energy = this.room.energyCapacityAvailable; // total energy available for spawn + extensions
    var numberOfParts = Math.floor(energy / 200);
    // make sure the creep is not too big (more than 50 parts)
    numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3), partsLimit);
    var body = [];
    for (let i = 0; i < numberOfParts; i++) {
        body.push(WORK);
        body.push(CARRY);
        body.push(MOVE);
    }
    // create creep with the created body and the given role
    return this.createCreep(body, this.creepName(roleName), {role: roleName});
};

StructureSpawn.prototype.donateCreepToRoom = function (roleName, roomName) {
    var roleObject = rolesMap[roleName];
    if (roleObject) {
        if (Game.rooms[roomName]) {
            var donatedCreep = roleObject.behavior.create(this, 5); // manual size setter for now
            donatedCreep.donate(roomName);
        } else {
            console.log('Error: ' + roomName + ' is ' + Game.rooms[roomName]);
        }
    } else {
        console.log('Error: ' + roleName + ' is not a valid role.');
    }
};
