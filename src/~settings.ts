// Global settings file containing player information

import {leftAngleQuote, rightAngleQuote} from './utilities/stringConstants';
import {
	getMyUsername,
	getReinforcementLearningTrainingVerbosity,
	onPublicServer,
	onTrainingEnvironment
} from './utilities/utils';

/**
 * My Screeps username; used for a variety of updating and communications purposes. (Changing this might break things.)
 */
export const MUON = 'Muon';

/**
 * Your username - you shouldn't need to change this.
 */
export const MY_USERNAME: string = getMyUsername();

/**
 * Enable this to build from source including screeps-profiler. (This is separate from Overmind-Profiler.)
 */
export const USE_SCREEPS_PROFILER: boolean = false;

/**
 * Profiling is incredibly expensive and can cause the script to time out. By setting this option, you can limit the
 * number of colonies that will be handled while profiling. Colonies above this limit do not get run.
 */
export const PROFILER_COLONY_LIMIT = Math.ceil(Game.gcl.level / 2);

/**
 * While profiling, ensure these colonies are included in the randomly chosen ones specified by PROFILER_COLONY_LIMIT.
 */
export const PROFILER_INCLUDE_COLONIES: string[] = [/*'E15S49'*/];

/**
 * Enable this to wrap evaluations of constructor, init, and run phase for each colony in try...catch statemenets.
 */
export const USE_TRY_CATCH: boolean = true;

/**
 * Enable this to suppress alerts of invalid flag color codes. (Don't do this unless you know what you're doing.)
 */
export const SUPPRESS_INVALID_DIRECTIVE_ALERTS: boolean = false;

/**
 * Default controller signature; don't change this.
 * You can set your controller signature with the console command "setSignature()"
 * Operation will be penalized by skipping every 3rd tick for using a signature that does not contain the substring
 * "overmind" or the small-caps variant.
 */
const OVERMIND_PLAIN = 'Overmind';
export const OVERMIND_SMALL_CAPS = '\u1D0F\u1D20\u1D07\u0280\u1D0D\u026A\u0274\u1D05';
export const DEFAULT_OVERMIND_SIGNATURE = leftAngleQuote + OVERMIND_SMALL_CAPS + rightAngleQuote;
global.__DEFAULT_OVERMIND_SIGNATURE__ = DEFAULT_OVERMIND_SIGNATURE;

/**
 * If this is enabled, Memory.bot will default to true. This will not change the mode if already set - use setMode().
 */
export const DEFAULT_OPERATION_MODE: operationMode = 'automatic';

/**
 * Limit how many rooms you can claim (for any shard)
 */
export const MAX_OWNED_ROOMS = Infinity;

/**
 * If you are running on shard3 (CPU limit 20), only claim this many rooms
 */
export const SHARD3_MAX_OWNED_ROOMS = 3;

/**
 * The amount of credits that Overmind will try to keep in the bank. Default:
 * Private servers: 1,000 (will spend aggressively)
 * Public servers: 100,000 if you are below RCL 10, otherwise 1,000,000.
 */
export const RESERVE_CREDITS = onPublicServer() ? (Game.gcl.level >= 10 ? 1e6 : 1e5) : 1000;

/**
 * The global Overmind object will be re-instantiated after this many ticks. In the meantime, refresh() is used.
 */
export const NEW_OVERMIND_INTERVAL = onPublicServer() ? 20 : 5;

/**
 * Master scale for the RoomVisuals GUI // TODO: not plugged in yet
 */
export const GUI_SCALE = 1.0;

/**
 * If this is set to true, a stripped-down version of Overmind suitable for training with my python screeps environment
 * will be run instead. The main loop will be disabled and creeps will be controlled based on serialized actions
 * communicated to them from the RL model through memory.
 * WARNING: enabling RL_TRAINING_MODE will wipe the contents of your memory!
 */
export const RL_TRAINING_MODE = onTrainingEnvironment();

/**
 * Configure how much stuff gets logged to console
 * 0: no logging
 * 1: log every 100th, 101th tick
 * 2: log every tick
 */
export const RL_TRAINING_VERBOSITY = getReinforcementLearningTrainingVerbosity();
