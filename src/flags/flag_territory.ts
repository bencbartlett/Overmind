// var roles = require('roles.js');

import {ClaimerSetup} from '../roles/claimer';


export var territoryFlagActions = {
	// colony: function (flag: Flag): void {
	//     // Spawn a reserver bot that will reserve the site
	//     function handleReservers(flag: Flag): void {
	//         let role = new roleReserver;
	//         let reserveAgain = false;
	//         let reserveBuffer = flag.room.colony.overlord.settings.reserveBuffer;
	//         if (flag.room && flag.room.controller) {
	//             reserveAgain = !(flag.room.controller.level > 0) && // can't reserved owned rooms
	//                            (!flag.room.controller.reservation || // reserve if there's no reservation
	//                             (flag.room.reservedByMe && // or if there is one by me and it's about to end
	//                              flag.room.controller.reservation.ticksToEnd < reserveBuffer));
	//         }
	//         if (reserveAgain) {
	//             flag.requiredCreepAmounts[role.name] = 1;
	//         } else {
	//             flag.requiredCreepAmounts[role.name] = 0;
	//         }
	//         flag.requestCreepIfNeeded(role, {patternRepetitionLimit: 4});
	//     }
	//
	//     // // If there are sites in need of construction and containers have been set up, send in some number of workers
	//     // function handleRemoteWorkers(flag: Flag) {
	//     //     var role = new roleWorker();
	//     //     if (!flag.room) { // requires vision of room
	//     //         return null;
	//     //     }
	//     //     var numContainers = flag.room.storageUnits.length;
	//     //     // Only spawn workers once containers are up, spawn a max of 2 per source
	//     //     var workerRequirements = 0;
	//     //     var workerSize;
	//     //     if (flag.room.remainingConstructionProgress > 0) { // set up remaining construction
	//     //         workerRequirements = 1;
	//     //         workerSize = 10; // bigger worker for doing construction work
	//     //     } else if (flag.room.overlord.countObjectives('repair') > 0) { // repair whatever needs repairing
	//     //         workerRequirements = 1;
	//     //         workerSize = 5; // repair jobs don't need as much
	//     //     }
	//     //     if (numContainers == 0) {
	//     //         flag.requiredCreepAmounts[role.name] = 0;
	//     //     } else {
	//     //         flag.requiredCreepAmounts[role.name] = workerRequirements;
	//     //     }
	//     //     return flag.requestCreepIfNeeded(role, {patternRepetitionLimit: workerSize});
	//     // }
	//
	//     handleReservers(flag);
	//     handleRemoteWorkers(flag);
	// },

	claimAndIncubate: function (flag: Flag): void {
		if (!(flag.room && flag.room.controller && flag.room.controller.my)) {
			// If the room is visible and isn't owned by me, proceed
			let assignedClaimers = flag.getAssignedCreeps('claimer');
			let assignedColony = Overmind.Colonies[flag.assignedRoom.name];
			// If the flag is assigned to a colony and there aren't any claimers already, then spawn one
			if (assignedClaimers.length < 1 && assignedColony && assignedColony.hatchery) {
				assignedColony.hatchery.enqueue(
					new ClaimerSetup().create(assignedColony, {
						assignment            : flag,
						patternRepetitionLimit: 1,
					}));
			}
		}
	},
};

