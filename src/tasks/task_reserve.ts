import {Task} from "./Task";

export class taskReserve extends Task {
    target: StructureController;

    constructor() {
        super('reserve');
        // Settings
        this.moveColor = 'purple';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(CLAIM) > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && (!target.reservation || target.reservation.ticksToEnd < 4999 ));
    }

    work() {
        return this.creep.reserveController(this.target);
    }
}

