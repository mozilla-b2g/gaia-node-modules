import { createHash } from 'crypto';

export default function md5(string) {
  return createHash('md5').update(string).digest('hex');
}
