import {Task} from "./Task";

type targetType = Controller;
export class taskSignController extends Task {
    target: targetType;

    constructor(target: targetType) {
        super('signController', target);
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

