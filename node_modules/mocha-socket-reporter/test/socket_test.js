var SocketReporter = require('../lib/reporter'),
    corredor = require('corredor-js');
    assert = require('assert'),
    sinon = require('sinon');

suite('SocketReporter', function() {
  var runner, on, log;

  setup(function() {
    runner = {
      on: function(type, listener) {}
    };

    on = sinon.spy(runner, 'on');
    socket = sinon.spy(corredor, 'Publisher');
    subject = new SocketReporter(runner);
    send = sinon.spy(subject.result, 'send');
    close = sinon.spy(subject.result, 'close');
  });

  teardown(function() {
    on.restore();
    socket.restore();
    send.restore();
    close.restore();
  });

  test('#constructor', function() {
    sinon.assert.calledWith(on, 'end');
    sinon.assert.calledWith(on, 'fail');
    sinon.assert.calledWith(on, 'pass');
    sinon.assert.calledWith(on, 'pending');
    sinon.assert.calledWith(on, 'test');
    sinon.assert.calledWith(on, 'test end');

    sinon.assert.called(socket);
    assert.strictEqual(subject.status, 'PASS');
  });

  test('#onEnd', function() {
    subject.onEnd();
    sinon.assert.calledWith(send, {'action': 'suite_end'});
    sinon.assert.calledWith(send, {'action': 'fin'});
    sinon.assert.called(close);
  });

  test('#onFail', function() {
    var testObj = {
      file: 'doge_such_broke_test.js',
      fullTitle: function() {
        return 'some title';
      }
    };
    subject.onFail(testObj);

    assert.strictEqual(subject.status, 'FAIL');
    sinon.assert.calledWith(send, {'action': 'test_status',
                                   'test': subject.getFile(testObj),
                                   'status': subject.status,
                                   'subtest': subject.getTitle(testObj),
                                   'expected': 'PASS'});
  });

  test('#onPass', function() {
    var testObj = {
      file: 'doge_much_pass_test.js',
      fullTitle: function() {
        return 'some title';
      }
    };
    subject.onPass(testObj);

    assert.strictEqual(subject.status, 'PASS');
    sinon.assert.calledWith(send, {'action': 'test_status',
                                   'test': subject.getFile(testObj),
                                   'subtest': subject.getTitle(testObj),
                                   'status': subject.status});
  });

  test('#onPending', function() {
    var testObj = {
      file: 'doge_very_pending_test.js',
      fullTitle: function() {
        return 'some title';
      }
    };
    subject.onPending(testObj);

    assert.strictEqual(subject.status, 'NOTRUN');
    sinon.assert.calledWith(send, {'action': 'test_status',
                                   'test': subject.getFile(testObj),
                                   'subtest': subject.getTitle(testObj),
                                   'status': subject.status});
  });

  test('#onTest', function() {
    var testObj = {
      file: 'doge_start_test_wow.js',
      fullTitle: function() {
        return 'some title';
      }
    };
    subject.onTest(testObj);

    sinon.assert.calledWith(send, {'action': 'test_start',
                                   'test': subject.getFile(testObj)});
  });

  test('#onTestEnd', function() {
    var testObj = {
      file: 'doge_end_test_wow.js',
      fullTitle: function() {
        return 'some title';
      }
    };
    subject.onTestEnd(testObj);

    sinon.assert.calledWith(send, {'action': 'test_end',
                                   'test': subject.getTitle(testObj),
                                   'status': subject.status});
  });

  test('#getTitle', function() {
    var result = subject.getTitle({
      fullTitle: function() {
        return 'some title TEST-END';
      }
    });

    assert.equal(result, 'some title ********');
  });

  test('#sanitize', function() {
    var str = 'Fuzzy PROCESS-CRASH was a TEST-END, ' +
              'fuzzy TEST-KNOWN-FAIL had no TEST-PASS, ' +
              'fuzzy TEST-START wasn\'t TEST-UNEXPECTED-FAIL was he?';
    var result = subject.sanitize(str);
    assert.equal(result,
        'Fuzzy ************* was a ********, ' +
        'fuzzy *************** had no *********, ' +
        'fuzzy *********** wasn\'t ******************** was he?');
  });
});
