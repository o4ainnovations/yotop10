#!/usr/bin/env tsx

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SetupToken } from '../models/SetupToken';
import { generateSetupToken } from '../lib/adminAuth';

dotenv.config();

async function generateToken() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10');
  
  const { token, expiresAt } = generateSetupToken();
  
  await SetupToken.create({
    token,
    expires_at: expiresAt,
    used: false,
  });

  console.log('\n✅ Admin setup token generated:');
  console.log(`\nToken: ${token}`);
  console.log(`Expires: ${expiresAt.toLocaleString()}`);
  console.log(`\nVisit: http://localhost:3100/admin/setup?token=${token}`);
  console.log('\nThis token will expire in 15 minutes.\n');

  await mongoose.disconnect();
}

generateToken().catch(console.error);
