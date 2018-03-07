// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../lib/Profiler';
import {Colony} from '../Colony';

@profile
export class LinkNetwork {

	colony: Colony;
	receive: StructureLink[];
	transmit: StructureLink[];

	constructor(colony: Colony) {
		this.colony = colony;
		this.receive = [];
		this.transmit = [];
	}

	requestReceive(link: StructureLink): void {
		this.receive.push(link);
	}

	requestTransmit(link: StructureLink): void {
		this.transmit.push(link);
	}

	init(): void {

	}

	/* Examine the link resource requests and try to efficiently (but greedily) match links that need energy in and
	 * out, then send the remaining resourceOut link requests to the command center link */
	private handleLinks(): void {
		// For each receiving link, greedily get energy from the closest transmitting link - at most 9 operations
		for (let receiveLink of this.receive) {
			let closestTransmitLink = receiveLink.pos.findClosestByRange(this.transmit);
			// If a send-receive match is found, transfer that first, then remove the pair from the link lists
			if (closestTransmitLink) {
				// Send min of (all the energy in sender link, amount of available space in receiver link)
				let amountToSend = _.min([closestTransmitLink.energy, receiveLink.energyCapacity - receiveLink.energy]);
				closestTransmitLink.transferEnergy(receiveLink, amountToSend);
				_.remove(this.transmit, closestTransmitLink);
				_.remove(this.receive, receiveLink);
			}
		}
		// Now send all remaining transmit link requests to the command center
		if (this.colony.commandCenter && this.colony.commandCenter.link) {
			for (let transmitLink of this.transmit) {
				transmitLink.transferEnergy(this.colony.commandCenter.link);
			}
		}
	}

	run(): void {

	}

}
