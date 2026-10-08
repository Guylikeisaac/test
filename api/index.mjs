// Vercel entry: serves the same handler as `npm start`, locked to Mock.
// Live providers are never configured here — readConfig gets an empty environment,
// so no API key or CLI setting in the Vercel project can enable a model call.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createHandler, readConfig } from '../dist/server/app.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = process.env;
// Vercel only routes this project's own domains (and aliases) to the function, so any routed host is accepted;
// requests must still come from that same https origin.
// One token per deployment, identical across serverless instances (it is handed to any same-origin page anyway).
const token = createHash('sha256').update('aira-pulse:' + (env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_URL ?? 'local')).digest('hex');

export default createHandler(readConfig({}, root), fetch, undefined, undefined, () => undefined, { hosts: '*', token });
