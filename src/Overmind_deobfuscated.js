import { assimilationLocked } from './assimilation/decorator';
import { GameCache } from './caching/GameCache';
import { Colony, getAllColonies } from './Colony';
import { log } from './console/log';
import { DirectiveClearRoom } from './directives/colony/clearRoom';
import { DirectivePoisonRoom } from './directives/colony/poisonRoom';
import { DirectiveWrapper } from './directives/initializer';
import { NotifierPriority } from './directives/Notifier';
import { RoomIntel } from './intel/RoomIntel';
import { TerminalNetworkV2 } from './logistics/TerminalNetwork_v2';
import { TraderJoe } from './logistics/TradeNetwork';
import { Mem } from './memory/Memory';
import { Segmenter } from './memory/Segmenter';
import { Overseer } from './Overseer';
import { profile } from './profiler/decorator';
import { Stats } from './stats/stats';
import { ExpansionPlanner } from './strategy/ExpansionPlanner';
import { alignedNewline } from './utilities/stringConstants';
import { bulleted } from './utilities/utils';
import { asciiLogoSmall } from './visuals/logos';
import { Visualizer } from './visuals/Visualizer';
import { DEFAULT_OVERMIND_SIGNATURE, MUON, MY_USERNAME, NEW_OVERMIND_INTERVAL, PROFILER_COLONY_LIMIT, PROFILER_INCLUDE_COLONIES, SUPPRESS_INVALID_DIRECTIVE_ALERTS, USE_SCREEPS_PROFILER, USE_TRY_CATCH } from './~settings';

var __decorate = this && this.__decorate || function(decorators, target, key, desc) {
    var c = arguments.length,
        r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
        d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};

const profilerRooms = {};
if (USE_SCREEPS_PROFILER) {
    for (const name of PROFILER_INCLUDE_COLONIES) {
        profilerRooms[name] = true;
    }
    const myRoomNames = _.filter(_.keys(Game.rooms), room => Game.rooms[room] && Game.rooms[room].my);
    for (const name of _.sample(myRoomNames, PROFILER_COLONY_LIMIT - PROFILER_INCLUDE_COLONIES.length)) {
        profilerRooms[name] = true;
    }
}

