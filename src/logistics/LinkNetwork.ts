import {Colony} from '../Colony';
import {profile} from '../profiler/decorator';

/**
 * The link network controls the flow of energy through various links in a room and uses a greedy matching algorithm
 * to determine where to send energy to
 */
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

	refresh(): void {
		this.receive = [];
		this.transmit = [];
	}

	claimLink(link: StructureLink | undefined): void {
		if (link) {
			_.remove(this.colony.availableLinks, l => l.id == link.id);
		}
	}

	requestReceive(link: StructureLink): void {
		this.receive.push(link);
	}

	requestTransmit(link: StructureLink): void {
		this.transmit.push(link);
	}

	/**
	 * Number of ticks until a dropoff link is available again to deposit energy to
	 */
	getDropoffAvailability(link: StructureLink): number {
		const dest = this.colony.commandCenter ? this.colony.commandCenter.pos : this.colony.pos;
		const usualCooldown = link.pos.getRangeTo(dest);
		if (link.energy > this.settings.linksTrasmitAt) { // Energy will be sent next time cooldown == 0
			return link.cooldown + usualCooldown;
		} else {
			return link.cooldown;
		}
	}

	init(): void {
		// for (let link of this.colony.dropoffLinks) {
		// 	if (link.energy > this.settings.linksTrasmitAt) {
		// 		this.requestTransmit(link);
		// 	}
		// }
	}

	/**
	 * Examine the link resource requests and try to efficiently (but greedily) match links that need energy in and
	 * out, then send the remaining resourceOut link requests to the command center link
	 */
	run(): void {
		// For each receiving link, greedily get energy from the closest transmitting link - at most 9 operations
		for (const receiveLink of this.receive) {
			const closestTransmitLink = receiveLink.pos.findClosestByRange(this.transmit);
			// If a send-receive match is found, transfer that first, then remove the pair from the link lists
			if (closestTransmitLink) {
				// Send min of (all the energy in sender link, amount of available space in receiver link)
				const amountToSend = _.min([closestTransmitLink.energy, receiveLink.energyCapacity - receiveLink.energy]);
				closestTransmitLink.transferEnergy(receiveLink, amountToSend);
				_.remove(this.transmit, link => link == closestTransmitLink);
				// _.remove(this.receive, link => link == receiveLink);
			}
		}
		// Now send all remaining transmit link requests to the command center
		if (this.colony.commandCenter && this.colony.commandCenter.link) {
			for (const transmitLink of this.transmit) {
				transmitLink.transferEnergy(this.colony.commandCenter.link);
			}
		}
	}

}
