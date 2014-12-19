var Promise = require('promise');
var exec = require('child_process').exec;

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