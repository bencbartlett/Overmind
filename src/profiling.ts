import {USE_PROFILER} from './config/config';
import * as Profiler from 'screeps-profiler';

export function profileClass(classToProfile: { new(...args: any[]): any }): void {
	if (USE_PROFILER) {
		Profiler.registerClass(classToProfile, classToProfile.name);
	}
}

Profiler.registerFN(profileClass, 'profileClass');
