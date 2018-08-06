// Global settings file containing player information

import {getUsername} from './utilities/utils';
import {leftAngleQuote, rightAngleQuote} from './utilities/stringConstants';

/**
 * Your username - you shouldn't need to change this.
 */
export const MY_USERNAME: string = getUsername();

/**
 * Enable this to build from source including screeps profiler.
 */
export const USE_PROFILER: boolean = false;

/**
 * Enable this to wrap evaluations of constructor, init, and run phase for each colony in try...catch statemenets.
 */
export const USE_TRY_CATCH: boolean = true;

/**
 * Default controller signature; don't change this.
 * You can set your controller signature with the console command "setSignature()"
 */
const overmindPlain = 'Overmind';
export const OVERMIND_SMALL_CAPS = '\u1D0F\u1D20\u1D07\u0280\u1D0D\u026A\u0274\u1D05';
export const DEFAULT_OVERMIND_SIGNATURE = leftAngleQuote + OVERMIND_SMALL_CAPS + rightAngleQuote;
global.__DEFAULT_OVERMIND_SIGNATURE__ = DEFAULT_OVERMIND_SIGNATURE;

/**
 * If this is enabled, Memory.bot will default to true
 */
export const DEFAULT_OPERATION_MODE: operationMode = 'automatic';
