/**
Node http/socket/promise wrapper.
*/

var http = require('http');
var debug = require('debug')('marionette-socket-host:request');
var Promise = require('promise');

var RETRIES = 100;
var RETRY_TIMER = 150;

module.exports = function request(socketPath, path, json, retry) {
  retry = retry || 0;
  var body = JSON.stringify(json);

  return new Promise(function(accept, reject) {
    var req = http.request({
      socketPath: socketPath,
      method: 'POST',
      path: path,
      headers: {
        'Content-Length': Buffer.byteLength(body),
        'Content-Type': 'application/json'
      }
    });


    // The unix socket server may or may not be ready at this point so we retry
    // up to 5 times to ensure we are connected...
    req.once('error', function(err) {
      if (retry > RETRIES) {
        debug('At maximum retries...');
        return reject(err);
      }

      debug('Error in socket request retrying...', err);
      setTimeout(function() {
        request(socketPath, path, json, retry + 1).then(accept, reject);
      }, RETRY_TIMER);
    });

    // request sender....
    req.write(body);

    // response handler...
    req.on('response', function(res) {
      var data = '';
      res.on('data', function(buffer) {
        data += buffer;
      });

      res.on('end', function() {
        var json = JSON.parse(data);
        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(new Error(json.message));
        } else {
          accept(json);
        }
      });
    });

    // send the request...
    req.end();
  });
};