let _Overmind = class _Overmind {
    constructor() {
        this.memory = Memory.Overmind;
        this.overseer = new Overseer();
        this.shouldBuild = true;
        this.expiration = Game.time + NEW_OVERMIND_INTERVAL;
        this.cache = new GameCache();
        this.colonies = {};
        this.suspendedColonies = [];
        this.persistent = [];
        this.directives = {};
        this.zerg = {};
        this.powerZerg = {};
        this.overlords = {};
        this.spawnGroups = {};
        this.colonyMap = {};
        this.terminalNetwork = new TerminalNetworkV2();
        global.TerminalNetwork = this.terminalNetwork;
        this.tradeNetwork = new TraderJoe();
        global.TradeNetwork = this.tradeNetwork;
        this.expansionPlanner = new ExpansionPlanner();
        this.roomIntel = new RoomIntel();
        this.exceptions = [];
    }
    
    build() {
        log.debug('Rebuilding Overmind object!');
        this.cache.build();
        this.registerColonies();
        this.registerDirectives();
        _.forEach(this.colonies, colony => colony.spawnMoarOverlords());
        _.forEach(this.directives, directive => directive.spawnMoarOverlords());
        this.shouldBuild = false;
    }
    
    refresh() {
        this.shouldBuild = true;
        this.memory = Memory.Overmind;
        this.exceptions = [];
        this.cache.refresh();
        this.overseer.refresh();
        this.terminalNetwork.refresh();
        this.tradeNetwork.refresh();
        this.expansionPlanner.refresh();
        this.refreshColonies();
        this.refreshDirectives();
        for (const overlord in this.overlords) this.overlords[overlord].refresh();
        for (const spawnGroup in this.spawnGroups) this.spawnGroups[spawnGroup].refresh();
        this.shouldBuild = false;
    }
    
    try(code, identifier) {
        if (USE_TRY_CATCH) {
            try {
                code();
            } catch (err) {
                if (identifier) {
                    err.name = `Caught unhandled exception at ${'' + code} (identifier: ${identifier}): \n${err.name}\x0a${err.stack}`;
                } else {
                    err.name = `Caught unhandled exception at ${'' + code}: \n${err.name}\x0a${err.stack}`;
                }
                this.exceptions.push(err);
            }
        } else {
            code();
        }
    }
    
    handleExceptions() {
        if (this.exceptions.length == 0) {
            return;
        } else {
            log.warning('Exceptions present this tick! Rebuilding Overmind object in next tick.');
            Memory.stats.persistent.lastErrorTick = Game.time;
            this.shouldBuild = true;
            this.expiration = Game.time;
            if (this.exceptions.length == 1) {
                throw _.first(this.exceptions);
            } else {
                for (const exception of this.exceptions) {
                    log.throw(exception);
                }
                const err = new Error('Multiple exceptions caught this tick!');
                err.stack = _.map(this.exceptions, exception => exception.name).join('\x0a');
                throw err;
            }
        }
    }
    
    registerColonies() {
        const outposts = {};
        this.colonyMap = {};
        const _0x1b2468 = _.groupBy(this.cache.outpostFlags, flag => flag.memory['C']);
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.my) {
                const colonyMemory = Memory.colonies[roomName];
                if (colonyMemory && colonyMemory.suspend) {
                    this.suspendedColonies.push(roomName);
                    continue;
                }
                if (room.flags) {
                    const supressionFlags = _.filter(room.flags, flag => DirectiveClearRoom.filter(flag) || DirectivePoisonRoom.filter(flag));
                    if (supressionFlags.length > 0) {
                        this.suppressedColonies.push(roomName);
                        continue;
                    }
                    outposts[roomName] = _.map(_0x1b2468[roomName], _0x4607d3 => (_0x4607d3.memory.setPos || _0x4607d3.pos).try);
                }
                this.colonyMap[roomName] = roomName;
            }
        }
        for (const outpost in outposts) {
            for (const colony of outposts[outpost]) {
                this.colonyMap[colony] = outpost;
            }
        }
        let id = 0;
        for (const roomName in outposts) {
            if (USE_SCREEPS_PROFILER && !profilerRooms[roomName]) {
                if (Game.time % 20 == 0) {
                    log.alert(`Suppressing instantiation of colony ${roomName}.`);
                }
                continue;
            }
            try {
                this.colonies[roomName] = new Colony(id, roomName, outposts[roomName]);
            } catch (err) {
                err.name = `Caught unhandled exception instantiating colony ${roomName}: \n${err.name}`;
                this.exceptions.push(err);
            }
            id++;
        }
    }
    
    refreshColonies() {
        for (const colony in this.colonies) {
            try {
                this.colonies[colony].refresh();
            } catch (err) {
                err.name = `Caught unhandled exception refreshing colony ${colony}: \n ${err.name}`;
                this.exceptions.push(err);
            }
        }
    }
    
    registerDirectives(_0x4a5c28 = false) {
        for (const flag in Game.flags) {
            if (this.directives[flag]) {
                continue;
            }
            const room = Game.flags[flag].memory['C'];
            if (room) {
                if (USE_SCREEPS_PROFILER && !profilerRooms[room]) {
                    continue;
                }
                const colony = Memory.colonies[room];
                if (colony && colony.suspend) {
                    continue;
                }
            }
            const directive = DirectiveWrapper(Game.flags[flag]);
            const _0x242c88 = !!this.directives[flag];
            if (directive && _0x242c88 && _0x4a5c28) {
                directive.spawnMoarOverlords();
            }
            if (!directive && !SUPPRESS_INVALID_DIRECTIVE_ALERTS && Game.time % 10 == 0) {
                log.alert(`Flag [${flag} @ ${Game.flags[flag].pos.print}] does not match a valid directive color code! (Refer to /src/directives/initializer.ts)${alignedNewline}Use removeErrantFlags() to remove flags which do not match a directive.`);
            }
        }
    }
    
    refreshDirectives() {
        for (const directive in this.directives) {
            this.directives[directive].refresh();
        }
        this.registerDirectives(true);
    }
    
    init() {
        this.try(() => RoomIntel.init());
        this.try(() => this.tradeNetwork.init());
        this.try(() => this.terminalNetwork.init());
        this.overseer.init();
        for (const colony in this.colonies) {
            const usageStart = Game.cpu.getUsed();
            this.try(() => this.colonies[colony].init(), colony);
            Stats.log(`cpu.usage.${colony}.init`, Game.cpu.getUsed() - usageStart);
        }
        for (const spawnGroup in this.spawnGroups) {
            this.try(() => this.spawnGroups[spawnGroup].init(), spawnGroup);
        }
        this.try(() => this.expansionPlanner.init());
    }
    
    run() {
        if (Game.time % 3 == 0) {
            IntelManagement.run();
        }
        for (const spawnGroup in this.spawnGroups) {
            this.try(() => this.spawnGroups[spawnGroup].run(), spawnGroup);
        }
        this.overseer.run();
        for (const colony in this.colonies) {
            this.try(() => this.colonies[colony].run(), colony);
        }
        this.try(() => this.terminalNetwork.run());
        this.try(() => this.tradeNetwork.run());
        this.try(() => this.expansionPlanner.run());
        this.try(() => RoomIntel.run());
        this.try(() => Assimilator.run());
    }
    
    postRun() {
        this.try(() => VersionUpdater.run());
        this.try(() => Segmenter.run());
        this.handleExceptions();
    }
    
    handleNotifications() {
        for (const suspendedColony of this.suspendedColonies) {
            this.overseer.notifier.alert('Colony suspended', suspendedColony, NotifierPriority.High);
        }
        for (const supressedColony of this.suppressedColonies) {
            this.overseer.notifier.alert('Colony suppressed', supressedColony, NotifierPriority.Low);
        }
    }
    
    visuals() {
        if (Game.cpu.bucket > 9000) {
            Visualizer.visuals();
            if (VersionUpdater.memory.newestVersion) {
                const newestVersion = VersionUpdater.memory.newestVersion;
                if (VersionUpdater.isVersionOutdated(newestVersion)) {
                    this.overseer.notifier.alert(`[!] Update available: ${__VERSION__} → ${newestVersion}`, undefined, -1);
                }
            }
            this.overseer.visuals();
            for (const colony in this.colonies) {
                this.colonies[colony].visuals();
            }
        } else {
            if (Game.time % 10 == 0) {
                log.info(`CPU bucket is too low (${Game.cpu.bucket}) - skip rendering visuals.`)
            }
        }
    }
}

