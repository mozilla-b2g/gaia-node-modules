default: b2g node_modules

b2g: node_modules
	./node_modules/.bin/mozilla-download --product b2g-desktop --branch mozilla-central .
	touch b2g

node_modules: package.json
	npm install

.PHONY: clean
clean:
	rm -rf b2g/ node_modules/ venv/

.PHONY: test
test: default test-unit test-integration

.PHONY: test-integration
test-integration:
	./bin/marionette-mocha --host-log stdout $(shell find test/integration) -t 100s

.PHONY: test-unit
test-unit:
	./node_modules/.bin/mocha -t 100s \
		test/*_test.js \
		test/bin/*_test.js

.PHONY: test-logger
test-logger:
	./bin/marionette-mocha test/logger/console-proxy.js -t 100s --verbose
