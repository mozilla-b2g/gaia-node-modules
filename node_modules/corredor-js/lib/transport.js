var debug = require('debug')('corredor-js-client:SocketPattern'),
    util = require('util'),
    zmq = require('zmq');

function SocketPattern(socketType) {
  this.actionMap = {};

  this.socket = zmq.socket(socketType);
  this.socket.on('message', function(action, data) {
    debug('Received action: %s, data: %s', action, data);
    if (action in this.actionMap) {
      data = JSON.parse(data);
      this.actionMap[action].call(this, data);
    }
  }.bind(this));
}

SocketPattern.prototype.bind = function(address) {
  this.socket.bind(address);
  this.address = address;
};

SocketPattern.prototype.connect = function(address) {
  this.socket.connect(address);
  this.address = address;
};

SocketPattern.prototype.send = function(data) {
  var action = data.action;
  data = JSON.stringify(data);
  this.socket.send([action, data]);
};

SocketPattern.prototype.close = function() {
  this.socket.close();
};

function ExclusivePair() {
  SocketPattern.call(this, 'pair');
}
util.inherits(ExclusivePair, SocketPattern);

ExclusivePair.prototype.registerAction = function(action, callback) {
  this.actionMap[action] = callback;
};

function Publisher() {
  SocketPattern.call(this, 'pub');
}
util.inherits(Publisher, SocketPattern);

function StreamPublisher() {
  SocketPattern.call(this, 'pub');
}
util.inherits(StreamPublisher, SocketPattern);

StreamPublisher.prototype.bindStreamToAction = function(stream, action) {
  stream.setEncoding('utf8');
  stream.on('data', function(chunk) {
    this.socket.send({
      'action': action,
      'message': chunk,
      'encoding': 'utf8'
    });
  }.bind(this));
};

module.exports = {
  ExclusivePair: ExclusivePair,
  Publisher: Publisher,
  SocketPattern: SocketPattern,
  StreamPublisher: StreamPublisher
};
