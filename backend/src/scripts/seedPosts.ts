import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { Category } from '../models/Category';

dotenv.config();

const samplePosts = [
  {
    title: 'Top 10 Greatest Football Players Ever',
    post_type: 'top_list',
    intro: 'A definitive ranking of the greatest footballers in history based on individual skill, achievements, and impact on the sport.',
    category_slug: 'sports/football-soccer',
    items: [
      { rank: 1, title: 'Lionel Messi', justification: 'Widely considered the greatest of all time with 8 Ballon d\'Or awards and countless records. His dribbling, vision, and goal-scoring ability are unmatched.' },
      { rank: 2, title: 'Cristiano Ronaldo', justification: 'The ultimate competitor with 5 Champions League titles, all-time leading scorer in football, and unmatched physical attributes and work ethic.' },
      { rank: 3, title: 'Pelé', justification: 'The original king of football with 3 World Cup titles and over 1000 career goals. His talent and achievements span three decades.' },
      { rank: 4, title: 'Diego Maradona', justification: 'The magician who carried Argentina to World Cup glory with his extraordinary dribbling. The 1986 World Cup was his personal masterpiece.' },
      { rank: 5, title: 'Johan Cruyff', justification: 'The total football pioneer whose influence on the sport extends beyond his playing days. His philosophy shaped modern football.' },
      { rank: 6, title: 'Michel Platini', justification: 'The elegant midfielder who dominated European football in the 1980s with three consecutive Ballon d\'Or wins.' },
      { rank: 7, title: 'Franz Beckenbauer', justification: 'The sweeper who revolutionized defending and led West Germany to World Cup glory. A complete player ahead of his time.' },
      { rank: 8, title: 'Alfredo Di Stefano', justification: 'The complete player who defined an era with Real Madrid\'s five consecutive European Cup victories. Played for three nations.' },
      { rank: 9, title: 'Zinedine Zidane', justification: 'The graceful playmaker who delivered in every major tournament for France and Real Madrid. Pure artistry on the ball.' },
      { rank: 10, title: 'Ronaldo Nazário', justification: 'The most complete striker ever, combining pace, skill, and finishing like no one else. Before injuries, he was unstoppable.' }
    ]
  },
  {
    title: 'Top 10 Richest Men In The World Of All Time',
    post_type: 'top_list',
    intro: 'A definitive ranking of the wealthiest individuals in human history, adjusted for inflation and modern purchasing power.',
    category_slug: 'business/entrepreneurship',
    items: [
      { rank: 1, title: 'Mansa Musa', justification: 'Mali Empire ruler considered the richest person ever. Estimated net worth $400B+ in adjusted dollars. His lavish pilgrimage to Mecca crashed gold prices in Egypt for a decade.' },
      { rank: 2, title: 'John D. Rockefeller', justification: 'Standard Oil founder. First American billionaire. Peak net worth ~$418B adjusted for inflation. Gave away over half his fortune in philanthropy.' },
      { rank: 3, title: 'Andrew Carnegie', justification: 'Steel magnate. Sold Carnegie Steel for $480M in 1901 (~$14B today). Gave away 90% of his fortune ($350M) to libraries and education.' },
      { rank: 4, title: 'Elon Musk', justification: 'Peak net worth $340B (2022) during Tesla\'s market high. Founder of Tesla, SpaceX, X (Twitter), Neuralink, and The Boring Company.' },
      { rank: 5, title: 'Jeff Bezos', justification: 'Amazon founder. Peak net worth $212B. Built Amazon from online bookstore into everything store. Owns Washington Post and Blue Origin.' },
      { rank: 6, title: 'Bernard Arnault', justification: 'LVMH Chairman. World\'s richest man 2023-2024. Peak net worth $237B. Controls Louis Vuitton, Dior, Moet Hennessy, 70+ luxury brands.' },
      { rank: 7, title: 'Bill Gates', justification: 'Microsoft founder. Net worth peaked at $149B in 1999. Stepped down in 2020 to focus on philanthropy through the Bill & Melinda Gates Foundation.' },
      { rank: 8, title: 'Augustus Caesar', justification: 'Roman Emperor. Controlled the entire Roman Empire (~25-30% of global GDP). Personal fortune estimated at ~$4.6T in modern purchasing power.' },
      { rank: 9, title: 'Josef Stalin', justification: 'Soviet Premier. Controlled entire Soviet economy from 1924-1953. Estimated personal control over ~$7.5T worth of resources at peak.' },
      { rank: 10, title: 'Akbar I', justification: 'Mughal Emperor. Ruled India 1556-1605. Empire produced ~25% of global GDP. Personal fortune estimated at ~$21T in modern dollars.' }
    ]
  }
];

async function seedPosts() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';
  
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Create sample user
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
    
    // Create each sample post
    for (const postData of samplePosts) {
      // Check if post already exists
      const existingPost = await Post.findOne({ title: postData.title });
      if (existingPost) {
        console.log(`Post already exists: ${existingPost.title}`);
        console.log(`  Slug: ${existingPost.slug}`);
        console.log(`  View at: /${existingPost.slug}`);
        continue;
      }
      
      // Find category by slug
      const category = await Category.findOne({ slug: postData.category_slug });
      if (!category) {
        console.log(`Category not found for ${postData.title}: ${postData.category_slug}`);
        continue;
      }
      
      // Create post
      const post = await Post.create({
        author_id: user.user_id,
        author_username: user.username,
        author_display_name: user.custom_display_name || user.username,
        title: postData.title,
        post_type: postData.post_type,
        intro: postData.intro,
        status: 'approved',
        category_id: category._id,
        fire_count: Math.floor(Math.random() * 100),
        comment_count: 0,
        view_count: Math.floor(Math.random() * 3000),
        published_at: new Date(),
        slug: '', // Will be auto-generated by pre-save hook
      });
      
      // Create list items
      for (const item of postData.items) {
        await ListItem.create({
          post_id: post._id,
          rank: item.rank,
          title: item.title,
          justification: item.justification,
          fire_count: Math.floor(Math.random() * 50),
        });
      }
      
      console.log(`Created post: ${post.title}`);
      console.log(`  Slug: ${post.slug}`);
      console.log(`  Category: ${category.name}`);
      console.log(`  View at: /${post.slug}`);
      createdCount++;
    }
    
    console.log(`\n✅ Seed completed successfully!`);
    console.log(`Created ${createdCount} new posts`);

    
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seedPosts();