var fork = require('child_process').fork;

/**
 * Socket agent used for creating and controlling sockets in
 * child processes.
 */
function SocketAgent() {
  this.clients = [];
  this.namedClients = {};
}

SocketAgent.prototype = {
  '_spawn': function(socketType) {
    return fork('test/client/client.js', [socketType]);
  },

  /**
   * Spawns a new socket process. Can be accessed by index e.g,
   *  agent[0].connect(address);
   *
   * @param {String} socketType to create.
   */
  spawnClient: function(socketType) {
    var client = this._spawn(socketType);
    var index = this.clients.length;
    this.clients.push(client);

    var self = this;
    this[index] = (function() {
      this.current.client = this.clients[index];
      return this.current;
    }).call(this);
  },

  /**
   * Spawns a new named socket process. Can be accessed by name e.g,
   *  agent['name'].connect(address);
   *
   * @param {String} name to reference process by.
   * @param {String} socketType to create.
   */
  spawnNamedClient: function(name, socketType) {
    var client = this._spawn(socketType);
    this.namedClients[name] = client;

    this[name] = (function() {
      this.current.client = this.namedClients[name];
      return this.current;
    }).call(this);
  },

  /**
   * Disconnect all client processes and resets state.
   */
  reset: function() {
    this.current.client = null;

    for (var i=0; i < this.clients.length; ++i) {
      this.clients[i].disconnect();
    }
    this.clients = [];

    for (var client in this.namedClients) {
      client.disconnect();
    }
    this.namedClients = {};
  },

  // Returned object that acts on the referenced client
  current: {
    client: null,

    /**
     * Connect the client's socket to the specified address.
     *
     * @param {String} address to connect the socket to. Of the
     *                 form 'protocol://location:port'
     */
    connect: function(address) {
      this.client.send({'action': 'connect', 'address': address});
    },

    /**
     * Bind the client's socket to the specified address.
     *
     * @param {String} address to bind the socket to. Of the
     *                 form 'protocol://location:port'
     */
    bind: function(address) {
      this.client.send({'action': 'bind', 'address': address});
    },

    /**
     * Have the client's socket send a message.
     *
     * @param {Object} message to send. Must have 'action' as a key.
     */
    send: function(message) {
      this.client.send({'action': 'send', 'message': message});
    },

    /**
     * Sets a callback that gets called when the client's socket
     * receives a message.
     *
     * @param {Function} callback called on recv.
     */
    onRecv: function(callback) {
      this.client.on('message', callback);
    }
  }
};

module.exports = {
  SocketAgent: SocketAgent
};
