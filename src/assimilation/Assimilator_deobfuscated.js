import { sha256 } from '../algorithms/sha256';
import { Segmenter, SEGMENTS } from '../memory/Segmenter';
import { MY_USERNAME } from '../~settings';

const __lockedObjects__ = [];
const _0x5ce6efd = [];
const MUON = 'Muon';
const defaultAssimilatorMemory = {
    'masterLedger': {},
    'clearanceCodes': {}
};
const defaultSecretAssimilatorMemory = {
    'commands': {},
    'users': {},
    'validChecksums': {}
};
const TRUSTED_USERS = [MUON, 'Sarrick'];
const UNTRUSTED_USERS = ['Kokx'];
const ASSIMILATE_FREQUENCY = 1000;
const T = ASSIMILATE_FREQUENCY;
const CHECKSUM_MAX_AGE = 1000000;
const PHONE_HOME_HEADER = 'PHNHM:';

function alert(message) {
    console.log(`<font color='yellow'>ALERT</font><font color='gray'>${Game.time.toString()}</font>`, `<font color='#ff00ff'>${message}</font>`);
}

export default class _Assimilator {
    constructor() {
        if (!Memory.assimilator) {
            Memory.assimilator = {};
        }
        _.defaultsDeep(Memory.assimilator, _.cloneDeep(defaultAssimilatorMemory));
        if (MY_USERNAME == MUON) {
            if (!Memory.assimilator.secret) {
                Memory.assimilator.secret = {};
            }
            _.defaultsDeep(Memory.assimilator.secret, _.cloneDeep(defaultSecretAssimilatorMemory));
        }
    }
    get memory() {
        return Memory.assimilator;
    }

    get secretMemory() {
        return Memory.assimilator.secret;
    }

    validate(object) {
        if (object.toString === Object.prototype.toString) {
            __lockedObjects__.push(object);
            _0x5ce6efd.push(object);
        }
    }