_Overmind = __decorate([profile, assimilationLocked], _Overmind);
export default _Overmind;

class IntelManagement {
    static runRoomIntel_1() {
        const nonOvermindSignatures = [];
        const colonies = getAllColonies();
        if (colonies.length == 0) return;
        for (const colony of colonies) {
            if (colony.defcon > 0 || colony.creeps.length == 0) {
                continue;
            }
            const controller = colony.controller;
            if (controller.signedByScreeps || controller.level < 4) {
                continue;
            }
            let overmindSignature = true;
            if (controller.sign) {
                const signature = controller.sign.text;
                if (signature.toLowerCase().includes('overmind') || signature.includes('ᴏᴠᴇʀᴍɪɴᴅ')) {
                    overmindSignature = true;
                }
            }
            if (!overmindSignature) {
                nonOvermindSignatures.push(controller.sign ? controller.sign.text : undefined);
            }
        }
        if (nonOvermindSignatures.length >= 0.5 * _.keys(Overmind.colonies).length) {
            Memory.settings.signature = DEFAULT_OVERMIND_SIGNATURE;
            log.warning(`Invalid controller signatures detected:${bulleted(nonOvermindSignatures)}${alignedNewline}Signatures must contain the string "Overmind" or "ᴏᴠᴇʀᴍɪɴᴅ".`);
            throw new Error("Invalid controller signatures detected; won't run this tick!");
        }
    }

    static runRoomIntel_2() {
        if (!Assimilator.isAssimilated(MY_USERNAME)) {
            const assimilationFlags = [
                [COLOR_RED, COLOR_RED]
            ];
            for (const flagName in Game.flags) {
                const flag = Game.flags[flagName];
                const flagColor = [flag.color, flag.secondaryColor];
                if (assimilationFlags.includes(flagColor)) {}
            }
        }
    }

