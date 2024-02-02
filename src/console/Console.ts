import {Colony, ColonyMemory, getAllColonies} from '../Colony';
import {Directive} from '../directives/Directive';
import {RoomIntel} from '../intel/RoomIntel';
import {Overlord} from '../overlords/Overlord';
import {ExpansionEvaluator} from '../strategy/ExpansionEvaluator';
import {Cartographer} from '../utilities/Cartographer';
import {EmpireAnalysis} from '../utilities/EmpireAnalysis';
import {alignedNewline, bullet} from '../utilities/stringConstants';
import {color, printRoomName, toColumns} from '../utilities/utils';
import {asciiLogoRL, asciiLogoSmall} from '../visuals/logos';
import {DEFAULT_OVERMIND_SIGNATURE, MY_USERNAME, USE_SCREEPS_PROFILER} from '../~settings';
import {log} from './log';

type RecursiveObject = { [key: string]: number | RecursiveObject };

/**
 * OvermindConsole registers a number of global methods for direct use in the Screeps console
 */
export class OvermindConsole {

	static init() {
		global.help = this.help();
		global.info = this.info;
		global.notifications = this.notifications;
		global.debug = this.debug;
		global.stopDebug = this.stopDebug;
		global.setMode = this.setMode;
		global.setSignature = this.setSignature;
		global.print = this.print;
		global.timeit = this.timeit;
		global.profileOverlord = this.profileOverlord;
		global.finishProfilingOverlord = this.finishProfilingOverlord;
		global.setLogLevel = log.setLogLevel;
		global.suspendColony = this.suspendColony;
		global.unsuspendColony = this.unsuspendColony;
		global.listSuspendedColonies = this.listSuspendedColonies;
		global.openRoomPlanner = this.openRoomPlanner;
		global.closeRoomPlanner = this.closeRoomPlanner;
		global.cancelRoomPlanner = this.cancelRoomPlanner;
		global.listActiveRoomPlanners = this.listActiveRoomPlanners;
		global.destroyErrantStructures = this.destroyErrantStructures;
		global.destroyAllHostileStructures = this.destroyAllHostileStructures;
		global.destroyAllBarriers = this.destroyAllBarriers;
		global.listConstructionSites = this.listConstructionSites;
		global.removeUnbuiltConstructionSites = this.removeUnbuiltConstructionSites;
		global.listDirectives = this.listDirectives;
		global.listPersistentDirectives = this.listPersistentDirectives;
		// global.directiveInfo = this.directiveInfo;
		global.removeAllLogisticsDirectives = this.removeAllLogisticsDirectives;
		global.removeFlagsByColor = this.removeFlagsByColor;
		global.removeErrantFlags = this.removeErrantFlags;
		global.deepCleanMemory = this.deepCleanMemory;
		global.startRemoteDebugSession = this.startRemoteDebugSession;
		global.endRemoteDebugSession = this.endRemoteDebugSession;
		global.profileMemory = this.profileMemory;
		global.cancelMarketOrders = this.cancelMarketOrders;
		global.setRoomUpgradeRate = this.setRoomUpgradeRate;
		global.getEmpireMineralDistribution = this.getEmpireMineralDistribution;
		global.listPortals = this.listPortals;
		global.evaluateOutpostEfficiencies = this.evaluateOutpostEfficiencies;
		global.evaluatePotentialOutpostEfficiencies = this.evaluatePotentialOutpostEfficiencies;
	}

	// Help, information, and operational changes ======================================================================

