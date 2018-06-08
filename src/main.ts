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
// Import global settings and prototypes
import './console/globals';
import './prototypes/Creep';
import './prototypes/Flag';
import './prototypes/RoomObject';
import './prototypes/RoomPosition';
import './prototypes/RoomVisual';
import './prototypes/Room';
import './prototypes/Structures';
import './prototypes/Miscellaneous';
import './tasks/prototypes';
import './settings/settings_user';
// Configuration, logging, and profiling
import {log} from './lib/logger/log';
import {sandbox} from './sandbox';
import {Mem} from './memory';
import {Console} from './console/console';
import {Stats} from './stats/stats';
// Profiling
import {USE_PROFILER} from './settings/config';
import profiler from 'screeps-profiler';
// Version migration
import {migrate_03X_04X} from './versionMigration/0.3.x to 0.4.x';
// Importing overmind object
// import {_Overmind} from 'Overmind'; // Option 1: only use this if you are me! (this should be commented out)
import OM from 'Overmind_obfuscated'; // Option 2: Import overmind from obfuscated JS file in public repository
var _Overmind = (<any>OM)._Overmind as (new() => IOvermind); // These two lines shouldn't be commented out

if (USE_PROFILER) profiler.enable();

// Execute this every global reset
global.log = log;
Mem.format();
migrate_03X_04X();
Console.init();
log.alert(`Codebase updated (or global reset)`);


// Main loop
function main(): void {
	if (Game.cpu.bucket < 500) {	// Don't run anything at low bucket
		return;
	}
	Mem.clean();										// Clean memory
	global.Overmind = new _Overmind();					// Instantiate the Overmind
	Overmind.build();									// Build phase: instantiate caches and colony components
	Overmind.init();									// Init phase: spawning and energy requests
	Overmind.run();										// Run phase: execute state-changing actions
	Overmind.visuals(); 								// Draw visuals
	Stats.run(); 										// Record statistics
	sandbox();											// Sandbox: run any testing code
}

export function loop(): void {
	profiler.wrap(main);
}

