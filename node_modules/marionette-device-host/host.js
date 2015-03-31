'use strict';
var Promise = require('promise');
var debug = require('debug')('marionette-device-host');
var spawn = require('child_process').spawn;

function Host() {
}
module.exports = Host;

Host.prototype.destroy = function() {
  return Promise.resolve();
};

Host.createHost = function() {
  return Promise.resolve(new Host());
};

Host.createSession = function(host, profile, options) {
  options = options || {};
  var session = new Session(host, profile, options);

  // TODO(gaye): Need to adb copy profile over.
  debug('Will start adb port forwarding.');
  return adb('forward', ['tcp:' + options.port, 'tcp:2828'])
  .then(function() {
    if (!options.restart) {
      return Promise.resolve();
    }

    debug('Will stop b2g.');
    return adb('shell', ['stop', 'b2g']).then(function() {
      return adb('shell', ['start', 'b2g']);
    });
  })
  .then(function() {
    return session;
  });
};

function Session(host, profile, options) {
  this.host = host;
  this.profile = profile;
  this.options = options;
  this.port = options.port;
}

Session.prototype = {
  $rpc: { methods: ['destroy'] },

  destroy: function() {
    debug('Will stop adb port forwarding.');
    return adb('forward', ['--remove', 'tcp:' + this.port]);
  }
};

function adb(cmd, args) {
  function ondata(data) {
    debug('[adb ' + cmd + '] ' + data);
  }

  args.unshift(cmd);

  var proc = spawn('adb', args);
  proc.stdout.on('data', ondata);
  proc.stderr.on('data', ondata);

  return new Promise(function(accept, reject) {
    proc.on('error', function(error) {
      proc.removeListener('close', onclose);
      reject(error);
    });

    function onclose(code) {
      if (code === 0) {
        return accept();
      }

      reject(new Error(cmd + ' exited with code: ' + code));
    }

    proc.on('close', onclose);
  });
}