	static help() {
		let msg = '\n<font color="#ff00ff">';
		for (const line of asciiLogoSmall) {
			msg += line + '\n';
		}
		msg += '</font>';

		// Generate a methods description object
		const descr: { [functionName: string]: string } = {};
		descr.help = 'show this message';
		descr['info()'] = 'display version and operation information';
		descr['notifications()'] = 'print a list of notifications with hyperlinks to the console';
		descr['setMode(mode)'] = 'set the operational mode to "manual", "semiautomatic", or "automatic"';
		descr['setSignature(newSignature)'] = 'set your controller signature; no argument sets to default';
		descr['print(...args[])'] = 'log stringified objects to the console';
		descr['debug(thing)'] = 'enable debug logging for a game object or process';
		descr['stopDebug(thing)'] = 'disable debug logging for a game object or process';
		descr['timeit(function, repeat=1)'] = 'time the execution of a snippet of code';
		descr['profileOverlord(overlord, ticks?)'] = 'start profiling on an overlord instance or name';
		descr['finishProfilingOverlord(overlord)'] = 'stop profiling on an overlord';
		descr['setLogLevel(int)'] = 'set the logging level from 0 - 4';
		descr['suspendColony(roomName)'] = 'suspend operations within a colony';
		descr['unsuspendColony(roomName)'] = 'resume operations within a suspended colony';
		descr['listSuspendedColonies()'] = 'Prints all suspended colonies';
		descr['openRoomPlanner(roomName)'] = 'open the room planner for a room';
		descr['closeRoomPlanner(roomName)'] = 'close the room planner and save changes';
		descr['cancelRoomPlanner(roomName)'] = 'close the room planner and discard changes';
		descr['listActiveRoomPlanners()'] = 'display a list of colonies with open room planners';
		descr['destroyErrantStructures(roomName)'] = 'destroys all misplaced structures within an owned room';
		descr['destroyAllHostileStructures(roomName)'] = 'destroys all hostile structures in an owned room';
		descr['destroyAllBarriers(roomName)'] = 'destroys all ramparts and barriers in a room';
		descr['listConstructionSites(filter?)'] = 'list all construction sites matching an optional filter';
		descr['removeUnbuiltConstructionSites()'] = 'removes all construction sites with 0 progress';
		descr['listDirectives(filter?)'] = 'list directives, matching a filter if specified';
		descr['listPersistentDirectives()'] = 'print type, name, pos of every persistent directive';
		descr['removeFlagsByColor(color, secondaryColor)'] = 'remove flags that match the specified colors';
		descr['removeErrantFlags()'] = 'remove all flags which don\'t match a directive';
		descr['deepCleanMemory()'] = 'deletes all non-critical portions of memory (be careful!)';
		descr['profileMemory(root=Memory, depth=1)'] = 'scan through memory to get the size of various objects';
		descr['startRemoteDebugSession()'] = 'enables the remote debugger so Muon can debug your code';
		descr['cancelMarketOrders(filter?)'] = 'cancels all market orders matching filter (if provided)';
		descr['setRoomUpgradeRate(room, upgradeRate)'] = 'changes the rate which a room upgrades at, default is 1';
		descr['getEmpireMineralDistribution()'] = 'returns current census of colonies and mined sk room minerals';
		descr['getPortals(rangeFromColonies)'] = 'returns active portals within colony range';
		descr['evaluateOutpostEfficiencies()'] = 'prints all colony outposts efficiency';
		descr['evaluatePotentialOutpostEfficiencies()'] = 'prints all nearby unmined outposts';

		// Console list
		const descrMsg = toColumns(descr, {justify: true, padChar: '.'});
		const maxLineLength = _.max(_.map(descrMsg, line => line.length)) + 2;
		msg += 'Console Commands: '.padRight(maxLineLength, '=') + '\n' + descrMsg.join('\n');

		msg += '\n\nRefer to the repository for more information\n';

		return msg;
	}

	static printUpdateMessage(aligned = false): void {
		const joinChar = aligned ? alignedNewline : '\n';
		const msg = `Codebase updated or global reset. Type "help" for a list of console commands.` + joinChar +
					color(asciiLogoSmall.join(joinChar), '#ff00ff') + joinChar +
					OvermindConsole.info(aligned);
		log.alert(msg);
	}

	static printTrainingMessage(): void {
		console.log('\n' + asciiLogoRL.join('\n') + '\n');
	}

	static info(aligned = false): string {
		const b = bullet;
		const checksum = Assimilator.generateChecksum();
		const clearanceCode = Assimilator.getClearanceCode(MY_USERNAME);
		const baseInfo = [
			`${b}Version:        Overmind v${__VERSION__}`,
			`${b}Checksum:       ${checksum}`,
			`${b}Assimilated:    ${clearanceCode ? 'Yes' : 'No'} (clearance code: ${clearanceCode}) [WIP]`,
			`${b}Operating mode: ${Memory.settings.operationMode}`,
		];
		const joinChar = aligned ? alignedNewline : '\n';
		return baseInfo.join(joinChar);
	}

	static notifications(): string {
		const notifications = Overmind.overseer.notifier.generateNotificationsList(true);
		return _.map(notifications, msg => bullet + msg).join('\n');
	}

