import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/yotop10';
await mongoose.connect(uri);
const db = mongoose.connection.db!;
await db.collection('adminusers').updateOne({username: 'admin'}, {$set: {role: 'super_admin'}});
const admin = await db.collection('adminusers').findOne({username: 'admin'});
console.log('Admin role:', admin?.role);
await mongoose.disconnect();
