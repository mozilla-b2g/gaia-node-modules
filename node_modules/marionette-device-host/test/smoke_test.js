'use strict';
var assert = require('assert');

marionette('marionette-device-host', function() {
  var client = marionette.client();

  test('executeScript', function() {
    var result = client.executeScript(function() {
      return 1 + 1;
    });

    assert.strictEqual(result, 2, '1 + 1 should be 2');
  });
});