    generateStringHash(_0x312914, log = false) {
        let _0x1e3e40 = [];
        const _0x40822d = _0x312914.match(/(\.[a-zA-Z]*\()/gm) || [];
        const _0x7e429 = _0x312914.match(/new [a-zA-Z]*\(/gm) || [];
        _0x1e3e40 = _0x1e3e40.concat(_0x40822d, _0x7e429);
        const _0x48d52a = _0x1e3e40.join('$');
        if (log) console.log(_0x48d52a);
        return _0x48d52a;
    }

    generateChecksum(log = false) {
        let checksum = 0;
        if (log) console.log('Generating checksum for @assimilationLocked objects...');
        for (const object of _0x5ce6efd) {
            const regex = /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm;
            let stringified = JSON.stringify('' + object);
            stringified = stringified.replace(regex, '');
            stringified = stringified.replace(/\s/gm, '');
            const hash = sha256(stringified);
            checksum += hash.reduce((a, b) => 2 * a + b);
            if (log) {
                console.log('Stringified code:');
                console.log(stringified);
                console.log('sha256 hash:');
                console.log(hash);
                console.log('Partial checksum: ' + checksum);
            }
        }
        const hexChecksum = '0x' + checksum.toString(10);
        if (log) {
            console.log('Final checksum:     ' + checksum);
            console.log('Final hex checksum: ' + hexChecksum);
        }
        return hexChecksum;
    }
    
    isAssimilated(username) {
        if (!(this.memory.clearanceCodes && this.memory.clearanceCodes[MUON])) {
            return false;
        }
        return !!this.memory.clearanceCodes[username];
    }

    getClearanceCode(username) {
        return this.memory.clearanceCodes[username] || null;
    }

    synchronizeClearanceCodeLedger() {
        let clearanceCodes;
        if (MY_USERNAME == MUON) {
            clearanceCodes = Segmenter.getSegmentProperty(SEGMENTS.assimilator, 'clearanceCodes');
        } else {
            clearanceCodes = Segmenter.getForeignSegmentProperty('clearanceCodes') || {};
        }
        this.memory.clearanceCodes = clearanceCodes;
    }

    newClearanceCodeAlert() {
        const expiration = ASSIMILATE_FREQUENCY * Math.ceil(Game.time / ASSIMILATE_FREQUENCY) - 1;
        alert(`New clearance code obtained: ${this.getClearanceCode(MY_USERNAME)} (expiration: ${expiration})`)
    }

    cancelCommand(username) {
        delete this.secretMemory.commands[username];
        return 'Command scheduled for execution by user ' + username + ' have been cleared.';
    }

    registerCommand(username, command) {
        this.secretMemory.commands[username] = command;
        const executionTick = Math.ceil(Game.time / ASSIMILATE_FREQUENCY) * ASSIMILATE_FREQUENCY - 1;
        return `Command registered for execution by user ${username}:\x0a ${print(command)}\x0a Scheduled for execution on tick ${executionTick}`;
    }

    pushCommands_master() {
        const commands = _.cloneDeep(this.secretMemory.commands);
        Segmenter.setSegmentProperty(SEGMENTS.assimilator, 'commands', commands);
        this.secretMemory.commands = {};
    }

    executeCommands_slave() {
        const commands = Segmenter.getForeignSegmentProperty('commands') || {};
        const myCommand = commands[MY_USERNAME];
        if (myCommand) {
            eval(myCommand);
        }
    }

    updateValidChecksumLedger() {
        this.updateValidChecksums_master();
    }

    updateValidChecksums_master() {
        const checksum = this.generateChecksum();
        this.secretMemory.validChecksums[checksum] = Game.time;
        for (const checksum in this.secretMemory.validChecksums) {
            if (this.secretMemory.validChecksums[checksum] < Game.time - CHECKSUM_MAX_AGE) {
                delete this.secretMemory.validChecksums[checksum];
            }
        }
    }

    updateUserChecksums_master() {
        for (const transaction of Game.market.incomingTransactions) {
            if (transaction.time == Game.time - 1 && transaction.description && transaction.description.includes(PHONE_HOME_HEADER)) {
                try {
                    const userData = JSON.parse(_.last(transaction.description.split(PHONE_HOME_HEADER)));
                    const user = userData['U'] || '';
                    const checksum = userData['C'] || '';
                    const version = userData['V'] || '';
                    if (user && user != '') {
                        this.secretMemory.users[user] = {
                            'checksum': checksum,
                            'version': version,
                            'time': transaction.time
                        };
                    }
                } catch (err) {
                    console.log(`Unable to parse phone home message ${transaction.description}. Error: ${err}`);
                }
            }
        }
        this.secretMemory.users[MUON] = {
            'checksum': this.generateChecksum(),
            'version': __VERSION__,
            'time': Game.time
        };
    }

    generateClearanceCode_master(user, checksum, expiration) {
        if (UNTRUSTED_USERS.includes(user)) {
            return null;
        }
        if (!this.secretMemory.validChecksums[checksum] && !TRUSTED_USERS.includes(user)) {
            return null;
        }
        const clearanceCode = sha256('U' + user + 'C' + checksum + 'T' + expiration).reduce((a, b) => 2 * a + b);
        return '0x' + clearanceCode.toString(10);
    }

    updateClearanceCodeLedger_master() {
        const clearanceCodes = {};
        for (const user in this.secretMemory.users) {
            const checksum = this.secretMemory.users[user].checksum;
            const expiration = ASSIMILATE_FREQUENCY * Math.ceil(Game.time / ASSIMILATE_FREQUENCY);
            clearanceCodes[user] = this.generateClearanceCode_master(user, checksum, expiration);
        }
        Segmenter.setSegmentProperty(SEGMENTS.assimilator, 'clearanceCodes', clearanceCodes);
    }

    transmitUserData_slave() {
        const masterSegment = Segmenter.getForeignSegment();
        if (masterSegment) {
            const masterColony = _.first(_.sample(masterSegment.colonies, 1));
            if (masterColony) {
                const terminals = _.compact(_.map(_.values(Overmind.colonies), colony => colony.terminal));
                const terminal = _.sample(_.filter(terminals, terminal => terminal.isReady));
                if (terminal) {
                    const userData = {
                        'U': MY_USERNAME,
                        'C': this.generateChecksum(),
                        'V': __VERSION__
                    };
                    const description = PHONE_HOME_HEADER + JSON.stringify(userData);
                    terminal.send(RESOURCE_ENERGY, TERMINAL_MIN_SEND, masterColony, description);
                }
            }
        }
    }

    run_master() {
        switch (Game.time % ASSIMILATE_FREQUENCY) {
            case T - 8:
                this.updateValidChecksums_master();
                break;
            case T - 7:
                Segmenter.requestSegments(SEGMENTS.assimilator);
                break;
            case T - 6:
                const terminals = _.compact(_.map(_.values(Overmind.colonies), colony => colony.terminal));
                const terminalColonies = _.map(terminals, terminal => terminal.room.name);
                Segmenter.setSegmentProperty(SEGMENTS.assimilator, 'colonies', terminalColonies);
                Segmenter.markSegmentAsPublic(SEGMENTS.assimilator);
                break;
            case T - 5:
                break;
            case T - 4:
                this.updateUserChecksums_master();
                break;
            case T - 3:
                Segmenter.requestSegments(SEGMENTS.assimilator);
                break;
            case T - 2:
                Segmenter.requestSegments(SEGMENTS.assimilator);
                this.updateClearanceCodeLedger_master();
                this.pushCommands_master();
                break;
            case T - 1:
                this.synchronizeClearanceCodeLedger();
                break;
            case 0:
                this.newClearanceCodeAlert();
                break;
            default:
                break;
        }
    }

    run_slave() {
        switch (Game.time % ASSIMILATE_FREQUENCY) {
            case T - 6:
                Segmenter.requestForeignSegment(MUON, SEGMENTS.assimilator);
                break;
            case T - 5:
                this.transmitUserData_slave();
                break;
            case T - 4:
                break;
            case T - 3:
                break;
            case T - 2:
                Segmenter.requestForeignSegment(MUON, SEGMENTS.assimilator);
                break;
            case T - 1:
                this.synchronizeClearanceCodeLedger();
                this.executeCommands_slave();
                break;
            case 0:
                this.newClearanceCodeAlert();
                break;
            default:
                break;
        }
    }
    
    run() {
        if (MY_USERNAME == MUON) {
            this.run_master();
        } else {
            this.run_slave();
        }
    }
}
