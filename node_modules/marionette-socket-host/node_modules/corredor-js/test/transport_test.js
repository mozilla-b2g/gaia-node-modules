var SocketAgent = require('./client/agent').SocketAgent,
    Transport = require('../lib/transport'),
    assert = require('chai').assert;

suite('SocketPattern', function() {
  var subject;

  setup(function() {
    subject = new Transport.SocketPattern('pub');
  });

  test('should set empty action map', function() {
    assert.typeOf(subject.actionMap, 'object');
    assert.lengthOf(Object.keys(subject.actionMap), 0);
  });
});

suite('ExclusivePair', function() {
  var address;
  var agent;
  var pair;

  suiteSetup(function() {
    address = 'ipc:///tmp/corredor_js_test_exclusive_pair';
    agent = new SocketAgent();
    agent.spawnClient('pair');
    agent[0].bind(address);
    pair = new Transport.ExclusivePair();
    pair.connect(address);
  });

  suiteTeardown(function() {
    //agent.reset();
    //pair.close();
  });

  test('should send message', function(done) {
    var data = {'action': 'foo', 'bar': 'baz'};

    agent[0].onRecv(function(message) {
      assert.deepEqual(data, message);
      done();
    });

    pair.send(data);
  });

  test('should receive message', function(done) {
    var data = {'action': 'foo', 'bar': 'baz'};
    pair.registerAction('foo', function(message) {
      assert.deepEqual(data, message);
      done();
    });

    agent[0].send(data);
  });
});

suite('Publisher', function() {
  // TODO
});

suite('StreamPublisher', function() {
  // TODO
});
