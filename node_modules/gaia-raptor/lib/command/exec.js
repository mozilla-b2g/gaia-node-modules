var Promise = require('promise');
var exec = require('child_process').exec;

/**
 * Execute a child process using a promise to manage its state
 * @param command Command to execute via child process
 * @returns {Promise}
 */
module.exports = function(command) {
  return new Promise(function(resolve, reject) {
    exec(command, function(err, stdout, stderr) {
      if (err) {
        return reject(err, stderr);
      }

      resolve(stdout);
    })
  });
};