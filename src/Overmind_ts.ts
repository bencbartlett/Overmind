// javascript-obfuscator:disable
//
// Overmind_obfuscated.js: this file is intentially obfuscated to prevent tampering.
//
// Q: Why is this file obfuscated?
//
// A: Using Overmind as your AI puts you at a huge advantage if you are a new player in a novice zone. Screeps has
//    always had problems with people downloading bots from the internet and stomping new players. I have kept Overmind
//    open-sourced because I think it can be a good resource for learning how to play Screeps, but I don't want it to
//    be abused as a noob-crushing machine. In the future, I will be implementing behavioral locks in this file which
//    limit unreasonable aggression toward peaceful new players.
//
// Q: What kind of behavioral locks?
//
// A: Players will be able to opt out of aggression by setting a property in their public memory. Overmind bots will not
//    attack the player unless they attack you, claim a room in Overmind's territory, or occupy a room which is
//    critically important (for example, very desirable mineral deposits that aren't available elsewhere). Overmind
//    will attempt to expand around players which pose no threat to it rather than eliminating them.
//
// Q: What does this file do?
//
// A: The Overmind object is the top-level initializer of the AI and instantiates all colonies and directives. It is
//    also responsible for some high-level decision making. You can see the enumerated properties of the Overmind class
//    in IOvermind in declarations/index.d.ts. Since this file is sufficiently complex and is critical for the AI to be
//    able to run, it was a natural choice of location to put code which should be tamper-resistant.
//
// Q: What happens if I modify this code?
//
// A: This code is self-defending, so any modification to it will likely break the script.
//
// Q: I would like to view the original source code for this file.
//
// A: If you have a compelling reason that you'd like to see the non-obfuscated source for this file, message me in
//    game, on slack, or send me an email at benbartlett@stanford.edu.
//

import {Colony, ColonyMemory, getAllColonies} from './Colony';
import {DirectiveWrapper} from './directives/initializer';
import {profile} from './profiler/decorator';
import {GameCache} from './caching/GameCache';
import {Overlord} from './overlords/Overlord';
import {Visualizer} from './visuals/Visualizer';
import {Stats} from './stats/stats';
import {TerminalNetwork} from './logistics/TerminalNetwork';
import {AllContracts} from './contracts/contractsList';
import {Autonomy, getAutonomyLevel, Mem} from './memory/Memory';
import {asciiLogoSmall} from './visuals/logos';
import {log} from './console/log';
import {TraderJoe} from './logistics/TradeNetwork';
import {RoomIntel} from './intel/RoomIntel';
import {
	DEFAULT_OVERMIND_SIGNATURE,
	MUON,
	MY_USERNAME,
	NEW_OVERMIND_INTERVAL,
	PROFILER_COLONY_LIMIT,
	PROFILER_INCLUDE_COLONIES,
	USE_PROFILER,
	USE_TRY_CATCH
} from './~settings';
import {Strategist} from './strategy/Strategist';
import {assimilationLocked} from './assimilation/decorator';
import {SpawnGroup} from './logistics/SpawnGroup';
import {alignedNewline} from './utilities/stringConstants';
import {bulleted} from './utilities/utils';
import {Directive} from './directives/Directive';
import {Zerg} from './zerg/Zerg';
import {Segmenter} from './memory/Segmenter';
import {Overseer} from './Overseer';
import {NotifierPriority} from './directives/Notifier';

//  javascript-obfuscator:enable

let profilerRooms: { [roomName: string]: boolean } = {};
if (USE_PROFILER) {
	for (let name of PROFILER_INCLUDE_COLONIES) {
		profilerRooms[name] = true;
	}
	let myRoomNames = _.filter(_.keys(Game.rooms), name => Game.rooms[name] && Game.rooms[name].my);
	for (let name of _.sample(myRoomNames, PROFILER_COLONY_LIMIT - PROFILER_INCLUDE_COLONIES.length)) {
		profilerRooms[name] = true;
	}
}

@profile
@assimilationLocked
export default class _Overmind implements IOvermind {

	memory: IOvermindMemory;
	overseer: Overseer;
	shouldBuild: boolean;
	expiration: number;
	cache: GameCache;
	colonies: { [roomName: string]: Colony };				// Global hash of all colony objects
	directives: { [flagName: string]: Directive };
	zerg: { [creepName: string]: Zerg };
	overlords: { [ref: string]: Overlord };
	spawnGroups: { [ref: string]: SpawnGroup };
	colonyMap: { [roomName: string]: string };				// Global map of colony associations for possibly-null rooms
	terminalNetwork: TerminalNetwork;
	tradeNetwork: TraderJoe;
	strategist: Strategist | undefined;
	exceptions: Error[];

