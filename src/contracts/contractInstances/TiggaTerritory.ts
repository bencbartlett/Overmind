// // Contract 1: Recurring energy payment to Tigga for occupation rights in E0XS3X sector
// // Muon agreement: send 30k energy every 1k ticks from a room to W2S36
// // Tigga agreement: cessation of all hostilities to any of Muon's occupied rooms; allow occupation in rooms between
// // E1S37 to E9S39
// // Duration: until tick 6461275, renewable for 1M ticks at a time
//
// import {Contract} from '../contract';
// import {Colony} from '../../Colony';
// import {log} from '../../console/log';
// import {TerminalNetwork} from '../../logistics/TerminalNetwork';
// import {minBy} from '../../utilities/utils';
//
// export class Contract_TiggaTerritoryAgreement extends Contract {
//
// 	payment: number;
// 	period: number;
// 	description: string;
//
// 	constructor() {
// 		super();
// 		this.payment = 30000;
// 		this.period = 1000;
// 		this.description = 'Payment from Muon: truce / occupation rights';
// 	}
//
// 	isValid(): boolean {
// 		return Game.shard.name == 'shard2' && Game.time < 6461275;
// 	}
//
// 	run(): void {
// 		let destination = 'W2S36';
// 		let terminalNetwork = Overmind.terminalNetwork;
//
// 		if (this.isValid() && Game.time % this.period == 3) {
// 			let sender: StructureTerminal | undefined;
//
// 			let E2S43 = Overmind.colonies.E2S43 as Colony;
// 			if (E2S43 && E2S43.terminal && E2S43.terminal.cooldown == 0) {
// 				sender = E2S43.terminal;
// 			} else {
// 				// Send from the cheapest other terminal
// 				let senderTerminals = _.filter(terminalNetwork.terminals, t => t.store.energy > 100000 &&
// 																			   t.cooldown == 0);
// 				sender = minBy(senderTerminals, (sender: StructureTerminal) =>
// 					Game.market.calcTransactionCost(this.payment, sender.room.name, destination));
// 			}
//
// 			if (sender) {
// 				let cost = Game.market.calcTransactionCost(this.payment, sender.room.name, destination);
// 				sender.send(RESOURCE_ENERGY, this.payment, destination, this.description);
// 				TerminalNetwork.logTransfer(RESOURCE_ENERGY, this.payment, sender.room.name, destination);
// 				log.info(`Sent ${this.payment} energy from ${sender.room.name} to ` +
// 						 `${destination}. Fee: ${cost}`);
// 				Game.notify(`Sent ${this.payment} energy from ${sender.room.name} to ` +
// 							`${destination}. Fee: ${cost}`);
// 			} else {
// 				log.warning('No terminal to send payment for Contract_TiggaTerritoryAgreement!');
// 				Game.notify('No terminal to send payment for Contract_TiggaTerritoryAgreement!');
// 			}
// 		}
// 	}
// }
