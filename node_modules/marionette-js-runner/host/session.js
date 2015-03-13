'use strict';

var Promise = require('promise');
var assert = require('assert');
var assign = require('object-assign');
var fsPath = require('path');
var util = require('util');
var indent = require('indent-string');
var mozrunner = require('mozilla-runner');

var detectBinary = Promise.denodeify(mozrunner.detectBinary);

var DEFAULT_LOCATION = fsPath.join(process.cwd(), 'b2g');

/**
Figure out where the b2g-bin lives based on options.

@param {Object} options (as described by .help).
@return {Promise<Null|String>} null if none is needed or a path.
*/
function resolveBinary(options) {
  if (options.buildapp !== 'desktop') {
    return Promise.resolve();
  }
  if (options.runtime) {
    return Promise.resolve(options.runtime);
  }

  var binary = options.target || DEFAULT_LOCATION;
  return detectBinary(binary, { product: 'b2g' });
}

function Session(host, id, options) {
  this.host = host;
  this.id = id;
  this.options = options;
}

Session.prototype = {
  $rpc: { methods: ['destroy', 'checkError'] },

  checkError: function(profileConfig, err) {
    var request = {
      // TODO: This does not work for devices as is...
      dump_directory: profileConfig.profile + '/minidumps',
      symbols_path: this.options.symbols_path,
      dump_save_path: this.options.dump_path
    };

    var start = Date.now();
    return this.host.request('/get_crash_info', request).
      then(function(result) {
        // If for some reason stackwalk implodes then show some useful output.
        if (result.stackwalk_retcode !== 0) {
          var msg = 'Crash detected but error running stackwalk\n';

          if (Array.isArray(msg.stackwalk_errors)) {
            result.stackwalk_errors.forEach(function(str) {
              msg += indent(str, ' ', 2) + '\n';
            });
          }

          var error = new Error(msg);
          error.name = 'ProcessCrash';

          error.stack =
            msg +
            '\n' +
            indent((result.stackwalk_stderr || ''), ' ', 4);

          throw error;
        }

        var msg = util.format('Crash detected at: %s', result.signature);
        var error = new Error(msg);
        error.stack = msg + '\n' + result.stackwalk_stdout;
        error.name = 'ProcessCrash Stackwalk';
        return error;
      });
  },

  destroy: function() {
    var payload = { id: this.id };
    return this.host.request('/stop_runner', payload).then(function() {
      delete this.host.sessions[this.id];
      this.id = null;
    }.bind(this));
  }
};


Session.create = function(host, profile, options) {
  var promise = Promise.resolve().then(function() {
    // shallow clone options...
    options = assign(
      // default options...
      {
        profile: profile,
        buildapp: 'desktop'
      },
      options
    );

    // Handle mutually exclusive options...
    assert(
      !(options.b2g_home && options.buildapp === 'desktop'),
      'Can only specify --b2gpath with a device or emulator buildapp.'
    );
    assert(
      !(!options.b2g_home && options.buildapp === 'emulator'),
      'Can only specify --b2gpath with a device or emulator buildapp.'
    );

    return resolveBinary(options).then(function(binary) {
      return host.request('/start_runner', {
        binary: binary,
        options: options
      });
    }).then(function(result) {
      var session = new Session(host, result.id, options);
      host.sessions[result.id] = session;
      host.pendingSessions.splice(host.pendingSessions.indexOf(promise), 1);
      return session;
    });
  });
  host.pendingSessions.push(promise);
  return promise;
};

module.exports = Session;