	constructor() {
		this.memory = Memory.Overmind as IOvermindMemory;
		this.overseer = new Overseer();
		this.shouldBuild = true;
		this.expiration = Game.time + NEW_OVERMIND_INTERVAL;
		this.cache = new GameCache();
		this.colonies = {};
		this.directives = {};
		this.zerg = {};
		this.overlords = {};
		this.spawnGroups = {};
		this.colonyMap = {};
		this.terminalNetwork = this.makeTerminalNetwork();
		this.tradeNetwork = new TraderJoe();
		this.strategist = getAutonomyLevel() > Autonomy.Manual ? new Strategist() : undefined;
		this.exceptions = [];
	}

	/* Global instantiation of Overmind object; run once every global refresh */
	build(): void {
		log.debug(`Rebuilding Overmind object!`);
		this.cache.build();
		// Register all colonies and instantiate their overlords
		this.registerColonies();
		_.forEach(this.colonies, colony => colony.spawnMoarOverlords());
		// Register directives and instantiate their overlords; must be done AFTER colonies
		this.registerDirectives();
		_.forEach(this.directives, directive => directive.spawnMoarOverlords());
		this.shouldBuild = false;
	}

	/* Refresh the state of the Overmind; run at the beginning of every tick */
	refresh(): void {
		this.shouldBuild = true; // assume refresh will be unsuccessful
		// Refresh constructor-phase objects
		this.memory = Memory.Overmind as IOvermindMemory;
		this.exceptions = [];
		this.cache.refresh();
		this.overseer.refresh();
		this.terminalNetwork.refresh();
		this.tradeNetwork.refresh();
		if (this.strategist) this.strategist.refresh();
		// Refresh build-phase objects
		this.refreshColonies();
		this.refreshDirectives();
		for (let ref in this.overlords) {
			this.overlords[ref].refresh();
		}
		for (let ref in this.spawnGroups) {
			this.spawnGroups[ref].refresh();
		}
		this.shouldBuild = false; // refresh successful
	}

	private try(callback: () => any, identifier?: string): void {
		if (USE_TRY_CATCH) {
			try {
				callback();
			} catch (e) {
				if (identifier) {
					e.name = `Caught unhandled exception at ${'' + callback} (identifier: ${identifier}): \n`
							 + e.name + '\n' + e.stack;
				} else {
					e.name = `Caught unhandled exception at ${'' + callback}: \n` + e.name + '\n' + e.stack;
				}
				this.exceptions.push(e);
			}
		} else {
			callback();
		}
	}

	private handleExceptions(): void {
		if (this.exceptions.length == 0) {
			return;
		} else {
			log.warning(`Exceptions present this tick! Rebuilding Overmind object in next tick.`);
			Memory.stats.persistent.lastErrorTick = Game.time;
			this.shouldBuild = true;
			this.expiration = Game.time;
			if (this.exceptions.length == 1) {
				throw _.first(this.exceptions);
			} else {
				for (let e of this.exceptions) {
					log.throw(e);
				}
				let error = new Error('Multiple exceptions caught this tick!');
				error.stack = _.map(this.exceptions, e => e.name).join('\n');
				throw error;
			}
		}
	}

	private makeTerminalNetwork(): TerminalNetwork {
		// Initialize the terminal netowrk
		let terminals: StructureTerminal[] = [];
		for (let name in Game.rooms) {
			if (USE_PROFILER && !profilerRooms[name]) continue;
			let room = Game.rooms[name];
			if (room.my && room.controller!.level >= 6 && room.terminal && room.terminal.my) {
				terminals.push(room.terminal);
			}
		}
		return new TerminalNetwork(terminals);
	}


