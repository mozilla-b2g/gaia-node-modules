corredor-js
===========

> Spanish, corredor *m*, noun 1. corridor, hall 2. runner 3. broker

[![Build Status](https://travis-ci.org/ahal/corredor-js.png?branch=master)](https://travis-ci.org/ahal/corredor-js)

This is the NodeJS binding for [corredor](http://github.com/ahal/corredor), a framework for creating
distributed test harnesses and other applications.

Installation
============

To install corredor-js:

    $ npm install corredor-js

Corredor uses ZeroMQ for the transport. To install:

    # Ubuntu/Debian
    $ sudo apt-get install libzmq3-dev
    
    # Fedora
    $ sudo yum install zeromq3-devel
    
    # OSX
    $ sudo brew install zmq

If your OS is not listed or you want the latest version of zmq, please see the
[official downloads page](http://zeromq.org/intro:get-the-software).

Documentation
=============

Please [readthedocs](http://corredor.readthedocs.org/projects/corredor-js/en/latest/) for more information.

Testing
=======

To run tests:

    $ npm test
