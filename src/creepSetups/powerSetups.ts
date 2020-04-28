import {log} from '../console/log';

export const PowerCreepNames: string[] = [
	'Zagara',
	'Dehaka',
	'Maar',
	'Zurvan',
	'Yagdra',
	'Brakk',
	'Dakrun',
	'Niadra',
	'Naktul',
	'Murvar',
	'Kraith',
	'Alexei',
	'Aleksander',
	'Torrasque',
	'Kukulza',
	'Frayne',
	'Matriarch',
	'Morik',
];

if (PowerCreepNames.length != _.unique(PowerCreepNames).length) {
	log.error(`PowerCreepNames not unique!`);
}

export interface PowerCreepSetup {
	name: string;
	upgradePriorities: {
		power: PowerConstant;
		maxLevel: number;
	}[];
}

export const PowerCreepSetups: { [role: string]: PowerCreepSetup } = {
	economy    : {
		name: 'economy',
		upgradePriorities: [
			{power: PWR_GENERATE_OPS, maxLevel: 5},
			{power: PWR_REGEN_SOURCE, maxLevel: 5},
			{power: PWR_REGEN_MINERAL, maxLevel: 5},
			{power: PWR_OPERATE_LAB, maxLevel: 5},
			{power: PWR_OPERATE_CONTROLLER, maxLevel: 2},
		]
	},
	broodmother: {
		name: 'broodmother',
		upgradePriorities: [
			{power: PWR_GENERATE_OPS, maxLevel: 5},
			{power: PWR_OPERATE_SPAWN, maxLevel: 5},
			{power: PWR_OPERATE_EXTENSION, maxLevel: 5},
			{power: PWR_OPERATE_TOWER, maxLevel: 4},
			{power: PWR_REGEN_SOURCE, maxLevel: 3},
			{power: PWR_FORTIFY, maxLevel: 2}
		]
	}
};

for (const role in PowerCreepSetups) {
	const setup = PowerCreepSetups[role];
	verifyPowerCreepSetup(role, setup, true);
}

/**
 * Checks that a setup is valid, such that each of the powers can be leveled to the max level specified
 */
function verifyPowerCreepSetup(role: string, setup: PowerCreepSetup, verbose = false): void {
	const priorities = setup.upgradePriorities;
	const powerLevels: { [power: string]: number } = {};
	let level = 0;
	while (true) {
		const upgradePower = _.find(priorities, powerPriority => {
			const {power, maxLevel} = powerPriority;
			powerLevels[power] = powerLevels[power] || 0;
			const powerLevel = powerLevels[power];
			if (powerLevel < maxLevel) {
				const requiredLevel = POWER_INFO[power].level[powerLevel];
				if (level >= requiredLevel) {
					return true;
				}
			}
		});
		if (upgradePower) {
			// Simulate upgrading the power
			if (verbose) {
				log.info(`Upgrading power ${upgradePower.power} to level ${powerLevels[upgradePower.power] + 1}, ` +
						 `Total level: ${level + 1}`);
			}
			powerLevels[upgradePower.power]++;
			level++;
		} else {
			// Check that everything has reached max level
			for (const powerPriority of priorities) {
				const {power, maxLevel} = powerPriority;
				if (powerLevels[power] != maxLevel) {
					log.error(`Invalid power creep setup: ${role}! Power ${power} at level ${powerLevels[power]}, ` +
							  `not max level ${maxLevel}!`);
				}
			}
			break;
		}
	}
}



