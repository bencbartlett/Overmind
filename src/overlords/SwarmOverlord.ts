import {CombatOverlord} from './CombatOverlord';
import {Swarm} from '../zerg/Swarm';
import {CreepSetup} from '../creepSetups/CreepSetup';
import {profile} from '../profiler/decorator';

/**
 * SwarmOverlords extend the base CombatOverlord class, providing additional methods for spawning and controlling swarms
 */
@profile
export abstract class SwarmOverlord extends CombatOverlord {

	memory: any; 						// swarm overlords must have a memory property
	swarms: { [ref: string]: Swarm };

	/* Wishlist of creeps to simplify spawning logic; includes automatic reporting */

	// TODO: at the moment, this assumes that every swarm within an overlord is the same configuration
	protected swarmWishlist(swarmQuantity: number, config: { setup: CreepSetup, amount: number, priority?: number }[]) {
		// Make tables to log current and needed creep quantities
		let creepQuantities: { [role: string]: number } = {};
		let neededQuantities: { [role: string]: number } = {};

		// Handle filling out existing swarms first
		let validSwarms = _.filter(this.swarms, swarm => !swarm.isExpired);
		for (let swarm of validSwarms) {
			for (let creepType of config) {
				let {setup, amount} = creepType;
				let priority = creepType.priority || this.priority;
				let existingCreepsOfRole = _.filter(swarm.creeps, creep => creep.roleName == setup.role);
				// Log current and needed amounts for reporting
				if (!creepQuantities[setup.role]) creepQuantities[setup.role] = 0;
				creepQuantities[setup.role] += existingCreepsOfRole.length;
				if (!neededQuantities[setup.role]) neededQuantities[setup.role] = 0;
				neededQuantities[setup.role] += amount;
				// Spawn the neede quantity of creeps
				let spawnQuantity = amount - existingCreepsOfRole.length;
				for (let i = 0; i < spawnQuantity; i++) {
					this.requestCreep(setup, {priority: priority});
				}
			}
		}

		// Spawn new swarms as needed
		let numRemainingSwarms = swarmQuantity - validSwarms.length;
		for (let n = 0; n < numRemainingSwarms; n++) {
			for (let creepType of config) {
				let {setup, amount} = creepType;
				let priority = creepType.priority || this.priority;
				if (!neededQuantities[setup.role]) neededQuantities[setup.role] = 0;
				neededQuantities[setup.role] += amount;
				for (let i = 0; i < amount; i++) {
					this.requestCreep(setup, {priority: priority + 0.5});
				}
			}
		}

		// Report creep amounts
		for (let role of _.keys(neededQuantities)) {
			this.creepReport(role, creepQuantities[role] || 0, neededQuantities[role]);
		}
	}

	abstract makeSwarms(): void

}

