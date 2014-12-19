var adb = require('adbkit');
var path = require('path');
var util = require('util');
var exec = require('./exec');
var config = require('./config.json');

var Orng = function(serial, callback) {
  if (!(this instanceof Orng)) {
    return new Orng(serial, callback);
  }

  var orng = this;

  if (typeof serial === 'function') {
    callback = serial;
    serial = null;
  }

  this.client = adb.createClient();

  this.client
    .listDevices()
    .then(function(devices) {
      if (!serial) {
        orng.deviceId = devices[0].id;
      } else {
        devices.forEach(function(device) {
          if (device.id === serial) {
            orng.deviceId = device.id;
          }
        });
      }

      orng.client
        .getProperties(orng.deviceId)
        .then(function(properties) {
          var model = properties['ro.product.model'];

          orng.devicePixelRatio = properties['ro.sf.lcd_density'] / 160;
          orng.device = config.devices.b2g[model] ||
            config.devices.android[model];

          return orng.install();
        })
        .then(function() {
          callback.call(orng, orng);
        });
    });
};

Orng.prototype.install = function() {
  var client = this.client;
  var deviceId = this.deviceId;

  return client
    .push(deviceId, path.join(__dirname, 'orng'), '/data/local/orng')
    .then(function() {
      return client.shell(deviceId, 'chmod 777 /data/local/orng');
    });
};

Orng.prototype.trigger = function() {
  var command = [
    '/data/local/orng',
    this.device.inputDevice,
    '/data/local/tmp/orng-cmd'
  ].join(' ');

  return this.client.shell(this.deviceId, command);
};

Orng.prototype.copyCommand = function(command) {
  var script = util.format('echo "%s" > /data/local/tmp/orng-cmd', command);
  return this.client.shell(this.deviceId, script);
};

Object
  .keys(config.events)
  .forEach(function(event) {
    Orng.prototype[event] = function() {
      var orng = this;
      var args = [config.events[event]].concat([].slice.call(arguments));
      return this
        .copyCommand(util.format.apply(util, args))
        .then(function() {
          return orng.trigger();
        });
    };
  });

module.exports = Orng;