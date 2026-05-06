import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { realtimeGateway } from './lib/realtime.js';
import { startTableReleaseSweeper } from './services/table-release.service.js';

const app = createApp();
const server = http.createServer(app);

realtimeGateway.attach(server);
startTableReleaseSweeper();

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${env.port}`);
});
