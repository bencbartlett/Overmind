import {Mem} from '../Memory';
import {log} from '../console/log';

interface VersionMigratorMemory {
	versions: { [version: string]: boolean };
}

export class VersionMigration {

	static run(): void {
		// if (!this.memory.versions['02Xto03X']) {
		// 	this.migrate_02X_03X();
		// }
		// if (!this.memory.versions['03Xto04X']) {
		// 	this.migrate_03X_04X();
		// }
		if (!this.memory.versions['04Xto05X']) {
			this.migrate_04X_05X();
		}
	}

	static get memory(): VersionMigratorMemory {
		return Mem.wrap(Memory.Overmind, 'versionMigrator', {
			versions: {}
		});
	}

	// static migrate_02X_03X() {
	// 	// This technically won't run correctly because it gets run only on global reset, but no one is using v0.2.x
	// 	// anymore anyway, so I don't feel the need to maintain support for this function
	// 	let allColoniesUpdated = true;
	// 	let i = 0;
	// 	for (let name in Memory.colonies) {
	// 		let rpMemory = Memory.colonies[name].roomPlanner;
	// 		let lastBuilt = rpMemory.lastGenerated;
	// 		// Reboot colony room planners one at a time every 3 ticks
	// 		if (!lastBuilt) {
	// 			allColoniesUpdated = false;
	// 			if (Game.time % 100 == 3 * i) {
	// 				// Delete all white/white routing hints from memory
	// 				rpMemory.savedFlags = _.filter(rpMemory.savedFlags, (flag: {secondaryColor: number}) =>
	// 					flag.secondaryColor != COLOR_WHITE);
	// 				rpMemory.active = true;
	// 				log.alert(`Version migration: rebooting roomPlanner for colony ${name}!`);
	// 			} else if (Game.time % 100 == 3 * i + 1) {
	// 				colony.roomPlanner.finalize(true);
	// 			}
	// 		}
	// 	}
	// 	if (allColoniesUpdated) {
	// 		this.memory.versions['02Xto03X'] = true;
	// 		log.alert(`Version migration from 0.2.x -> 0.3.x completed successfully.`);
	// 	}
	// }

	// static migrate_03X_04X() {
	// 	// Update creep memory
	// 	for (let i in Memory.creeps) {
	// 		// Migrate all old-style overlord references to new ones
	// 		if (Memory.creeps[i].overlord) {
	// 			let hcName = Memory.creeps[i].overlord!.split(':')[0];
	// 			if (hcName == 'commandCenter'
	// 				|| hcName == 'hatchery'
	// 				|| hcName == 'evolutionChamber'
	// 				|| hcName == 'miningSite'
	// 				|| hcName == 'upgradeSite') {
	// 				let id = Memory.creeps[i].overlord!.split(':')[1];
	// 				let roomObject = Game.getObjectById(id) as RoomObject | undefined;
	// 				if (roomObject) {
	// 					let overlordName = Memory.creeps[i].overlord!.split(':')[2];
	// 					Memory.creeps[i].overlord = hcName + '@' + roomObject.pos.name + ':' + overlordName;
	// 				}
	// 			}
	// 		}
	// 		// Change all miner roles to drone roles
	// 		if (Memory.creeps[i].role == 'miner') {
	// 			Memory.creeps[i].role = 'drone';
	// 		}
	// 	}
	// 	// Delete old-style miningSite overlords from memory
	// 	OvermindConsole.deepCleanMemory();
	// 	this.memory.versions['03Xto04X'] = true;
	// 	log.alert(`Version migration from 0.3.x -> 0.4.x completed successfully.`);
	// }

	static migrate_04X_05X() {
		for (let i in Memory.creeps) {
			if (Memory.creeps[i].overlord) {
				let hcName = Memory.creeps[i].overlord!.split('@')[0];
				if (hcName != 'miningSite' && hcName != 'extractionSite') {
					let overlordName = _.last(Memory.creeps[i].overlord!.split(':'));
					Memory.creeps[i].overlord = hcName + ':' + overlordName;
				}
			}
		}
		this.memory.versions['04Xto05X'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x completed successfully.`);
	}

}