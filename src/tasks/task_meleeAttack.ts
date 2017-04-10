import {Task} from "./Task";

export class taskMeleeAttack extends Task {
    target: Creep | Structure;
    constructor() {
        super('meleeAttack');
        // Settings
        this.moveColor = 'red';
        this.targetRange = 1;
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(ATTACK) > 0 && (this.creep.room.hostiles.length > 0 ||
                                                              this.creep.room.hostileStructures.length > 0));
    }

    isValidTarget() {
        var target = this.target;
        return (target && target.hits && target.hits > 0); // && target.my == false);
    }

    work() {
        return this.creep.attack(this.target);
    }
}
