// Overmind class - manages colony-scale operations and contains references to all brain objects

import {Colony} from './Colony';
import {DirectiveWrapper} from './maps/map_directives';
import {profile} from './profiler/decorator';
import {GameCache} from './caching';
import {Zerg} from './Zerg';
import {DirectiveOutpost} from './directives/core/directive_outpost';
import {Overlord} from './overlords/Overlord';
import {Directive} from './directives/Directive';
import {Visualizer} from './visuals/Visualizer';
import {Stats} from './stats/stats';
import {TerminalNetwork} from './logistics/TerminalNetwork';
import {myUsername} from './settings/settings_user';
import {AllContracts} from './contracts/contractsList';


@profile
export default class Overmind implements IOvermind {

	cache: ICache;
	Colonies: { [roomName: string]: Colony };				// Global hash of all colony objects
	overlords: { [overlordName: string]: Overlord };
	colonyMap: { [roomName: string]: string };				// Global map of colony associations for possibly-null rooms
	terminalNetwork: ITerminalNetwork;
	invisibleRooms: string[]; 								// Names of rooms across all colonies that are invisible

	constructor() {
		this.cache = new GameCache();
		this.Colonies = {};
		this.overlords = {};
		this.colonyMap = {};
		this.invisibleRooms = [];
		this.terminalNetwork = this.makeTerminalNetwork();
	}

	get memory(): IOvermindMemory {
		return Memory.Overmind as IOvermindMemory;
	}

	private makeTerminalNetwork(): TerminalNetwork {
		// Initialize the terminal netowrk
		let terminals: StructureTerminal[] = [];
		for (let i in Game.rooms) {
			let room = Game.rooms[i];
			if (room.my && room.terminal) {
				terminals.push(room.terminal);
			}
		}
		return new TerminalNetwork(terminals);
	}


	/* Instantiate a new colony for each owned rom */
	private registerColonies(): void {

		let colonyOutposts: { [roomName: string]: string[] } = {}; // key: lead room, values: outposts[]

		// Register colony capitols
		for (let name in Game.rooms) {
			if (Game.rooms[name].my) { 			// Will add a new colony for each owned room
				colonyOutposts[name] = [];		// Make a blank list of outposts
				this.colonyMap[name] = name;	// Register capitols to their own colonies
			}
		}

		// Register colony outposts
		let outpostFlags = _.filter(Game.flags, flag => DirectiveOutpost.filter(flag));
		for (let flag of outpostFlags) {
			if (!flag.memory.colony) {
				Directive.recalculateColony(flag);
			}
			let colonyName = flag.memory.colony as string;
			if (colonyOutposts[colonyName]) {
				let outpostName = flag.pos.roomName;
				this.colonyMap[outpostName] = colonyName; // Create an association between room and colony name
				colonyOutposts[colonyName].push(outpostName);
			}
		}

		// Initialize the Colonies and give each one an Overseer
		let id = 0;
		for (let colonyName in colonyOutposts) {
			this.Colonies[colonyName] = new Colony(id, colonyName, colonyOutposts[colonyName]);
			id++;
		}
	}

	private wrapCreeps(): void {
		// Wrap all creeps
		Game.zerg = {};
		for (let name in Game.creeps) {
			Game.zerg[name] = new Zerg(Game.creeps[name]);
		}
	}

	/* Wrap each creep in a role-contextualized wrapper and register to their respective colonies */
	private registerCreeps(): void {
		// Register creeps to their colonies
		let creepsByColony = _.groupBy(Game.zerg, creep => creep.memory.colony) as { [colName: string]: Zerg[] };
		for (let colName in this.Colonies) {
			let colony = this.Colonies[colName];
			colony.creeps = creepsByColony[colName];
			colony.creepsByRole = _.groupBy(creepsByColony[colName], creep => creep.memory.role);
			// colony.creepsByOverseer = _.groupBy(creepsByColony[colName], creep => creep.memory.overseer);
		}
	}

	/* Wrap each flag in a color coded wrapper */
	private registerDirectives(): void {
		// Create a directive for each flag (registration takes place on construction)
		Game.directives = {};
		for (let name in Game.flags) {
			let directive = DirectiveWrapper(Game.flags[name]);
			if (directive) {
				Game.directives[name] = directive;
				directive.colony.flags.push(directive.flag);
			} else {
				Directive.getFlagColony(Game.flags[name]).flags.push(Game.flags[name]);
			}
		}
	}

	/* Global instantiation of Overmind object; run once every global refresh */
	build(): void {
		this.cache.build();
		this.wrapCreeps();
		this.registerColonies();
		this.registerCreeps();			// 4: Wrap all the creeps and assign to respective colonies
		// this.buildColonies();			// 5: Build the colony, instantiating virtual components
		this.registerDirectives(); 		// 5: Wrap all the directives and assign to respective overlords
	}

	// /* Refresh the state of the Overmind; run at the beginning of every tick */
	// rebuild(): void {
	// 	this.cache.rebuild();
	// }

	/* Intialize everything in pre-init phase of main loop. Does not call colony.init(). */
	init(): void {
		for (let colonyName in this.Colonies) {
			let start = Game.cpu.getUsed();
			this.Colonies[colonyName].init();
			Stats.log(`cpu.usage.${colonyName}.init`, Game.cpu.getUsed() - start);
		}
		this.terminalNetwork.init();
	}

	run(): void {
		// Run all colonies
		for (let colonyName in this.Colonies) {
			let start = Game.cpu.getUsed();
			this.Colonies[colonyName].run();
			Stats.log(`cpu.usage.${colonyName}.run`, Game.cpu.getUsed() - start);
		}
		// Run all contracts
		if (myUsername == 'Muon') { // This ensures that my contracts don't run by default on other people's accounts
			for (let contract of AllContracts) {
				contract.run();
			}
		}
		// Run terminal network
		this.terminalNetwork.run();
	}

	visuals(): void {
		// Draw global visuals
		Visualizer.visuals();
		// Draw colony visuals
		for (let colonyName in this.Colonies) {
			let start = Game.cpu.getUsed();
			this.Colonies[colonyName].visuals();
			Stats.log(`cpu.usage.${colonyName}.visuals`, Game.cpu.getUsed() - start);
		}
	}

};

