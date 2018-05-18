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
import './prototypes/prototypes_Creep';
import './prototypes/prototypes_Flag';
import './prototypes/prototypes_RoomObject';
import './prototypes/prototypes_RoomPosition';
import './prototypes/prototypes_RoomVisual';
import './prototypes/prototypes_Room';
import './prototypes/prototypes_Structures';
import './prototypes/prototypes_other';
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
// 1: Import overmind from standard TS source
// import {_Overmind} from 'Overmind';
// 2: Import overmind from obfuscated JS file included in public repository
import OM from 'Overmind_obfuscated';

var _Overmind = (<any>OM)._Overmind as (new() => IOvermind);

if (USE_PROFILER) profiler.enable();

// Execute this every global reset
global.log = log;
Mem.format();
Console.init();
log.alert(`Codebase updated (or global reset)`);

// Main loop
function main(): void {
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

