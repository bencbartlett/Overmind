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
import OM from 'Overmind_obfuscated';
// import {_Overmind} from './Overmind';
import {log} from './console/log';
import {VersionMigration} from './versionMigration/migrator';
import {isIVM} from './utilities/utils';
// =====================================================================================================================

const _Overmind = (<any>OM)._Overmind as (new() => IOvermind);

if (USE_PROFILER) profiler.enable();
log.alert(`Codebase updated or global reset. Current version: Overmind v${__VERSION__}, ` +
		  `checksum: ${Assimilator.generateChecksum()}`);
log.alert(`Type "help" for a list of console commands.`);

// Execute this every global reset
Mem.format();
OvermindConsole.init();
VersionMigration.run();

global._cache = {
	accessed  : {},
	expiration: {},
	structures: {},
};

// Main loop
function main(): void {
	if (!isIVM()) {
		log.warning(`Overmind requires the use of isolated virtual machine. ` +
					`Go to https://screeps.com/a/#!/account/runtime and select 'Isolated'.`);
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
	} else {
		log.warning(`CPU bucket is critically low (${Game.cpu.bucket}) - skipping this tick!`);
	}
}

export function loop(): void {
	profiler.wrap(main);
}
