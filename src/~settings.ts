// Global settings file containing player information

import {getUsername} from './utilities/utils';
import {leftAngleQuote, rightAngleQuote} from './utilities/stringConstants';

/**
 * Your username - you shouldn't need to change this.
 */
export const MY_USERNAME: string = getUsername();

/**
 * Enable this to build from source including screeps-profiler. (This is separate from Overmind-Profiler.)
 */
export const USE_PROFILER: boolean = false;

/**
 * Profiling is incredibly expensive and can cause the script to time out. By setting this option, you can limit the
 * number of colonies that will be handled while profiling. Colonies above this limit do not get run. */
export const PROFILE_COLONY_LIMIT = Math.ceil(Game.gcl.level / 2);

/**
 * Enable this to wrap evaluations of constructor, init, and run phase for each colony in try...catch statemenets.
 */
export const USE_TRY_CATCH: boolean = true;

/**
 * Default controller signature; don't change this.
 * You can set your controller signature with the console command "setSignature()"
 * Operation will be penalized by skipping every 5th tick for using a signature that does not contain the substring
 * "overmind" or the small-caps variant.
 */
const overmindPlain = 'Overmind';
export const OVERMIND_SMALL_CAPS = '\u1D0F\u1D20\u1D07\u0280\u1D0D\u026A\u0274\u1D05';
export const DEFAULT_OVERMIND_SIGNATURE = leftAngleQuote + OVERMIND_SMALL_CAPS + rightAngleQuote;
global.__DEFAULT_OVERMIND_SIGNATURE__ = DEFAULT_OVERMIND_SIGNATURE;

/**
 * If this is enabled, Memory.bot will default to true
 */
export const DEFAULT_OPERATION_MODE: operationMode = 'automatic';

/**
 * The global Overmind object will be re-instantiated after this many ticks. In the meantime, refresh() is used.
 */
export const NEW_OVERMIND_INTERVAL = 20;