	/* Instantiate a new colony for each owned rom */
	private registerColonies(): void {

		let colonyOutposts: { [roomName: string]: string[] } = {}; // key: lead room, values: outposts[]
		this.colonyMap = {};
		// Register colonies to their outposts
		let flagsByRoom = _.groupBy(this.cache.outpostFlags, flag => flag.memory[_MEM.COLONY]);
		for (let name in Game.rooms) {
			if (Game.rooms[name].my) {
				let colonyMemory = Memory.colonies[name] as ColonyMemory | undefined;
				if (colonyMemory && colonyMemory.suspend) {
					this.overseer.notifier.alert("Colony suspended", name, NotifierPriority.High);
					continue;
				}
				if (Game.rooms[name].flags)
				colonyOutposts[name] = _.map(flagsByRoom[name],
											 flag => flag.memory.setPosition
													 ? derefRoomPosition(flag.memory.setPosition).roomName
													 : flag.pos.roomName);
				this.colonyMap[name] = name;
			}
		}
		// Register outposts to their colonies
		for (let colonyName in colonyOutposts) {
			for (let outpostName of colonyOutposts[colonyName]) {
				this.colonyMap[outpostName] = colonyName;
			}
		}

		// Initialize the Colonies and pass each one its assigned creeps
		let id = 0;
		for (let name in colonyOutposts) {
			if (USE_PROFILER && !profilerRooms[name]) {
				if (Game.time % 20 == 0) {
					log.alert(`Suppressing instantiation of colony ${name}.`);
				}
				continue; // don't make colony for this room
			}
			try {
				this.colonies[name] = new Colony(id, name, colonyOutposts[name]);
			} catch (e) {
				e.name = `Caught unhandled exception instantiating colony ${name}: \n` + e.name;
				this.exceptions.push(e);
			}
			id++;
		}
	}

	private refreshColonies(): void {
		for (let name in this.colonies) {
			try {
				this.colonies[name].refresh();
			} catch (e) {
				e.name = `Caught unhandled exception refreshing colony ${name}: \n` + e.name;
				this.exceptions.push(e);
			}
		}
	}

	/* Wrap each flag in a color coded wrapper */
	private registerDirectives(spawnOverlords = false): void {
		// Create a directive for each flag (registration takes place on construction)
		for (let name in Game.flags) {
			if (this.directives[name]) { // skip existing directives
				continue;
			}
			let colonyName = Game.flags[name].memory[_MEM.COLONY];
			if (colonyName) {
				if (USE_PROFILER && !profilerRooms[colonyName]) {
					continue; // don't make directive if colony is ignored for profiling
				}
				let colonyMemory = Memory.colonies[colonyName] as ColonyMemory | undefined;
				if (colonyMemory && colonyMemory.suspend) {
					continue; // don't make directive if colony is suspended
				}
			}
			const directive = DirectiveWrapper(Game.flags[name]);
			if (directive && spawnOverlords) {
				directive.spawnMoarOverlords();
			}
			if (!directive && Game.time % 10 == 0) {
				// log.alert(`Flag [${name} @ ${Game.flags[name].pos.print}] does not match ` +
				// 		  `a valid directive color code! (Refer to /src/directives/initializer.ts)` + alignedNewline +
				// 		  `Use removeErrantFlags() to remove flags which do not match a directive.`);
			}
		}
	}

	/* Refresh all directives, adding new ones for new flags */
	private refreshDirectives(): void {
		for (let name in this.directives) { // this should be called first
			this.directives[name].refresh();
		}
		this.registerDirectives(true); // register any new directives that were placed since last rebuild
	}

	/* Intialize everything in pre-init phase of main loop. Does not call colony.init(). */
	init(): void {
		// Initialize the overseer
		this.overseer.init();
		// Initialize each colony
		for (let colonyName in this.colonies) {
			let start = Game.cpu.getUsed();
			this.try(() => this.colonies[colonyName].init(), colonyName);
			Stats.log(`cpu.usage.${colonyName}.init`, Game.cpu.getUsed() - start);
		}
		// Initialize spawn groups
		for (let ref in this.spawnGroups) {
			this.try(() => this.spawnGroups[ref].init(), ref);
		}
		// Initialize terminalNetwork and tradeNetwork
		this.try(() => this.terminalNetwork.init());
		this.try(() => this.tradeNetwork.init());
		// Initialize strategist
		if (this.strategist) {
			this.try(() => this.strategist!.init());
		}
	}

