import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { attachWebSocketServer } from './ws/socketServer';

const start = async () => {
  await connectDB();
  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer);
  httpServer.listen(env.port, () => {
    console.log(`RentDesk API running on port ${env.port}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
