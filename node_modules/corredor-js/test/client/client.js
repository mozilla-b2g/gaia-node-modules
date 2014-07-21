var zmq = require('zmq');

function ClientApplication(socketType) {
  this.received = [];
  this.socket = zmq.socket(socketType);
  this.socket.on('message', function(action, data) {
    process.send(JSON.parse(data));
  }.bind(this));
}

ClientApplication.prototype = {
  connect: function(data) {
    this.socket.connect(data.address);
  },

  bind: function(data) {
    this.socket.bind(data.address);
  },

  send: function(data) {
    var message = data.message;
    var action = message.action;
    message = JSON.stringify(message);
    this.socket.send([action, message]);
  },
};

var client = new ClientApplication(process.argv[2]);
process.on('message', function(data) {
  client[data.action](data);
});

process.on('disconnect', function() {
  client.socket.close();
});
