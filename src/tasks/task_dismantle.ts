// var flagCodes = require('map_flag_codes.js');
import {Task} from "./Task";

type targetType = Structure;
export class taskDismantle extends Task {
    target: targetType;

    constructor(target: targetType) {
        super('dismantle', target);
        // Settings
        this.maxPerTarget = 3;
        this.moveColor = 'red';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(WORK) > 0);
    }

    isValidTarget() {
        let target = this.target;
        return target && target.hits > 0;
    }

    work() {
        return this.creep.dismantle(this.target);
    }
}
