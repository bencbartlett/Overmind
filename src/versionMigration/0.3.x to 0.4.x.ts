// Some migration code that gradually reboots all room planners to account for new changes

export function migrate_03X_04X() {
	// Change all hiveCluster overlords to new naming format
	for (let i in Memory.creeps) {
		if (Memory.creeps[i].overlord) {
			let hcName = Memory.creeps[i].overlord!.split(':')[0];
			if (hcName == 'commandCenter'
				|| hcName == 'hatchery'
				|| hcName == 'evolutionChamber'
				|| hcName == 'miningSite'
				|| hcName == 'upgradeSite') {
				let id = Memory.creeps[i].overlord!.split(':')[1];
				let roomObject = Game.getObjectById(id) as RoomObject | undefined;
				if (roomObject) {
					let overlordName = Memory.creeps[i].overlord!.split(':')[2];
					Memory.creeps[i].overlord = hcName + '@' + roomObject.pos.name + ':' + overlordName;
				}
			}
		}
	}
}
