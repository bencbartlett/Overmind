import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {CombatPlanner, SiegeAnalysis} from '../../strategy/CombatPlanner';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

interface DirectiveAutoSiegeMemory extends FlagMemory {
	siegeAnalysis?: SiegeAnalysis;
}

/**
 * Automatic siege directive: uses scouting/observer data to determine an appropriate offensive strike level,
 * then sieges the targeted room until it is no longer claimed
 */
@profile
export class DirectiveAutoSiege extends Directive {

	static directiveName = 'autoSiege';
	static color = COLOR_RED;
	static secondaryColor = COLOR_ORANGE; // todo

	memory: DirectiveAutoSiegeMemory;

	// overlords: {
	// 	scout?: StationaryScoutOverlord;
	// 	destroy?: SwarmDestroyerOverlord | PairDestroyerOverlord;
	// 	guard?: OutpostDefenseOverlord;
	// 	controllerAttack?: ControllerAttackerOverlord;
	// };

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		// this.overlords.destroy = new SwarmDestroyerOverlord(this);
	}

	init(): void {
		this.alert(`Auto-siege directive active`);
		if (!this.memory.siegeAnalysis || Game.time > this.memory.siegeAnalysis.expiration) {
			if (this.room) {
				// Register a siege analysis
				this.memory.siegeAnalysis = CombatPlanner.getSiegeAnalysis(this.room);
			} else {
				// Obtain vision of room
				if (this.colony.commandCenter && this.colony.commandCenter.observer) {
					this.colony.commandCenter.requestRoomObservation(this.pos.roomName);
				} else {
					// todo
				}
			}
		}
	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			log.notify(`Auto-siege operation at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
	}

}
