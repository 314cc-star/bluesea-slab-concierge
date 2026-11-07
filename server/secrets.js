// Load secrets saved as Render "Secret Files" (/etc/secrets/<NAME>) into
// process.env when they are not set as environment variables.
// Imported first in index.js, before any module reads process.env.
import { readFileSync } from 'node:fs';

const NAMES = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'GEMINI_API_KEY', 'ADMIN_KEY'];
const DIRS = ['/etc/secrets', process.cwd()];

for (const name of NAMES) {
  if (process.env[name]) continue;
  for (const dir of DIRS) {
    try {
      let value = readFileSync(`${dir}/${name}`, 'utf8').trim();
      // Accept "NAME=value" as well as a bare value.
      if (value.startsWith(`${name}=`)) value = value.slice(name.length + 1).trim();
      if (value) {
        process.env[name] = value;
        console.log(`Loaded ${name} from secret file`);
        break;
      }
    } catch {
      /* not there: try the next place */
    }
  }
}
