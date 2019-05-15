import {log} from './log';

const launchFrom = [
	'E26S47',
	'E22S46',
	'E24S49',
	'E22S49',
	'E16S47',
	'E25S52',
	'E12S47',
	'E15S49',
	'E13S44',
	'E8S45',
	'E8S48',
	'E3S46',
	'E5S47',
	'E3S48',
	'E2S52',
];
const launchTo = [
	'E19S53',
	'E17S54',
	'E18S56',
	'E15S53',
	'E15S57',
	'E16S59',
	'E13S55',
	'E12S58',
	'E11S52',
	'E9S52',
	'E8S57',
	'E5S53',
	'E3S55',
	'E3S58',
	'W2S59',
];
const launchPos = [
	[7, 15],
	[24, 33],
	[28, 17],
	[11, 25],
	[33, 23],
	[20, 13],
	[13, 29],
	[27, 40],
	[13, 20],
	[8, 29],
	[13, 20],
	[21, 17],
	[42, 42],
	[25, 26],
	[13, 29],
];

export function verifyLaunchManifest() {
	for (const i in launchFrom) {
		const from = launchFrom[i];
		const to = launchTo[i];
		const [x, y] = launchPos[i];
		const nuker: StructureNuker = Overmind.colonies[from].commandCenter.nuker;

		if (Game.map.getRoomLinearDistance(from, to) > NUKE_RANGE) {
			log.info(`${from} to ${to} is out of range!`);
		} else if (!nuker || nuker.ghodium < nuker.ghodiumCapacity || nuker.energy < nuker.energyCapacity) {
			log.info(`Not enough resources in ${from} nuker!`);
		} else {
			log.info(`Nuclear launch ${from} to ${to} is OK`);
		}

	}
}

export function doomsdayLaunch() {
	for (const i in launchFrom) {
		const from = launchFrom[i];
		const to = launchTo[i];
		const [x, y] = launchPos[i];
		const nuker: StructureNuker = Overmind.colonies[from].commandCenter.nuker;

		if (nuker.cooldown == 0) {
			const pos = new RoomPosition(x, y, to);
			const ret = nuker.launchNuke(pos);
			log.alert(`[NUCLEAR LAUNCH] Launching nuke from ${from} to ${pos.print}! Result: ${ret}`);
		}
	}
}
