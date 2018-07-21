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
 * Default controller signature; don't change this.
 * You can set your controller signature with the console command "setSignature()"
 */
export const DEFAULT_OVERMIND_SIGNATURE = leftAngleQuote + 'Overmind' + rightAngleQuote;

/**
 * If this is enabled, Memory.bot will default to true
 */
export const AUTOMATIC_MODE = true;

/**
 * If this is enabled, Memory.autoclaim will default to true (only used if Memory.bot is enabled)
 */
export const AUTOMATIC_CLAIMING = false;
