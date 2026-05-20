import mongoose from 'mongoose';
import crypto from 'crypto';

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/yotop10';
await mongoose.connect(uri);

// Delete existing admins and tokens
const db = mongoose.connection.db!;
await db.collection('adminusers').deleteMany({});
await db.collection('setuptokens').deleteMany({});

// Create fresh setup token
const token = crypto.randomBytes(8).toString('hex');
await db.collection('setuptokens').insertOne({
  token,
  used: false,
  expires_at: new Date(Date.now() + 15 * 60000),
  created_at: new Date()
});

console.log('TOKEN=' + token);
await mongoose.disconnect();
