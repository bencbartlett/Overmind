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

// Assimilator must be instantiated before any other imports
'use strict';
// Import ALL the things! ==============================================================================================
import './assimilation/initializer'; // This must always be imported first
import './console/globals'; // Global functions accessible from CLI
import './prototypes/Creep'; // Creep prototypes
import './prototypes/RoomObject'; // RoomObject and targeting prototypes
import './prototypes/RoomPosition'; // RoomPosition prototypes
import './prototypes/RoomVisual'; // Prototypes used in Visualizer class
import './prototypes/Room'; // Non-structure room prototypes
import './prototypes/RoomStructures'; // IVM-cached structure prototypes
import './prototypes/Structures'; // Prototypes for accessed structures
import './prototypes/Miscellaneous'; // Everything else
import './tasks/initializer'; // This line is necessary to ensure proper compilation ordering...
import './zerg/CombatZerg'; // ...so is this one... rollup is dumb about generating reference errors
import {USE_PROFILER} from './~settings';
import {sandbox} from './sandbox';
import {Mem} from './Memory';
import {OvermindConsole} from './console/Console';
import {Stats} from './stats/stats';
import profiler from 'screeps-profiler';
import _Overmind from './Overmind_obfuscated'; // don't enable this unless you're me
import {log} from './console/log';
import {VersionMigration} from './versionMigration/migrator';
import {isIVM} from './utilities/utils';
import {alignedNewline} from './utilities/stringConstants';
// =====================================================================================================================

// @formatter:on

if (USE_PROFILER) profiler.enable();

Mem.format();
OvermindConsole.init();
VersionMigration.run();

log.alert(`Codebase updated or global reset. Type "help" for a list of console commands.` + alignedNewline +
		  OvermindConsole.info(true));

// Main loop
function main(): void {
	if (!isIVM()) {
		log.warning(`Overmind requires isolated-VM to run. Change settings at screeps.com/a/#!/account/runtime`);
		return;
	}
	if (Game.cpu.bucket > 500) {
		Mem.clean();										// Clean memory
		global.Overmind = new _Overmind();					// Instantiate the Overmind
		Overmind.build();									// Build phase: instantiate caches and colony components
		Overmind.init();									// Init phase: spawning and energy requests
		Overmind.run();										// Run phase: execute state-changing actions
		Overmind.visuals(); 								// Draw visuals
		Stats.run(); 										// Record statistics
		sandbox();											// Sandbox: run any testing code
		Overmind.postRun();									// Error catching; should be run at end of every tick
	} else {
		log.warning(`CPU bucket is critically low (${Game.cpu.bucket}) - skipping this tick!`);
	}
}

Assimilator.validate(main);

export function loop(): void {
	profiler.wrap(main);
}

Assimilator.validate(loop);