	static setMode(mode: operationMode): string {
		switch (mode) {
			case 'manual':
				Memory.settings.operationMode = 'manual';
				return `Operational mode set to manual. Only defensive directives will be placed automatically; ` +
					   `remove harvesting, claiming, room planning, and raiding must be done manually.`;
			case 'semiautomatic':
				Memory.settings.operationMode = 'semiautomatic';
				return `Operational mode set to semiautomatic. Claiming, room planning, and raiding must be done ` +
					   `manually; everything else is automatic.`;
			case 'automatic':
				Memory.settings.operationMode = 'automatic';
				return `Operational mode set to automatic. All actions are done automatically, but manually placed ` +
					   `directives will still be responded to.`;
			default:
				return `Invalid mode: please specify 'manual', 'semiautomatic', or 'automatic'.`;
		}
	}


	static setSignature(signature: string | undefined): string | undefined {
		const sig = signature ? signature : DEFAULT_OVERMIND_SIGNATURE;
		if (sig.length > 100) {
			throw new Error(`Invalid signature: ${signature}; length is over 100 chars.`);
		} else if (sig.toLowerCase().includes('overmind') || sig.includes(DEFAULT_OVERMIND_SIGNATURE)) {
			Memory.settings.signature = sig;
			return `Controller signature set to ${sig}`;
		} else {
			throw new Error(`Invalid signature: ${signature}; must contain the string "Overmind" or ` +
							`${DEFAULT_OVERMIND_SIGNATURE} (accessible on global with __DEFAULT_OVERMIND_SIGNATURE__)`);
		}
	}


	// Debugging methods ===============================================================================================

	static debug(thing: { name?: string, ref?: string, memory: any }): string {
		thing.memory.debug = true;
		return `Enabled debugging for ${thing.name || thing.ref || '(no name or ref)'}.`;
	}

	static stopDebug(thing: { name?: string, ref?: string, memory: any }): string {
		delete thing.memory.debug;
		return `Disabled debugging for ${thing.name || thing.ref || '(no name or ref)'}.`;
	}

	static startRemoteDebugSession(): string {
		global.remoteDebugger.enable();
		return `Started remote debug session.`;
	}

	static endRemoteDebugSession(): string {
		global.remoteDebugger.disable();
		return `Ended remote debug session.`;
	}

	static print(...args: any[]): string {
		let message = '';
		for (const arg of args) {
			let cache: any = [];
			const msg = JSON.stringify(arg, function(key, value) {
				if (typeof value === 'object' && value !== null) {
					if (cache.indexOf(value) !== -1) {
						// Duplicate reference found
						try {
							// If this value does not reference a parent it can be deduped
							return JSON.parse(JSON.stringify(value));
						} catch (error) {
							// discard key if value cannot be deduped
							return;
						}
					}
					// Store value in our collection
					cache.push(value);
				}
				return value;
			}, '\t');
			cache = null;
			message += '\n' + msg;
		}
		return message;
	}

	static timeit(callback: () => any, repeat = 1): string {
		let start, used, i: number;
		start = Game.cpu.getUsed();
		for (i = 0; i < repeat; i++) {
			callback();
		}
		used = Game.cpu.getUsed() - start;
		return `CPU used: ${used}. Repetitions: ${repeat} (${used / repeat} each).`;
	}

	// Overlord profiling ==============================================================================================
	static profileOverlord(overlord: Overlord | string, ticks?: number): string {
		const overlordInstance = typeof overlord == 'string' ? Overmind.overlords[overlord]
															 : overlord as Overlord | undefined;
		if (!overlordInstance) {
			return `No overlord found for ${overlord}!`;
		} else {
			overlordInstance.startProfiling(ticks);
			return `Profiling ${overlordInstance.print} for ${ticks || 'indefinite'} ticks.`;
		}
	}

	static finishProfilingOverlord(overlord: Overlord | string, ticks?: number): string {
		const overlordInstance = typeof overlord == 'string' ? Overmind.overlords[overlord]
															 : overlord as Overlord | undefined;
		if (!overlordInstance) {
			return `No overlord found for ${overlord}!`;
		} else {
			overlordInstance.finishProfiling();
			return `Profiling ${overlordInstance.print} stopped.`;
		}
	}


	// Colony suspension ===============================================================================================

	static suspendColony(roomName: string): string {
		if (Overmind.colonies[roomName]) {
			const colonyMemory = Memory.colonies[roomName] as ColonyMemory | undefined;
			if (colonyMemory) {
				colonyMemory.suspend = true;
				Overmind.shouldBuild = true;
				return `Colony ${roomName} suspended.`;
			} else {
				return `No colony memory for ${roomName}!`;
			}
		} else {
			return `Colony ${roomName} is not a valid colony!`;
		}
	}

