import {USE_PROFILER} from '../~settings';
import profiler from './screeps-profiler';

// export {profile} from './profiler';

export function profile(target: Function): void;
export function profile(target: object, key: string | symbol, _descriptor: TypedPropertyDescriptor<Function>): void;
export function profile(target: object | Function, key?: string | symbol,
						_descriptor?: TypedPropertyDescriptor<Function>,): void {
	if (!USE_PROFILER) {
		return;
	}

	if (key) {
		// case of method decorator
		profiler.registerFN(target as Function, key as string);
		return;
	}

	// case of class decorator
	const ctor = target as any;
	if (!ctor.prototype) {
		return;
	}

	const className = ctor.name;
	profiler.registerClass(target as Function, className);

}
