//
// ___________________________________________________________
//
//  _____  _    _ _______  ______ _______ _____ __   _ ______
// |     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
// |_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/
//
// ___________ Artificial Intelligence for Screeps ___________
//
//
// Overmind repository: github.com/bencbartlett/overmind
//


'use strict';
// Cached Import and Declarations ======================================================================================
// Global settings and functions
import './globals';
import './settings/settings_user';
// Prototypes
import './prototypes/prototypes_Creep';
import './prototypes/prototypes_Flag';
import './prototypes/prototypes_RoomObject';
import './prototypes/prototypes_RoomPosition';
import './prototypes/prototypes_RoomVisual';
import './prototypes/prototypes_Room';
import './prototypes/prototypes_Structures';
// Global objects
import OM from './Overmind';
// Preprocessing and postprocessing modules
// Configuration, logging, and profiling
import {log} from './lib/logger/log';
import * as Profiler from 'lib/Profiler';
import {taskInstantiator} from './maps/map_tasks';
import {sandbox} from './sandbox/sandbox';
import {USE_PROFILER} from './config/config';
import {Memcheck} from './memcheck';


// Global declarations
global.log = log;
global.Profiler = Profiler.init();
global.taskFromPrototask = taskInstantiator;

// Memory formatting
Memcheck.format();

// Main loop ===========================================================================================================

export function loop(): void {

	if (USE_PROFILER && Game.time % 100 == 0) {
		console.log('Reminder: CPU profiling is currently enabled. Turn off when not needed to improve performance.');
	}

	// Memory management ===========================================================================================
	Memcheck.clean();

	// Setup =======================================================================================================
	// Initialize Overmind object, wrapping all creeps in Game.zerg and registering them to colonies
	global.Overmind = new OM();
	Overmind.build();

	// Initialization ==============================================================================================
	Overmind.init();
	// for (let name in Overmind.Colonies) {
	// 	Overmind.Colonies[name].init();
	// }

	// Animation ===================================================================================================
	// for (let name in Overmind.Colonies) {
	// 	Overmind.Colonies[name].run();
	// }
	Overmind.run();

	// Postprocessing ==============================================================================================

	// Run test code
	sandbox();
}

