// Vercel entry: serves the same handler as `npm start`, locked to Mock.
// Live providers are never configured here — readConfig gets an empty environment,
// so no API key or CLI setting in the Vercel project can enable a model call.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createHandler, readConfig } from '../dist/server/app.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = process.env;
const hosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL, ...(env.PUBLIC_HOSTS ?? '').split(',')]
  .map(host => host?.trim()).filter(Boolean);
// One token per deployment, identical across serverless instances (it is handed to any same-origin page anyway).
const token = createHash('sha256').update('aira-pulse:' + (env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_URL ?? 'local')).digest('hex');

export default createHandler(readConfig({}, root), fetch, undefined, undefined, () => undefined, { hosts: [...new Set(hosts)], token });
