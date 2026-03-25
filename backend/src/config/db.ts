import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env';

export const connectDB = async () => {
  if (process.env.DNS_SERVERS) {
    const servers = process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
    if (servers.length > 0) {
      dns.setServers(servers);
    }
  }
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongodbUri);
  } catch (err) {
    if (env.mongodbUriFallback) {
      await mongoose.connect(env.mongodbUriFallback);
      return;
    }
    throw err;
  }
};
