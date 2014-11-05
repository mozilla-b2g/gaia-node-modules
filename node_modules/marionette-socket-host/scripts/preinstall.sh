#!/bin/bash -e

ZMQ_NAME=zeromq-4.0.4
ZMQ_DOWNLOAD_URL=http://download.zeromq.org/$ZMQ_NAME.tar.gz

if ! pkg-config libzmq --exists; then
  SYS=`uname -s`
  function install_zmq_from_source {
    echo "Installing zmq from source, requires sudo"
    /usr/bin/curl -OLsS $ZMQ_DOWNLOAD_URL
    if [ ! -d $ZMQ_NAME ]; then mkdir $ZMQ_NAME; fi
    tar --strip-components 1 -x -m -f $ZMQ_NAME.tar.gz -C $ZMQ_NAME
    pushd $ZMQ_NAME && ./configure && make && sudo make install && popd
    if [ -d $ZMQ_NAME ]; then rm -rf $ZMQ_NAME; fi
    if [ -f $ZMQ_NAME.tar.gz ]; then rm $ZMQ_NAME.tar.gz; fi
    # update system library cache
    sudo ldconfig
  }
  if [ $SYS == 'Darwin' ]; then 
    echo "installing zmq from brew"
    which brew
    if [ $? == 0 ]; then
      brew install zmq
    else
      install_zmq_from_source
    fi
  else
    install_zmq_from_source
  fi
fi
