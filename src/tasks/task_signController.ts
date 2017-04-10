import {Task} from "./Task";

export class taskSignController extends Task {
    target: StructureController;

    constructor() {
        super('signController');
        // Settings
        this.moveColor = 'purple';
    }

    isValidTask() {
        return true;
    }

    isValidTarget() {
        let controller = this.target;
        return (!controller.sign || controller.sign.text != controllerSignature)
    }

    work() {
        return this.creep.signController(this.target, controllerSignature);
    }
}

