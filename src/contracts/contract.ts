// Contracts - contains code for making agreements with other players

// TODO: make a (better) extensible contracts module
export abstract class Contract {

	constructor() {

	}

	abstract isValid(): boolean;

	abstract run(): any;
}


