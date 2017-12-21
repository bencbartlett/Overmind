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
import {flagCodesMap} from './maps/map_flag_codes';
// Preprocessing and postprocessing modules
import {visuals} from './visuals/visuals';
// Configuration, logging, and profiling
import {log} from './lib/logger/log';
import * as Profiler from 'lib/Profiler';
import {taskInstantiator} from './maps/map_tasks';
import {sandbox} from './sandbox/sandbox';
import {USE_PROFILER} from './config/config';

// Main loop ===========================================================================================================
global.log = log;
global.Profiler = Profiler.init();


export function loop(): void {

	if (USE_PROFILER && Game.time % 100 == 0) {
		console.log('Reminder: CPU profiling is currently enabled. Turn off when not needed to improve performance.');
	}

	// Memory management ===========================================================================================
	// Clear memory for non-existent creeps
	for (let name in Memory.creeps) {
		if (Game.creeps[name] == undefined) {
			delete Memory.creeps[name];
		}
	}
	// Clear memory for non-existent flags
	for (let name in Memory.flags) {
		if (Game.flags[name] == undefined) {
			delete Memory.flags[name];
		}
	}

	// Setup =======================================================================================================
	// Create global flagCodes reference (avoids circular imports)
	global.flagCodes = flagCodesMap;
	// Create a global task instantiator (avoids circular imports)
	global.taskFromPrototask = taskInstantiator;
	// Initialize Overmind object, wrapping all creeps in Game.icreeps and registering them to colonies
	global.Overmind = new OM();
	Overmind.rebuild();

	// Initialization ==============================================================================================
	Overmind.init();
	for (let name in Overmind.Colonies) {
		Overmind.Colonies[name].init();
	}

	// Animation ===================================================================================================
	for (let name in Overmind.Colonies) {
		Overmind.Colonies[name].run();
	}
	Overmind.run();

	// Postprocessing ==============================================================================================
	// Draw visuals
	if (Game.cpu.bucket > 7500) {
		visuals.drawGlobalVisuals();
	}

	// Run test code
	sandbox();
}

