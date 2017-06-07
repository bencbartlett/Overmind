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
// External libraries
import './lib/Traveler'; // BonzAI's excellent moveTo() replacement
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
import {Preprocessing} from './preprocessing';
import {DataLogger} from './logging/data_logger';
import {visuals} from './visuals/visuals';
import profiler = require('./lib/screeps-profiler');  // gdborton's CPU profiler
// import {migrate} from './versionMigration/migration';

// Global declarations
declare var Overmind: IOvermind;
declare var flagCodes: { [category: string]: flagCat };

// Enable screeps profiler
// profiler.enable();

// Main loop ===========================================================================================================

export function loop() {
	// profiler.wrap(function () {
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
	// Preprocessing
	let preprocessing = new Preprocessing();
	preprocessing.run();
	// Create global flagCodes reference (avoids circular imports)
	global.flagCodes = flagCodesMap;
	// Initialize Overmind object, wrapping all creeps in Game.icreeps and registering them to colonies
	global.Overmind = new OM();

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
	// Log stats
	var logger = new DataLogger();
	logger.run();
	// Draw visuals
	if (Game.cpu.bucket > 7500) {
		visuals.drawGlobalVisuals();
	}
	// });
}

