default: node_modules

.PHONY: clean
clean:
	rm -rf node_modules/

node_modules: package.json
	npm install

.PHONY: test
test: default
	./node_modules/.bin/marionette-mocha test/smoke_test.js --host $(shell pwd)/index.js

.PHONY: ci
ci:
	nohup Xvfb :99 &
	DISPLAY=:99 make test
