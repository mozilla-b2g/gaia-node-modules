'use strict';

var EventEmitter = require('events').EventEmitter;
var Promise = require('promise');
var spawn = require('child_process').spawn;
var uuid = require('uuid');
var request = require('./lib/request');
var assert = require('assert');
var _ = require('lodash');

var VENV = __dirname + '/../venv';

/**
Wrapper for spawning a python process which expects a venv with particular
packages. Same interface as spawn but overrides path and ensures certain env
variables are not set which conflict.

@param {String} bin path to binary to execute.
@param {Array} argv list of arguments.
@param {Object} opts options for node's spawn.
@return {ChildProcess}
*/
function spawnVirtualEnv(bin, argv, opts) {
  opts = opts || {};
  // Clone current environment variables...
  var env = {};
  _.assign(env, process.env);
  opts.env = env;

  // Prepend binary wrappers to path.
  env.PATH = VENV + '/bin/:' + process.env.PATH;

  // Ensure we don't conflict with other wrappers or package managers.
  delete env.PYTHONHOME;

  return spawn(bin, argv, opts);
}


function Host(socketPath, process, log) {
  this.process = process;
  this.socketPath = socketPath;
  this.log = log;
  this.sessions = {};
  this.pendingSessions = [];

  EventEmitter.call(this);
}
module.exports = Host;

Host.prototype = {
  __proto__: EventEmitter.prototype,

  destroy: function() {
    // If there are any pending session creates wait for those to cleanly finish
    // first.
    if (this.pendingSessions.length) {
      return Promise.all(this.pendingSessions).then(this.destroy.bind(this));
    }

    var deleteSessions = Promise.all(
      _.map(this.sessions, function(session) {
        return session.destroy();
      })
    );

    return Promise.all(
      _.map(this.sessions, function(session) {
        return session.destroy();
      })
    )
    .then(function() {
      if (Object.keys(this.sessions).length !== 0) {
        return Promise.reject(new Error('Not all sessions were deleted!'));
      }

      return new Promise(function(accept) {
        this.process.once('exit', accept);
        this.process.kill();
      }.bind(this));
    }.bind(this));
  },

  /**
  Issue a request to the hosts underlying python http server.
  */
  request: function(path, options) {
    return request(this.socketPath, path, options);
  }
};

Host.create = function() {
  var socketPath = '/tmp/marionette-socket-host-' + uuid.v1() + '.sock';
  var pythonChild = spawnVirtualEnv(
    'gaia-integration',
    ['--path=' + socketPath],
    { stdio: [0, 1, 2, 'pipe'] }
  );

  var failOnChildError = new Promise(function(accept, reject) {
    pythonChild.addListener('error', reject);
    pythonChild.once('exit', function(exit) {
      // Ensure we don't call error callback somehow...
      pythonChild.removeListener('error', reject);
      reject(new Error(
        'Unexpected exit during connect: ' +
        'signal = ' + exit.signal + ', ' +
        'code = ' + exit.code
      ));
    });
  });

  var connect = request(socketPath, '/connect').then(function() {
    pythonChild.removeAllListeners('error');
    pythonChild.removeAllListeners('exit');
    return new Host(socketPath, pythonChild, pythonChild.stdio[3]);
  });

  return Promise.race([connect, failOnChildError]);
};
