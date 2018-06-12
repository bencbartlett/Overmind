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
import {USE_PROFILER} from './~settings';
import {sandbox} from './sandbox';
import {Mem} from './memory';
import {OvermindConsole} from './console/console';
import {Stats} from './stats/stats';
import profiler from 'screeps-profiler';
import OM from 'Overmind_obfuscated';
import {log} from './lib/logger/log';
import {VersionMigration} from './versionMigration/migrator';

var _Overmind = (<any>OM)._Overmind as (new() => IOvermind);

if (USE_PROFILER) profiler.enable();
log.alert(`Codebase updated or global reset. Current version: Overmind v${__VERSION__}`);


// Execute this every global reset
Mem.format();
OvermindConsole.init();
VersionMigration.run();

// Main loop
function main(): void {
	if (Game.cpu.bucket < 500) return;					// Don't run anything at low bucket
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

