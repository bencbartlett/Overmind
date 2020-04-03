import {Cartographer, ROOMTYPE_CORE} from './Cartographer';

export class PortalUtils {
	/**
	 * Returns array of portals in range
	 * @param startingRoom to originate search from
	 * @param range Path range for portals
	 * @return Array[room, portalsInRoom] TODO turn this into a better format
	 */
	static findPortalsInRange(startingRoom: string, range: number) {
		// TODO won't take into account intershard CROSSROAD rooms for simplicity sake, fix later
		const potentialPortalRooms = Cartographer.findRoomsInRange(startingRoom, range)
												 .filter(roomName => Cartographer.roomType(roomName) == ROOMTYPE_CORE);
		// Examine for portals
		const portalRooms = potentialPortalRooms.filter(roomName => !!Memory.rooms[roomName]
																	&& !!Memory.rooms[roomName][_RM.PORTALS]);
		const rooms: { [name: string]: SavedPortal[]; } = {};
		for (const roomName of portalRooms) {
			const roomPortals = Memory.rooms[roomName][_RM.PORTALS]; // to prevent TS errors
			if (roomPortals != undefined && roomPortals.length > 0) {
				rooms[roomName] = roomPortals;
			}
		}
		return rooms;
	}
}
