var rolesMap = require('rolesMap');

StructureSpawn.prototype.countCreeps = function (type) {
    var creeps = _.filter(Game.creeps, (creep) => creep.memory.role == type);
    return creeps.length;
};

StructureSpawn.prototype.creepName = function (roleName) {
    var i = 0;
    while (Game.creeps[(roleName + '_' + i)] != undefined) {
        i++;
    }
    return (roleName + '_' + i);
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
    }
    for (let i = 0; i < numberOfParts; i++) {
        body.push(CARRY);
    }
    for (let i = 0; i < numberOfParts; i++) {
        body.push(MOVE);
    }
    // create creep with the created body and the given role
    return this.createCreep(body, this.creepName(roleName), {role: roleName});
};

StructureSpawn.prototype.run = function () { // TODO: automatic creep number calculations
    var creepSizeLimit = 3;
    for (var roleName in rolesMap) {
        var roleObject = rolesMap[roleName];
        if (this.countCreeps(roleName) < roleObject.amount) {
            roleObject.behavior.create(this, creepSizeLimit);
            break;
        }
    }
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
