var child = require('child_process');
var logcat = require('adbkit-logcat');

/**
 * Initialize a stream connection to ADB logcat
 * @constructor
 */
var Adb = function() {
  this.process = child.spawn('adb', ['logcat', '-B']);
  this.stream = logcat.readStream(this.process.stdout);
};

/**
 * Stop the ADB stream and kill its child process
 */
Adb.prototype.end = function() {
  this.process.kill('SIGINT');
};

module.exports = Adb;