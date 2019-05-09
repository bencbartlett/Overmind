// @formatter:off

//
// ___________________________________________________________
//
//  _____  _    _ _______  ______ _______ _____ __   _ ______
// |     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
// |_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/
//
// _______________________ Screeps AI ________________________
//
//
// Overmind repository: github.com/bencbartlett/overmind
//

'use strict';
// Import ALL the things! ==============================================================================================
import './assimilation/initializer'; // This must always be imported before anything else
import {OvermindConsole} from './console/Console';
import './console/globals'; // Global functions accessible from CLI
import {RemoteDebugger} from './debug/remoteDebugger';
import {Mem} from './memory/Memory';
import _Overmind from './Overmind_obfuscated'; // this should be './Overmind_obfuscated' unless you are me
import profiler from './profiler/screeps-profiler';
import './prototypes/Creep'; // Creep prototypes
import './prototypes/Miscellaneous'; // Everything else
import './prototypes/Room'; // Non-structure room prototypes
import './prototypes/RoomObject'; // RoomObject and targeting prototypes
import './prototypes/RoomPosition'; // RoomPosition prototypes
import './prototypes/RoomStructures'; // IVM-cached structure prototypes
import './prototypes/RoomVisual'; // Prototypes used in Visualizer class
import './prototypes/Structures'; // Prototypes for accessed structures
import {sandbox} from './sandbox';
import {Stats} from './stats/stats';
import './tasks/initializer'; // This line is necessary to ensure proper compilation ordering...
import {VersionMigration} from './versionMigration/migrator';
import './zerg/CombatZerg'; // ...so is this one... rollup is dumb about generating reference errors
import {MUON, MY_USERNAME, RL_MODE, USE_PROFILER} from './~settings';
// =====================================================================================================================

// @formatter:on

// Main loop
function main(): void {

	// Memory operations: load and clean memory, suspend operation as needed
	Mem.load();														// Load previous parsed memory if present
	if (!Mem.shouldRun()) return;									// Suspend operation if necessary
	Mem.clean();													// Clean memory contents

	// Instantiation operations: build or refresh the game state
	if (!Overmind || Overmind.shouldBuild || Game.time >= Overmind.expiration) {
		delete global.Overmind;										// Explicitly delete the old Overmind object
		Mem.garbageCollect(true);								// Run quick garbage collection
		global.Overmind = new _Overmind();							// Instantiate the Overmind object
		Overmind.build();											// Build phase: instantiate all game components
	} else {
		Overmind.refresh();											// Refresh phase: update the Overmind state
	}

	// Tick loop cycle: initialize and run each component
	Overmind.init();												// Init phase: spawning and energy requests
	Overmind.run();													// Run phase: execute state-changing actions
	Overmind.visuals(); 											// Draw visuals
	Stats.run(); 													// Record statistics

	// Post-run code: handle sandbox code and error catching
	sandbox();														// Sandbox: run any testing code
	global.remoteDebugger.run();									// Run remote debugger code if enabled
	Overmind.postRun();												// Error catching is run at end of every tick

}

// Main loop if RL mode is enabled (~settings.ts)
function main_rl(): void {

}

// This gets run on each global reset
function onGlobalReset(): void {
	if (USE_PROFILER) profiler.enable();
	Mem.format();
	OvermindConsole.init();
	VersionMigration.run();
	Memory.stats.persistent.lastGlobalReset = Game.time;

	OvermindConsole.printUpdateMessage();

	// Update the master ledger of valid checksums
	if (MY_USERNAME == MUON) {
		Assimilator.updateValidChecksumLedger();
	}

	// Make a new Overmind object
	global.Overmind = new _Overmind();

	// Make a remote debugger
	global.remoteDebugger = new RemoteDebugger();
}


// Decide which loop to export as the script loop
let _loop: () => void;
if (RL_MODE) {
	// Use stripped version for training reinforcment learning model
	_loop = main_rl;
} else {
	if (USE_PROFILER) {
		// Wrap the main loop in the profiler
		_loop = () => profiler.wrap(main);
	} else {
		// Use the default main loop
		_loop = main;
	}
}

export const loop = _loop;

if (!RL_MODE) {

	// Register these functions for checksum computations with the Assimilator
	Assimilator.validate(main);
	Assimilator.validate(loop);

	// Run the global reset code
	onGlobalReset();
}



