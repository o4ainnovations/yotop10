import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Post } from '../models/Post';
import { Category } from '../models/Category';

dotenv.config();

async function migrateCategorySlugs() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const posts = await Post.find({
    $or: [
      { category_slug: { $exists: false } },
      { category_slug: null },
      { category_slug: '__orphan__' },
    ]
  }).lean();
  console.log(`Found ${posts.length} posts needing migration`);

  if (posts.length === 0) {
    console.log('No posts to migrate.');
    await mongoose.disconnect();
    return;
  }

  const categories = await Category.find({}).lean();
  const idToSlug = new Map<string, string>();
  for (const cat of categories) {
    idToSlug.set(cat._id.toString(), cat.slug);
  }

  let migrated = 0;
  let orphaned = 0;

  const bulk = Post.collection.initializeUnorderedBulkOp();

  for (const post of posts) {
    const categoryId = post.category_id;
    const slug = categoryId ? idToSlug.get(categoryId.toString()) : null;
    
    if (slug) {
      bulk.find({ _id: post._id }).updateOne({ $set: { category_slug: slug } });
      migrated++;
    } else {
      bulk.find({ _id: post._id }).updateOne({ $set: { category_slug: '__orphan__' } });
      orphaned++;
      console.log(`  ORPHAN: ${post.title} (category_id: ${categoryId})`);
    }
  }

  if (migrated > 0 || orphaned > 0) {
    await bulk.execute();
  }

  console.log(`\nMigration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Orphaned: ${orphaned}`);
  console.log(`  Total: ${posts.length}`);

  await mongoose.disconnect();
}

migrateCategorySlugs().catch(console.error);