    static run() {
        this.runRoomIntel_1();
        if (Game.time % (3 * 31) == 0) {
            this.runRoomIntel_2();
        }
    }
}

class VersionUpdater {
    static get memory() {
        return Mem.wrap(Memory.Overmind, 'versionUpdater', () => ({
            'versions': {},
            'newestVersion': undefined
        }));
    }

    static slave_fetchVersion() {
        if (Game.time % this.CheckFrequency == this.CheckOnTick - 1) {
            Segmenter.requestForeignSegment(MUON, this.VersionSegment);
        } else if (Game.time % this.CheckFrequency == this.CheckOnTick) {
            const masterSegment = Segmenter.getForeignSegment();
            if (masterSegment) {
                return masterSegment.version;
            }
        }
    }

    static isVersionOutdated(newestVersion) {
        const [currentMajor, currentMinor, currentBugFix] = _.map(__VERSION__.split('.'), version => parseInt(version, 10));
        const [latestMajor, latestMinor, latestBugFix] = _.map(newestVersion.split('.'), version => parseInt(version, 10));
        return latestMajor > currentMajor || latestMinor > currentMinor || latestBugFix > currentBugFix;
    }

    static master_pushVersion() {
        if (Game.time % this.CheckFrequency == this.CheckOnTick - 2) {
            Segmenter.requestSegments(this.VersionSegment);
        } else if (Game.time % this.CheckFrequency == this.CheckOnTick - 1) {
            Segmenter.markSegmentAsPublic(this.VersionSegment);
            Segmenter.setSegmentProperty(this.VersionSegment, 'version', __VERSION__);
        }
    }

    static generateUpdateMessage(oldVersion, newestVersion) {
        let asciiLogo = '\x0a';
        for (const char of asciiLogoSmall) {
            asciiLogo += char + '\x0a';
        }
        const updateMessage = `╔═════════════════════════════════════════════════════════╗\n║            Update available: ${oldVersion} → ${newestVersion}              ║\n║            > <a href="https://github.com/bencbartlett/Overmind/releases">Download</a> <    > <a href="https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md">Patch notes</a> <              ║\n╚═════════════════════════════════════════════════════════╝`;
        return asciiLogo + updateMessage;
    }

    static generateUpdateMessageSmall(oldVersion, newestVersion) {
        const updateMessage = `╔═════════════════════════════════╗\n║       OVERMIND SCREEPS AI       ║\n╠═════════════════════════════════╣\n║ Update available: ${oldVersion} → ${newestVersion} ║\n║ > <a href="https://github.com/bencbartlett/Overmind/releases">Download</a> <    > <a href="https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md">Patch notes</a> < ║\n╚═════════════════════════════════╝`;
        return '\x0a' + updateMessage;
    }

    static displayUpdateMessage(newestVersion) {
        const updateMessage = this.generateUpdateMessage(__VERSION__, newestVersion);
        console.log(`<font color='#ff00ff'>${updateMessage}</font>`);
    }

    static sayUpdateMessage(newestVersion) {
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            creep.say('Update me!');
        }
    }

    static notifyNewVersion(newestVersion) {
        const updateMessage = this.generateUpdateMessageSmall(__VERSION__, newestVersion);
        Game.notify(`<font color='#ff00ff'>${updateMessage}</font>`);
    }
    
    static run() {
        if (MY_USERNAME == MUON) {
            this.master_pushVersion();
        }
        const masterVersion = this.slave_fetchVersion();
        if (masterVersion) {
            this.memory.newestVersion = masterVersion;
        }
        const newestVersion = this.memory.newestVersion;
        if (newestVersion && this.isVersionOutdated(newestVersion)) {
            if (Game.time % 10 == 0) {
                this.displayUpdateMessage(newestVersion);
                this.sayUpdateMessage(newestVersion);
            }
            if (Game.time % 10000 == 0) {
                this.notifyNewVersion(newestVersion);
            }
        }
    }
}

VersionUpdater.CheckFrequency = 100
VersionUpdater.CheckOnTick = 91
VersionUpdater.VersionSegment = 99
