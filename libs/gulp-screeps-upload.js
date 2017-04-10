/*jshint esversion: 6, node: true */
'use strict';

const _ = require('lodash');
const gutil = require('gulp-util');
const deepEqual = require('deep-equal');
const gulpCollect = require('gulp-collect');
const https = require('https');
const path = require('path');
const Q = require('q');

module.exports = (email, password, branch, logAmount) => {
  return gulpCollect.list((fileVinyls, cb) => {
    let cbd = Q.defer();
    _gulpUploadVinylsAsModules(fileVinyls, cbd.makeNodeResolver(), email, password, branch, logAmount);
    return cbd.promise;
  });
};

var __lastUploaded = null;

function _gulpUploadVinylsAsModules(fileVinyls, cb, email, password, branch, logAmount) {
  let modules = {};
  for (let fileVinyl of fileVinyls) {
    let moduleName = path.basename(fileVinyl.path);
    modules[moduleName] = fileVinyl.contents.toString('utf-8');
  }

  if (logAmount && logAmount > 0) {
    gutil.log('Modules: ');
    for (let key in modules) {
      gutil.log(`- ${gutil.colors.cyan(key)}`);
    }
  }

  let data = { branch: branch, modules: modules };
  if (deepEqual(__lastUploaded, data)) {
    // gutil.log('Skipping upload due to equal outputs.');
    return cb(null, {});
  }

  __lastUploaded = data;

  gutil.log(`Uploading to branch ${gutil.colors.cyan(branch)}...`);

  let req = https.request({
    hostname: 'screeps.com',
    port: 443,
    path: '/api/user/code',
    method: 'POST',
    auth: `${email}:${password}`,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  }, res => {
    gutil.log(`Build ${gutil.colors.cyan('completed')} with HTTP response ${gutil.colors.magenta(res.statusCode)}`);
    cb(null, {});
  });

  req.end(JSON.stringify(data));
}
