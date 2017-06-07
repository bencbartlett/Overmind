// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {Objective} from './Objective';


export class ObjectiveGroup implements IObjectiveGroup {

	private flatObjectives: Objective[];
	private finalized: boolean;
	private _objectives: { [objectiveName: string]: Objective[] };
	private _objectivesByRef: { [objectiveRef: string]: Objective };
	objectivePriorities: string[];

	constructor(objectivePriorities: string[]) {
		this.flatObjectives = [];
		this.objectivePriorities = objectivePriorities;
	}

	registerObjectives(...args: Objective[][]): void {
		// Register an arbitrary number of lists of objectives, adding each objective to the flattened objectives list
		this.finalized = false;
		for (let objectivesList of args) {
			this.flatObjectives = this.flatObjectives.concat(objectivesList);
		}
	}

	finalizeObjectives(): void {
		// Prepare the grouped objectives. For best performance, registerObjectives should only be called once.
		this._objectivesByRef = _.indexBy(this.flatObjectives, 'ref');
		this._objectives = _.groupBy(this.flatObjectives, objective => objective.name);
		this.finalized = true;
	}

	get objectives(): { [objectiveName: string]: Objective[] } {
		if (!this.finalized) {
			this.finalizeObjectives();
		}
		return this._objectives;
	}

	get objectivesByRef(): { [objectiveRef: string]: Objective } {
		if (!this.finalized) {
			this.finalizeObjectives();
		}
		return this._objectivesByRef;
	}

	assignTask(creep: ICreep): void {
		// Find the best available objective of the highest priority and assign it to a requesting creep
		if (!this.finalized) { // Make sure you have the obdated objectives and objectivesByRef objects
			this.finalizeObjectives();
		}
		// Scan through objectives in decreasing priority
		for (let objType of this.objectivePriorities) {
			let objectives = this.objectives[objType];
			if (!objectives ||
				(objectives[0] && !objectives[0].assignableToRoles.includes(creep.memory.role))) {
				continue; // If this type of objective isn't available to this role, move to the next type
			}
			let possibleObjectives: Objective[] = [];
			for (let i in objectives) {
				let objective = objectives[i];
				// Verify the objective is assignable to this creep and that it's not already at max assignees
				if (objective.assignableTo(creep) && objective.creepNames.length < objective.maxCreeps) {
					possibleObjectives.push(objectives[i]);
				}
			}
			if (possibleObjectives.length > 0) {
				// Find closest objective by position
				let distance = Infinity;
				let bestDistance = Infinity;
				let bestObjective;
				for (let objective of possibleObjectives) {
					distance = creep.pos.getMultiRoomRangeTo(objective.pos);
					if (distance < bestDistance) {
						bestDistance = distance;
						bestObjective = objective;
					}
				}
				if (bestObjective) {
					return bestObjective.assignTo(creep);
				}
			}
		}
	}
}

