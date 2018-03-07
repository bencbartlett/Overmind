// Road network: groups roads in a single object for more intelligent repair requests

import {profile} from '../lib/Profiler';


@profile
export class RoadNetwork {

	rooms: Room[];
	roads: StructureRoad[];

	constructor(rooms: Room[]) {
		this.rooms = rooms;
	}


}