
import mongoose from 'mongoose';
import { SetupToken } from './src/models/SetupToken';
import { AdminUser } from './src/models/AdminUser';
import { generateSetupToken } from './src/lib/adminAuth';

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/yotop10';
await mongoose.connect(uri);

// Delete existing admins  
await AdminUser.deleteMany({});

// Generate fresh token
const t = generateSetupToken();
console.log('TOKEN=' + t.token);

await mongoose.disconnect();

