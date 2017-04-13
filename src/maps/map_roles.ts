// Wrapper for task require statements.
// Example:
// var roles = require('roles');
// var role = roles('upgrader');

import {Role} from '../roles/Role';
import {roleClaimer} from "../roles/role_claimer";
import {roleDestroyer} from "../roles/role_destroyer";
import {roleGuard} from "../roles/role_guard";
import {roleHauler} from "../roles/role_hauler";
import {roleHealer} from "../roles/role_healer";
import {roleLinker} from "../roles/role_linker";
import {roleMiner} from "../roles/role_miner";
import {roleMineralSupplier} from "../roles/role_mineralSupplier";
import {roleReserver} from "../roles/role_reserver";
import {roleScout} from "../roles/role_scout";
import {roleSieger} from "../roles/role_sieger";
import {roleSupplier} from "../roles/role_supplier";
import {roleUpgrader} from "../roles/role_upgrader";
import {roleWorker} from "../roles/role_worker";

export function roles(roleName: string): Role | void {
    switch (roleName) {
        case 'claimer':
            return new roleClaimer;
        case 'destroyer':
            return new roleDestroyer;
        case 'guard':
            return new roleGuard;
        case 'hauler':
            return new roleHauler;
        case 'healer':
            return new roleHealer;
        case 'linker':
            return new roleLinker;
        case 'miner':
            return new roleMiner;
        case 'mineralSupplier':
            return new roleMineralSupplier;
        case 'reserver':
            return new roleReserver;
        case 'scout':
            return new roleScout;
        case 'sieger':
            return new roleSieger;
        case 'supplier':
            return new roleSupplier;
        case 'upgrader':
            return new roleUpgrader;
        case 'worker':
            return new roleWorker;
    }
}