	static unsuspendColony(roomName: string): string {
		const colonyMemory = Memory.colonies[roomName] as ColonyMemory | undefined;
		if (colonyMemory) {
			if (!colonyMemory.suspend) {
				return `Colony ${roomName} is not suspended!`;
			} else {
				delete colonyMemory.suspend;
				Overmind.shouldBuild = true;
				return `Colony ${roomName} unsuspended.`;
			}
		} else {
			return `No colony memory for ${roomName}!`;
		}
	}

	static listSuspendedColonies(): string {
		let msg = 'Colonies currently suspended: \n';
		for (const i in Memory.colonies) {
			const colonyMemory = Memory.colonies[i] as ColonyMemory | undefined;
			if (colonyMemory && colonyMemory.suspend == true) {
				msg += 'Colony ' + i + ' \n';
			}
		}
		return msg;
	}

	// Room planner control ============================================================================================

	static openRoomPlanner(roomName: string): string {
		if (Overmind.colonies[roomName]) {
			if (Overmind.colonies[roomName].roomPlanner.active != true) {
				Overmind.colonies[roomName].roomPlanner.active = true;
				return '';
			} else {
				return `RoomPlanner for ${roomName} is already active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static closeRoomPlanner(roomName: string, ignoreRoads=false): string {
		if (Overmind.colonies[roomName]) {
			if (Overmind.colonies[roomName].roomPlanner.active) {
				Overmind.colonies[roomName].roomPlanner.finalize(ignoreRoads);
				return '';
			} else {
				return `RoomPlanner for ${roomName} is not active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static cancelRoomPlanner(roomName: string): string {
		if (Overmind.colonies[roomName]) {
			if (Overmind.colonies[roomName].roomPlanner.active) {
				Overmind.colonies[roomName].roomPlanner.active = false;
				return `RoomPlanner for ${roomName} has been deactivated without saving changes`;
			} else {
				return `RoomPlanner for ${roomName} is not active!`;
			}
		} else {
			return `Error: ${roomName} is not a valid colony!`;
		}
	}

	static listActiveRoomPlanners(): string {
		const coloniesWithActiveRoomPlanners: Colony[] = _.filter(
			_.map(_.keys(Overmind.colonies), colonyName => Overmind.colonies[colonyName]),
			(colony: Colony) => colony.roomPlanner.active);
		const names: string[] = _.map(coloniesWithActiveRoomPlanners, colony => colony.room.print);
		if (names.length > 0) {
			console.log('Colonies with active room planners: ' + names);
			return '';
		} else {
			return `No colonies with active room planners`;
		}
	}

	static listConstructionSites(filter?: (site: ConstructionSite) => any): string {
		let msg = `${_.keys(Game.constructionSites).length} construction sites currently present: \n`;
		for (const id in Game.constructionSites) {
			const site = Game.constructionSites[id];
			if (!filter || filter(site)) {
				msg += `${bullet}Type: ${site.structureType}`.padRight(20) +
					   `Pos: ${site.pos.print}`.padRight(65) +
					   `Progress: ${site.progress} / ${site.progressTotal} \n`;
			}
		}
		return msg;
	}

	// Directive management ============================================================================================

	static listDirectives(filter?: (dir: Directive) => any): string {
		let msg = '';
		for (const i in Overmind.directives) {
			const dir = Overmind.directives[i];
			if (!filter || filter(dir)) {
				msg += `${bullet}Name: ${dir.print}`.padRight(70) +
					   `Colony: ${dir.colony.print}`.padRight(55) +
					   `Pos: ${dir.pos.print}\n`;
			}
		}
		return msg;
	}

	static removeAllLogisticsDirectives(): string {
		const logisticsFlags = _.filter(Game.flags, flag => flag.color == COLOR_YELLOW &&
															flag.secondaryColor == COLOR_YELLOW);
		for (const dir of logisticsFlags) {
			dir.remove();
		}
		return `Removed ${logisticsFlags.length} logistics directives.`;
	}

	static listPersistentDirectives(): string {
		let msg = '';
		for (const i in Overmind.directives) {
			const dir = Overmind.directives[i];
			if (dir.memory.persistent) {
				msg += `Type: ${dir.directiveName}`.padRight(20) +
					   `Name: ${dir.name}`.padRight(15) +
					   `Pos: ${dir.pos.print}\n`;
			}
		}
		return msg;
	}

	static removeFlagsByColor(color: ColorConstant, secondaryColor: ColorConstant): string {
		const removeFlags = _.filter(Game.flags, flag => flag.color == color && flag.secondaryColor == secondaryColor);
		for (const flag of removeFlags) {
			flag.remove();
		}
		return `Removed ${removeFlags.length} flags.`;
	}

	static removeErrantFlags(): string {
		// This may need to be be run several times depending on visibility
		if (USE_SCREEPS_PROFILER) {
			return `ERROR: should not be run while profiling is enabled!`;
		}
		let count = 0;
		for (const name in Game.flags) {
			if (!Overmind.directives[name]) {
				Game.flags[name].remove();
				count += 1;
			}
		}
		return `Removed ${count} flags.`;
	}


	// Structure management ============================================================================================

	static destroyErrantStructures(roomName: string): string {
		const colony = Overmind.colonies[roomName] as Colony;
		if (!colony) return `${roomName} is not a valid colony!`;
		const room = colony.room;
		const allStructures = room.find(FIND_STRUCTURES);
		let i = 0;
		for (const s of allStructures) {
			if (s.structureType == STRUCTURE_CONTROLLER) continue;
			if (!colony.roomPlanner.structureShouldBeHere(s.structureType, s.pos)) {
				const result = s.destroy();
				if (result == OK) {
					i++;
				}
			}
		}
		return `Destroyed ${i} misplaced structures in ${roomName}.`;
	}

	static destroyAllHostileStructures(roomName: string): string {
		const room = Game.rooms[roomName];
		if (!room) return `${roomName} is undefined! (No vision?)`;
		if (!room.my) return `${roomName} is not owned by you!`;
		const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
		for (const structure of hostileStructures) {
			structure.destroy();
		}
		return `Destroyed ${hostileStructures.length} hostile structures.`;
	}

	static destroyAllBarriers(roomName: string): string {
		const room = Game.rooms[roomName];
		if (!room) return `${roomName} is undefined! (No vision?)`;
		if (!room.my) return `${roomName} is not owned by you!`;
		for (const barrier of room.barriers) {
			barrier.destroy();
		}
		return `Destroyed ${room.barriers.length} barriers.`;
	}

	static removeUnbuiltConstructionSites(): string {
		let msg = '';
		for (const id in Game.constructionSites) {
			const csite = Game.constructionSites[id];
			if (csite.progress == 0) {
				const ret = csite.remove();
				msg += `Removing construction site for ${csite.structureType} with 0% progress at ` +
					   `${csite.pos.print}; response: ${ret}\n`;
			}
		}
		return msg;
	}

	// Colony Management =================================================================================================

	static setRoomUpgradeRate(roomName: string, rate: number): string {
		const colony: Colony = Overmind.colonies[roomName];
		colony.upgradeSite.memory.speedFactor = rate;

		return `Colony ${roomName} is now upgrading at a rate of ${rate}.`;
	}

	static getEmpireMineralDistribution(): string {
		const minerals = EmpireAnalysis.empireMineralDistribution();
		let ret = 'Empire Mineral Distribution \n';
		for (const mineral in minerals) {
			ret += `${mineral}: ${minerals[mineral]} \n`;
		}
		return ret;
	}

	static listPortals(rangeFromColonies: number = 5, includeIntershard: boolean = false): string {
		const colonies = getAllColonies();
		const allPortals = colonies.map(colony => RoomIntel.findPortalsInRange(colony.name, rangeFromColonies));
		let ret = `Empire Portal Census \n`;
		for (const colonyId in allPortals) {
			const portals = allPortals[colonyId];
			if (_.keys(portals).length > 0) {
				ret += `Colony ${colonies[colonyId].print}: \n`;
			}
			for (const portalRoomName of _.keys(portals)) {
				const samplePortal = _.first(portals[portalRoomName]); // don't need to list all 8 in a room
				ret += `\t\t Room ${printRoomName(portalRoomName)} Destination ${samplePortal.dest} ` +
					   `Expiration ${samplePortal[MEM.EXPIRATION] - Game.time}] \n`;
			}
		}
		return ret;
	}

	static evaluateOutpostEfficiencies(): string {
		const colonies = getAllColonies();
		const outpostEfficiencies: {[roomName: string]: number} = {};
		let avgEnergyPerCPU = 0;

		colonies.forEach(colony => {
			if (colony.bunker) {
				colony.outposts.forEach(outpost => {
					const res = ExpansionEvaluator.computeTheoreticalMiningEfficiency(colony.bunker!.anchor, outpost.name);
					if (typeof res === 'boolean') {
						log.error(`Failed on outpost ${outpost.print}`);
					} else {
						outpostEfficiencies[outpost.name] = res;
						avgEnergyPerCPU += res;
					}
				});
			}
		});

		avgEnergyPerCPU = avgEnergyPerCPU/Object.keys(outpostEfficiencies).length;
		let ret = `Suspect Outposts +25% below avg efficiency of ${avgEnergyPerCPU}: \n`;

		for (const outpost in outpostEfficiencies) {
			if (outpostEfficiencies[outpost] < avgEnergyPerCPU*0.75) {
				ret += `${outpost} ${outpostEfficiencies[outpost]} \n`;
			}
		}

		return ret;
	}

	static evaluatePotentialOutpostEfficiencies(): string {
		const colonies = getAllColonies();
		const outpostEfficiencies: {[roomName: string]: number} = {};
		let avgEnergyPerCPU = 0;

		colonies.forEach(colony => {
			if (colony.bunker) {
				Cartographer.findRoomsInRange(colony.name, 2).forEach(outpost => {
					if (!colony.outposts.map(room => room.name).includes(outpost)) {
						const res = ExpansionEvaluator.computeTheoreticalMiningEfficiency(colony.bunker!.anchor, outpost);
						if (typeof res === 'boolean') {
							log.error(`Failed on outpost ${outpost}`);
						} else {
							outpostEfficiencies[outpost] = res;
							avgEnergyPerCPU += res;
						}
					}
				});
			}
		});

		avgEnergyPerCPU = avgEnergyPerCPU/Object.keys(outpostEfficiencies).length;
		let ret = `Possible new outposts above avg efficiency of ${avgEnergyPerCPU}: \n`;

		for (const outpost in outpostEfficiencies) {
			// 20E/cpu is a good guideline for an efficient room
			if (outpostEfficiencies[outpost] > avgEnergyPerCPU*1.25 || outpostEfficiencies[outpost] > 20) {
				ret += `${outpost} ${outpostEfficiencies[outpost]} \n`;
			}
		}

		return ret;
	}



	// Memory management ===============================================================================================

	static deepCleanMemory(): string {
		// Clean colony memory
		const protectedColonyKeys = ['defcon', 'roomPlanner', 'roadPlanner', 'barrierPlanner'];
		for (const colName in Memory.colonies) {
			for (const key in Memory.colonies[colName]) {
				if (!protectedColonyKeys.includes(key)) {
					delete (<any>Memory.colonies[colName])[key];
				}
			}
		}
		// Suicide any creeps which have no memory
		for (const i in Game.creeps) {
			if (_.isEmpty(Game.creeps[i].memory)) {
				Game.creeps[i].suicide();
			}
		}
		// Remove profiler memory
		delete Memory.screepsProfiler;
		// Remove overlords memory from flags
		for (const i in Memory.flags) {
			if ((<any>Memory.flags[i]).overlords) {
				delete (<any>Memory.flags[i]).overlords;
			}
		}
		// Clean creep memory
		for (const i in Memory.creeps) {
			// Remove all creep tasks to fix memory leak in 0.3.1
			if (Memory.creeps[i].task) {
				Memory.creeps[i].task = null;
			}
		}
		return `Memory has been cleaned.`;
	}


	private static recursiveMemoryProfile(memoryObject: any, sizes: RecursiveObject, currentDepth: number): void {
		for (const key in memoryObject) {
			if (currentDepth == 0 || !_.keys(memoryObject[key]) || _.keys(memoryObject[key]).length == 0) {
				sizes[key] = JSON.stringify(memoryObject[key]).length;
			} else {
				sizes[key] = {};
				OvermindConsole.recursiveMemoryProfile(memoryObject[key], sizes[key] as RecursiveObject,
													   currentDepth - 1);
			}
		}
	}

	static profileMemory(root = Memory, depth = 1): string {
		const sizes: RecursiveObject = {};
		console.log(`Profiling memory...`);
		const start = Game.cpu.getUsed();
		OvermindConsole.recursiveMemoryProfile(root, sizes, depth);
		console.log(`Time elapsed: ${Game.cpu.getUsed() - start}`);
		return JSON.stringify(sizes, undefined, '\t');
	}

	static cancelMarketOrders(filter?: (order: Order) => any): string {
		const ordersToCancel = !!filter ? _.filter(Game.market.orders, order => filter(order)) : Game.market.orders;
		_.forEach(_.values(ordersToCancel), (order: Order) => Game.market.cancelOrder(order.id));
		return `Canceled ${_.values(ordersToCancel).length} orders.`;
	}

}
