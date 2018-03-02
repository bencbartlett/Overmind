import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Colony} from '../../Colony';
import {BufferTarget, LogisticsGroup} from '../../logistics/LogisticsGroup';
import {TransporterSetup} from '../../creepSetup/defaultSetups';
import {OverlordPriority} from '../priorities_overlords';


export class TransportOverlord extends Overlord {

	transporters: Zerg[];
	logisticsGroup: LogisticsGroup;

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.haul) {
		super(colony, 'logistics', priority);
		this.transporters = this.creeps(TransporterSetup.role);
		this.logisticsGroup = new LogisticsGroup(colony); //colony.logisticsGroup;
	}

	init() {
		let haulingPower = _.sum(_.map(this.lifetimeFilter(this.transporters),
									   creep => creep.getActiveBodyparts(CARRY)));
		let needed = this.colony.miningGroups![this.colony.storage!.ref].data.haulingPowerNeeded;
		if (haulingPower < needed) {
			this.requestCreep(new TransporterSetup());
		}
		this.creepReport(TransporterSetup.role, haulingPower, needed);
	}


	private handleTransporter(transporter: Zerg) {
		let request = this.logisticsGroup.matching[transporter.name];
		if (request) {
			let choices = this.logisticsGroup.bufferChoices(transporter, request);
			let bestChoice = _.last(_.sortBy(choices, choice => choice.deltaResource / choice.deltaTicks));
			let task = null;
			if (request.amount > 0) { // request needs refilling
				if (request.target instanceof Flag) {
					task = Tasks.drop(request.target);
				} else {
					task = Tasks.deposit(request.target);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget;
					let oldTask = task;
					task = Tasks.withdraw(buffer);
					task.parent = oldTask;
				}
			} else if (request.amount < 0) { // request needs withdrawal
				if (request.target instanceof Flag) {
					let resource = request.target.pos.lookFor(LOOK_RESOURCES)[0]; // TODO: include resourceType
					if (!resource) return;
					task = Tasks.pickup(resource);
				} else {
					task = Tasks.withdraw(request.target);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget;
					let oldTask = task;
					task = Tasks.deposit(buffer);
					task.parent = oldTask;
				}
			}
			transporter.task = task;
		}
	}


	run() {
		for (let transporter of this.transporters) {
			if (transporter.isIdle) {
				this.handleTransporter(transporter);
			}
			if (transporter.task) {
				transporter.say(`${transporter.task.name[0]}:${transporter.task.targetPos.x},${transporter.task.targetPos.y},${transporter.task.targetPos.roomName}`);
			}
		}
	}

}