/*

 Screeps Typescript Test Helper

 We add the following to the global namespace to mimic the Screeps runtime:
 + lodash
 + Screeps game constants

 */
declare const global: any;
declare const _: any;

import * as lodash from "lodash";
import consts from "./mock/game";

global._ = lodash;

_.merge(global, consts);
