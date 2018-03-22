// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';

@profile
export class LinkNetwork {

	colony: Colony;
	receive: StructureLink[];
	transmit: StructureLink[];

	private settings: {
		linksTrasmitAt: number,
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.receive = [];
		this.transmit = [];
		this.settings = {
			linksTrasmitAt: LINK_CAPACITY - 100,
		};
	}

	requestReceive(link: StructureLink): void {
		this.receive.push(link);
	}

	requestTransmit(link: StructureLink): void {
		this.transmit.push(link);
	}

	/* Number of ticks until a dropoff link is available again to deposit energy to */
	getDropoffAvailability(link: StructureLink): number {
		let dest = this.colony.commandCenter ? this.colony.commandCenter.pos : this.colony.pos;
		let usualCooldown = link.pos.getRangeTo(dest);
		if (link.energy > this.settings.linksTrasmitAt) { // Energy will be sent next time cooldown == 0
			return link.cooldown + usualCooldown;
		} else {
			return link.cooldown;
		}
	}

	init(): void {
		for (let link of this.colony.dropoffLinks) {
			if (link.energy > this.settings.linksTrasmitAt) {
				this.requestTransmit(link);
			}
		}
	}

	/* Examine the link resource requests and try to efficiently (but greedily) match links that need energy in and
	 * out, then send the remaining resourceOut link requests to the command center link */
	run(): void {
		// For each receiving link, greedily get energy from the closest transmitting link - at most 9 operations
		for (let receiveLink of this.receive) {
			let closestTransmitLink = receiveLink.pos.findClosestByRange(this.transmit);
			// If a send-receive match is found, transfer that first, then remove the pair from the link lists
			if (closestTransmitLink) {
				// Send min of (all the energy in sender link, amount of available space in receiver link)
				let amountToSend = _.min([closestTransmitLink.energy, receiveLink.energyCapacity - receiveLink.energy]);
				closestTransmitLink.transferEnergy(receiveLink, amountToSend);
				_.remove(this.transmit, link => link == closestTransmitLink);
				_.remove(this.receive, link => link == receiveLink);
			}
		}
		// Now send all remaining transmit link requests to the command center
		if (this.colony.commandCenter && this.colony.commandCenter.link) {
			for (let transmitLink of this.transmit) {
				transmitLink.transferEnergy(this.colony.commandCenter.link);
			}
		}
	}

}
