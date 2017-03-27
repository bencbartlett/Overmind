var Task = require('Task');

class taskSignController extends Task {
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

module.exports = taskSignController;