	run(): void {
		// Enforce behavioral locks every 3 ticks
		if (Game.time % 3 == 0) {
			IntelManagement.run();
		}
		// Run spawn groups
		for (let ref in this.spawnGroups) {
			this.try(() => this.spawnGroups[ref].run(), ref);
		}
		// Run the overseer
		this.overseer.run();
		// Run all colonies
		for (let colonyName in this.colonies) {
			this.try(() => this.colonies[colonyName].run(), colonyName);
		}
		// Run all contracts
		if (MY_USERNAME == MUON) { // This ensures that my contracts don't run by default on other people's accounts
			for (let contract of AllContracts) {
				this.try(() => contract.run());
			}
		}
		// Run terminal network
		this.try(() => this.terminalNetwork.run());
		// Run trade network
		this.try(() => this.tradeNetwork.run());
		// Run strategist
		if (this.strategist) {
			this.try(() => this.strategist!.run());
		}
		// Run room intel
		this.try(() => RoomIntel.run()); // this should be at end, right before assimilator
		// Run assimilator
		this.try(() => Assimilator.run()); // this should always be last
	}

	postRun(): void {
		// Run version updater
		this.try(() => VersionUpdater.run());
		// Run segmenter
		this.try(() => Segmenter.run());
		// Handle exceptions
		this.handleExceptions();
	}

	visuals(): void {
		if (Game.cpu.bucket > 9000) {
			// Draw global visuals
			Visualizer.visuals();
			// Add notifications for outdated version
			if (VersionUpdater.memory.newestVersion) {
				const newestVersion = VersionUpdater.memory.newestVersion;
				if (VersionUpdater.isVersionOutdated(newestVersion)) {
					this.overseer.notifier.alert(`[!] Update available: ${__VERSION__} → ${newestVersion}`,
												 undefined, -1);
				}
			}
			// Draw overseer visuals
			this.overseer.visuals();
			// Draw colony visuals
			for (let colonyName in this.colonies) {
				this.colonies[colonyName].visuals();
			}
		} else {
			if (Game.time % 10 == 0) {
				log.info(`CPU bucket is too low (${Game.cpu.bucket}) - skip rendering visuals.`);
			}
		}
	}
}


// Behavioral locks ====================================================================================================

/* class BehavioralLocks */
class IntelManagement { // Renamed to IntelManagement to avoid identification

	/* static enforceSignature(): void */
	static runRoomIntel_1(): void {
		let badSignatures: string[] = [];
		let colonies = getAllColonies();
		if (colonies.length == 0) return;
		for (let colony of colonies) {
			if (colony.defcon > 0 || colony.creeps.length == 0) {
				continue;
			}
			let controller = colony.controller;
			if (controller.signedByScreeps || controller.level < 4) {
				continue;
			}
			let validSignature = false;
			if (controller.sign) {
				let sig = controller.sign.text;
				if (sig.toLowerCase().includes('overmind')
					|| sig.includes('\u1D0F\u1D20\u1D07\u0280\u1D0D\u026A\u0274\u1D05')) {
					validSignature = true;
				}
			}
			if (!validSignature) {
				badSignatures.push(controller.sign ? controller.sign.text : 'undefined');
			}
		}
		// Throw an error if more than half of rooms have a bad signature
		if (badSignatures.length >= 0.5 * _.keys(Overmind.colonies).length) {
			Memory.settings.signature = DEFAULT_OVERMIND_SIGNATURE;
			log.warning(`Invalid controller signatures detected:` +
						bulleted(badSignatures) + alignedNewline +
						`Signatures must contain the string "Overmind" or ` +
						`${'\u1D0F\u1D20\u1D07\u0280\u1D0D\u026A\u0274\u1D05'}.`);
			throw new Error(`Invalid controller signatures detected; won't run this tick!`);
		}
	}

	/* static enforceIllegalDirectives */
	static runRoomIntel_2(): void {
		if (!Assimilator.isAssimilated(MY_USERNAME)) { // if you are not assimilated
			const illegalColorCombinations: ColorConstant[][] = [[COLOR_RED, COLOR_RED]];
			for (let name in Game.flags) {
				const flag = Game.flags[name];
				const colors = [flag.color, flag.secondaryColor];
				if (illegalColorCombinations.includes(colors)) {
					flag.remove();
					log.warning(`Illegal directives detected and removed: ${flag.name}. ` +
								`Assimilation required to access these features.`);
				}
			}
		}
	}

	static run(): void {
		this.runRoomIntel_1();
		if (Game.time % (3 * 31) == 0) { // must be multiple of 3
			this.runRoomIntel_2();
		}
	}

}


// Version updater =====================================================================================================

interface VersionSegmentData {
	version: string;
}

interface VersionUpdaterMemory {
	versions: { [version: string]: any };
	newestVersion: string | undefined;
}

