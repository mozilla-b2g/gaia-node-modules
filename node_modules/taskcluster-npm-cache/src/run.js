import { spawn } from 'mz/child_process';
import wait from 'event-to-promise';
import assert from 'assert';

export default async function(cmd, argv=[], opts={}) {
  assert(Array.isArray(argv), 'argv must be an array');
  opts.stdio = opts.stdio || 'inherit';
  let proc = spawn(cmd, argv, opts);
  let [exit] = await wait(proc, 'exit');

  if (exit != 0) {
    throw new Error(`Failed running ${cmd} ${argv.join(' ')} code: ${exit}`);
  }
}
