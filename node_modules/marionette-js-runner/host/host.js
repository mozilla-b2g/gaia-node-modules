'use strict';

var EventEmitter = require('events').EventEmitter;
var Promise = require('promise');
var spawn = require('child_process').spawn;
var uuid = require('uuid');
var request = require('./lib/request');
var assert = require('assert');
var _ = require('lodash');

var VENV = 'VIRTUALENV_PATH' in process.env ?
  process.env.VIRTUALENV_PATH :
  __dirname + '/../venv';

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

  this.dead = false;
  this.onerror = this.onerror.bind(this);
  this.onexit = this.onexit.bind(this);
  this.process.on('error', this.onerror);
  this.process.on('exit', this.onexit);

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

      if (this.dead) {
        return Promise.resolve();
      }

      return new Promise(function(accept, reject) {
        this.process.removeListener('error', this.onerror);
        this.process.removeListener('exit', this.onexit);
        this.process.once('error', function(error) {
          this.process.removeListener('exit', accept);
          console.error('Python process error during shutdown!');
          reject(error);
        }.bind(this));

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
  },

  onerror: function(error) {
    console.error('Python process error!');
    console.error(error.toString());
    this.process.kill();
    this.dead = true;
  },

  onexit: function(exit) {
    console.error('Python process exited unexpectedly!');
    console.error('[code = ' + exit.code + ', signal = ' + exit.signal + ']');
    this.dead = true;
  }
};

Host.create = function() {
  var socketPath = '/tmp/marionette-socket-host-' + uuid.v1() + '.sock';
  var pythonChild = spawnVirtualEnv(
    'gaia-integration',
    ['--path=' + socketPath],
    { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] }  // Swallow python output
  );

  var failOnChildError = new Promise(function(accept, reject) {
    function onError(error) {
      console.error('Python process error during initial connect!');
      reject(error);
    }

    pythonChild.once('error', onError);
    pythonChild.once('exit', function(exit) {
      // Ensure we don't call error callback somehow...
      pythonChild.removeListener('error', onError);
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
