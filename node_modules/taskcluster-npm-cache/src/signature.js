/**
This module generates a signature we can use to group caches based on node
major versions and current os.
*/

import os from 'os';

export default function() {
  let type = os.type().toLowerCase();
  let arch = os.arch().toLowerCase();
  let [nodeMajor, nodeMinor] = process.versions.node.split('.');

  return `node-v${nodeMajor}-${nodeMinor}.${type}-${arch}`;
};
