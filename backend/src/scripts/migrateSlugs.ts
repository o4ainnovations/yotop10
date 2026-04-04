import mongoose from 'mongoose';
import { Post, generateUniqueSlug } from '../models/Post';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  
  console.log('Fetching all posts...');
  const posts = await Post.find({});
  
  console.log(`Found ${posts.length} posts to migrate`);
  
  let updated = 0;
  for (const post of posts) {
    const slug = generateUniqueSlug(post.title, post._id.toString());
    
    await Post.findByIdAndUpdate(post._id, {
      slug,
    });
    
    updated++;
    if (updated % 10 === 0) {
      console.log(`Updated ${updated}/${posts.length} posts`);
    }
  }
  
  console.log(`Migration complete. Updated ${updated} posts with slugs.`);
  
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
