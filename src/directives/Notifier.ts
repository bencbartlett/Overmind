import {log} from '../console/log';
import {printRoomName} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';

export enum NotifierPriority {
	Critical = 0,
	High     = 1,
	Normal   = 2,
	Low      = 3,
}

// An alert is a one-tick notification which must be refreshed every tick, e.g. while a directive is up
interface Alert {
	message: string;
	priority: number;
	roomName?: string;
}

// A notification lasts for a specified length of time and does not need to be refreshed, e.g. colony levels up
interface Notification {
	message: string;
	roomName: string;
	duration: number;
}

interface NotifierMemory {
	notifications: Notification[];
}

/**
 * Records one-time and persistent notifications from various in-game events
 */
export class Notifier {

	memory: NotifierMemory;
	alerts: Alert[];
	notifications: Notification[];

	constructor() {
		this.alerts = [];
		this.notifications = [];
	}

	clear() {
		this.alerts = [];
	}

	alert(message: string, roomName?: string | undefined, priority = NotifierPriority.Normal) {
		// Register an alert to be displayed this in the notifications visual box
		const alert: Alert = {message, roomName, priority};
		this.alerts.push(alert);
	}

	// TODO: finish
	notify(message: string, roomName: string, duration = 100, email = false) {
		log.alert(printRoomName(roomName) + ': ' + message);

	}

	// init() {
	//
	// }
	//
	// run() {
	//
	// }

	generateNotificationsList(links = false): string[] {
		const sortedAlerts = _.sortBy(this.alerts, alert => alert.priority);
		return _.map(sortedAlerts, alert => {
			if (alert.roomName) {
				return (links ? printRoomName(alert.roomName) : alert.roomName) + ': ' + alert.message;
			} else {
				return alert.message;
			}
		});
	}

	visuals(): void {
		const notificationMessages = this.generateNotificationsList();
		Visualizer.drawNotifications(notificationMessages);
	}

}
