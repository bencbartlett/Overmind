import {Mem} from '../memory/Memory';
import {log} from '../console/log';
import {DEFAULT_OVERMIND_SIGNATURE} from '../~settings';

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
		if (!this.memory.versions['04Xto05X_part2']) {
			this.migrate_04X_05X_part2();
		}
		if (!this.memory.versions['04Xto05X_part3']) {
			this.migrate_04X_05X_part3();
		}
		if (!this.memory.versions['05Xto051']) {
			this.migrate_050_051();
		}
		if (!this.memory.versions['05Xto051_part2']) {
			this.migrate_050_051_part2();
		}
		if (!this.memory.versions['05Xto051_part3']) {
			this.migrate_050_051_part3();
		}
		if (!this.memory.versions['05Xto051_part4']) {
			this.migrate_050_051_part4();
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
		let migrateClusterNames = ['commandCenter', 'evolutionChamber', 'hatchery', 'upgradeSite'];
		for (let i in Memory.creeps) {
			if (Memory.creeps[i].overlord) {
				let hcName = Memory.creeps[i].overlord!.split('@')[0];
				if (migrateClusterNames.includes(hcName)) {
					let overlordName = _.last(Memory.creeps[i].overlord!.split(':'));
					if (overlordName == 'hatchery') {
						overlordName = 'supply';
					}
					let colonyName = Memory.creeps[i].colony;
					Memory.creeps[i].overlord = hcName + '@' + colonyName + ':' + overlordName;
				}
			}
		}
		for (let i in Memory.rooms) {
			delete (<any>Memory.rooms[i]).tick;
			delete (<any>Memory.rooms[i]).score;
		}
		// Change to new signature
		let oldSignature = '[Overmind]';
		if ((<any>Memory).signature && (<any>Memory).signature.includes(oldSignature)) {
			(<any>Memory).signature = (<any>Memory).signature.replace(oldSignature, DEFAULT_OVERMIND_SIGNATURE);
		}
		this.memory.versions['04Xto05X'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x (part 1) completed successfully.`);
	}

	static migrate_04X_05X_part2() {
		// Copy old memory to new memory locations
		if (Memory.signature) {
			Memory.settings.signature = (<any>Memory).signature;
		}
		delete (<any>Memory).signature;
		delete (<any>Memory).bot;
		delete (<any>Memory).log;
		delete (<any>Memory).autoclaim;
		this.memory.versions['04Xto05X_part2'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x (part 2) completed successfully.`);
	}

	static migrate_04X_05X_part3() {
		for (let i in Memory.creeps) {
			if (Memory.creeps[i].overlord) {
				let ref = Memory.creeps[i].overlord as string;
				let n = ref.lastIndexOf(':');
				ref = ref.slice(0, n) + ref.slice(n).replace(':', '>');
				Memory.creeps[i].overlord = ref;
			}
		}
		this.memory.versions['04Xto05X_part3'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x (part 3) completed successfully.`);
	}

	static migrate_050_051() {
		// Destroy all links that aren't hatchery or commandCenter links
		for (let id in Game.structures) {
			const s = Game.structures[id];
			if (s.structureType == STRUCTURE_LINK) {
				const isCommandCenterLink = s.pos.findInRange(_.compact([s.room.storage!,
																		 s.room.terminal!]), 2).length > 0;
				const isHatcheryLink = s.pos.findInRange(s.room.spawns, 2).length > 0;
				if (!isCommandCenterLink && !isHatcheryLink) {
					s.destroy();
				}
			}
		}
		let count = 0;
		for (let name in Game.creeps) {
			const creep = Game.creeps[name];
			if (creep.memory.role == 'drone' &&
				creep.memory.overlord && creep.memory.overlord.includes('miningSite')) {
				creep.suicide();
				count++;
			}
		}
		this.memory.versions['05Xto051'] = true;
		log.alert(`Genocide complete: suicided ${count} innocent drones.`);
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 1) completed successfully.`);
	}

	static migrate_050_051_part2() {
		// Destroy all links that aren't hatchery or commandCenter links
		for (let name in Game.creeps) {
			const creep = Game.creeps[name];
			if (creep.memory.role == 'reserver') {
				creep.memory.role = 'infestor';
			} else if (creep.memory.role == 'guard') {
				creep.memory.role = 'broodling';
			}
		}
		this.memory.versions['05Xto051_part2'] = true;
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 2) completed successfully.`);
	}

	static migrate_050_051_part3() {
		if (Memory.assimilator && Memory.assimilator.users) {
			delete Memory.assimilator.users;
		}
		this.memory.versions['05Xto051_part3'] = true;
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 3) completed successfully.`);
	}

	static migrate_050_051_part4() {
		const protectedKeywords = ['suspendUntil', 'amount', 'created', 'persistent', 'setPosition', 'rotation',
								   'colony', 'parent', 'pathing', 'stats', 'safeTick', 'enhanced', 'persistent',
								   'recoveryWaypoint', 'totalResources', 'maxPathLength', 'maxLinearRange'];
		for (let name in Memory.flags) {
			for (let prop in Memory.flags[name]) {
				if (!protectedKeywords.includes(prop)) {
					delete (<any>Memory.flags[name])[prop];
				}
			}
		}
		this.memory.versions['05Xto051_part4'] = true;
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 4) completed successfully.`);
	}

}