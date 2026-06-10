import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Category } from '../models/Category';
import { createPost } from '../services/posts';

dotenv.config();

const facts = [
  {
    title: 'A cloud weighs about a million pounds',
    intro: 'An average cumulus cloud weighs approximately 1.1 million pounds (500,000 kg). That\'s about the same as 100 elephants floating above your head. The water droplets are spread across a huge volume, which is why they stay suspended in the air.',
    category_slug: 'education/environmental-science',
  },
  {
    title: 'Octopuses have three hearts and blue blood',
    intro: 'Two hearts pump blood to the gills, while the third pumps it to the rest of the body. When an octopus swims, the heart that delivers blood to the body stops beating, which is why they prefer crawling over swimming. Their blood is blue because it uses hemocyanin (copper-based) instead of hemoglobin (iron-based) to transport oxygen.',
    category_slug: 'education/scientific-papers',
  },
  {
    title: 'The Great Wall of China is not visible from space',
    intro: 'Despite being one of the most persistent myths in history, the Great Wall of China is not visible from low Earth orbit with the naked eye. It is only 4-5 meters wide and blends into the surrounding landscape. Astronauts have confirmed this repeatedly — the myth originated before spaceflight and was never true.',
    category_slug: 'education/history-education',
  },
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    let user = await User.findOne({ username: 'any_seed' });
    if (!user) {
      user = await User.create({
        user_id: crypto.randomBytes(4).toString('hex'),
        username: 'any_seed',
        custom_display_name: 'ContentCurator',
        device_fingerprint: 'seed_fp_general',
        is_admin: false,
      });
      console.log(`Created user: ${user.username}`);
    }

    let createdCount = 0;
    for (const f of facts) {
      const existing = await Post.findOne({ title: f.title });
      if (existing) {
        console.log(`Fact exists: ${f.title}`);
        continue;
      }

      const cat = await Category.findOne({ slug: f.category_slug });
      if (!cat) {
        console.log(`Category not found: ${f.category_slug}`);
        continue;
      }

      await createPost({
        author_id: user.user_id,
        author_username: user.username,
        author_display_name: user.custom_display_name || user.username,
        title: f.title,
        post_type: 'fact_drop',
        intro: f.intro,
        category_slug: cat.slug,
        status: 'approved',
        items: [{ rank: 1, title: f.title, justification: f.intro.substring(0, 500) }],
        fire_count: 50,
        view_count: Math.floor(Math.random() * 2000) + 500,
        published_at: new Date(),
      });

      console.log(`Fact created: ${f.title}`);
      createdCount++;
    }

    console.log(`\n✅ Seed completed! Created ${createdCount} fact drops.`);

  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