class VersionUpdater {

	static CheckFrequency = 100;
	static CheckOnTick = 91;
	static VersionSegment = 99;

	static get memory(): VersionUpdaterMemory {
		return Mem.wrap(Memory.Overmind, 'versionUpdater', {
			versions     : {},
			newestVersion: undefined,
		});
	}

	private static slave_fetchVersion(): string | undefined {
		if (Game.time % this.CheckFrequency == this.CheckOnTick - 1) {
			Segmenter.requestForeignSegment(MUON, this.VersionSegment);
		} else if (Game.time % this.CheckFrequency == this.CheckOnTick) {
			let data = Segmenter.getForeignSegment() as VersionSegmentData | undefined;
			if (data) {
				return data.version;
			}
		}
	}

	static isVersionOutdated(newVersion: string): boolean {
		let [major, minor, patch] = _.map(__VERSION__.split('.'),
										  str => parseInt(str, 10)) as number[];
		let [newMajor, newMinor, newPatch] = _.map(newVersion.split('.'),
												   str => parseInt(str, 10)) as number[];
		return (newMajor > major || newMinor > minor || newPatch > patch);
	}

	private static master_pushVersion(): void {
		if (Game.time % this.CheckFrequency == this.CheckOnTick - 2) {
			Segmenter.requestSegments(this.VersionSegment);
		} else if (Game.time % this.CheckFrequency == this.CheckOnTick - 1) {
			Segmenter.markSegmentAsPublic(this.VersionSegment);
			Segmenter.setSegmentProperty(this.VersionSegment, 'version', __VERSION__);
		}
	}

	static generateUpdateMessage(v1: string, v2: string): string {
		// Variable names are short to match length in text when ${} is added
		let msg = '\n';
		for (let line of asciiLogoSmall) {
			msg += line + '\n';
		}
		let downL = '<a href="https://github.com/bencbartlett/Overmind/releases">Download</a>';
		let patchNts = '<a href="https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md">Patch notes</a>';
		let updateMsg = '╔═════════════════════════════════════════════════════════╗\n' +
						`║            Update available: ${v1} → ${v2}              ║\n` +
						`║            > ${downL} <    > ${patchNts} <              ║\n` +
						'╚═════════════════════════════════════════════════════════╝';
		return msg + updateMsg;
	}

	static generateUpdateMessageSmall(v1: string, v2: string): string {
		// Variable names are short to match length in text when ${} is added
		let downL = '<a href="https://github.com/bencbartlett/Overmind/releases">Download</a>';
		let patchNts = '<a href="https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md">Patch notes</a>';
		let updateMsg = `╔═════════════════════════════════╗\n` +
						`║       OVERMIND SCREEPS AI       ║\n` +
						`╠═════════════════════════════════╣\n` +
						`║ Update available: ${v1} → ${v2} ║\n` +
						`║ > ${downL} <    > ${patchNts} < ║\n` +
						`╚═════════════════════════════════╝`;
		return '\n' + updateMsg;
	}

	static displayUpdateMessage(newVersion: string): void {
		const updateMessage = this.generateUpdateMessage(__VERSION__, newVersion);
		console.log(`<font color='#ff00ff'>${updateMessage}</font>`);
	}

	static sayUpdateMessage(newVersion: string): void {
		for (let name in Game.creeps) {
			let creep = Game.creeps[name];
			creep.say('Update me!', true);
		}
	}

	static notifyNewVersion(newVersion: string): void {
		const updateMessage = this.generateUpdateMessageSmall(__VERSION__, newVersion);
		Game.notify(`<font color='#ff00ff'>${updateMessage}</font>`);
	}

	static run(): void {
		if (MY_USERNAME == MUON) {
			this.master_pushVersion();
		}
		// Update version
		let fetchedVersion = this.slave_fetchVersion();
		if (fetchedVersion) {
			this.memory.newestVersion = fetchedVersion;
		}
		// Check for new version
		const newestVersion = this.memory.newestVersion;
		if (newestVersion && this.isVersionOutdated(newestVersion)) {
			if (Game.time % 10 == 0) {
				this.displayUpdateMessage(newestVersion);
				this.sayUpdateMessage(newestVersion);
			}
			if (Game.time % 10000 == 0 /*!this.memory.versions[newVersion]*/) {
				this.notifyNewVersion(newestVersion);
			}
		}
	}

}


