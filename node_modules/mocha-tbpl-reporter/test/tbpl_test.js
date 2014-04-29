var TBPL = require('../lib/tbpl'),
    assert = require('assert'),
    sinon = require('sinon');

suite('TBPL', function() {
  var runner, on, log;

  setup(function() {
    runner = {
      on: function(type, listener) {}
    };

    on = sinon.spy(runner, 'on');
    log = sinon.spy(console, 'log');
    subject = new TBPL(runner);
  });

  teardown(function() {
    on.restore();
    log.restore();
  });

  test('#constructor', function() {
    sinon.assert.calledWith(on, 'end');
    sinon.assert.calledWith(on, 'fail');
    sinon.assert.calledWith(on, 'pass');
    sinon.assert.calledWith(on, 'pending');
    sinon.assert.calledWith(on, 'test');
    sinon.assert.calledWith(on, 'test end');
    assert.strictEqual(subject.failing, 0);
    assert.strictEqual(subject.passing, 0);
    assert.strictEqual(subject.pending, 0);
  });

  test('#onEnd', function() {
    subject.onEnd();
    assert.ok(log.calledWith('*~*~* Results *~*~*'));
    assert.ok(log.calledWith('passed: %d', 0));
    assert.ok(log.calledWith('failed: %d', 0));
    assert.ok(log.calledWith('todo: %d', 0));
  });

  test('#onFail', function() {
    var failing = subject.failing;
    var file = 'doge_such_broke_test.js';
    subject.onFail({
      file: file,
      fullTitle: function() {
        return 'some title';
      }
    });

    assert.strictEqual(subject.failing, failing + 1);
    assert.ok(log.calledWith(
      'TEST-UNEXPECTED-FAIL | %s | %s',
      file,
      'some title'
    ));
  });

  test('#onPass', function() {
    var passing = subject.passing;
    subject.onPass({
      fullTitle: function() {
        return 'some title';
      }
    });

    assert.strictEqual(subject.passing, passing + 1);
    assert.ok(log.calledWith('TEST-PASS | %s', 'some title'));
  });

  test('#onPending', function() {
    var pending = subject.pending;
    subject.onPending({
      fullTitle: function() {
        return 'some title';
      }
    });

    assert.strictEqual(subject.pending, pending + 1);
    assert.ok(log.calledWith('TEST-PENDING | %s', 'some title'));
  });

  test('#onTest', function() {
    subject.onTest({
      fullTitle: function() {
        return 'some title';
      }
    });

    assert.ok(log.calledWith('TEST-START | %s', 'some title'));
  });

  test('#onTestEnd', function() {
    subject.onTestEnd({
      fullTitle: function() {
        return 'some title';
      }
    });

    assert.ok(log.calledWith('TEST-END | %s', 'some title'));
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
