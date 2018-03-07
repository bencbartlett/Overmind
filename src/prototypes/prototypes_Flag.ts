// import {Pathing} from '../pathing/pathing';
// import {log} from '../lib/logger/log';
//
//
// // Set the colony of the flag to be
// Flag.prototype.recalculateColony = function (restrictDistance = 10): void {
// 	log.info(`Recalculating colony association for ${this.name} in ${this.pos.roomName}`);
// 	let nearestColonyName = '';
// 	let minDistance = Infinity;
// 	let colonyRooms = _.filter(Game.rooms, room => room.my);
// 	for (let room of colonyRooms) {
// 		let ret = Pathing.findShortestPath(this.pos, room.controller!.pos,
// 										   {restrictDistance: restrictDistance});
// 		if (!ret.incomplete) {
// 			if (ret.path.length < minDistance) {
// 				nearestColonyName = room.name;
// 				minDistance = ret.path.length;
// 			}
// 			log.info(`Path length to ${room.name}: ${ret.path.length}`);
// 		} else {
// 			log.info(`Incomplete path found to ${room.name}`);
// 		}
// 	}
// 	if (nearestColonyName != '') {
// 		log.info(`Best match: ${nearestColonyName!}`);
// 		this.memory.colony = nearestColonyName;
// 	} else {
// 		log.warning(`Could not find colony match for ${this.name} in ${this.pos.roomName}!`);
// 	}
// };
