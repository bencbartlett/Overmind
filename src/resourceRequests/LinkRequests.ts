// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../lib/Profiler';

@profile
export class LinkRequestGroup {

	receive: StructureLink[];
	transmit: StructureLink[];

	constructor() {
		this.receive = [];
		this.transmit = [];
	}

	requestReceive(link: StructureLink): void {
		this.receive.push(link);
	}

	requestTransmit(link: StructureLink): void {
		this.transmit.push(link);
	}

}
