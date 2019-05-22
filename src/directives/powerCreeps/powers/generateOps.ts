import {profile} from "../../../profiler/decorator";
import {Power} from "./genericPower";

export const powerId = PWR_GENERATE_OPS;

/**
 * An abstract class for encapsulating power creep power usage.
 */
@profile
export abstract class GenerateOps extends Power{

	run() {}
}