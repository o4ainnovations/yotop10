import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Article } from '../models/Article';
import { Category } from '../models/Category';
import { createPost } from '../services/posts';

dotenv.config();

const articles = [
  {
    title: 'The Rise and Fall of Streaming: How Netflix, Disney+, and Max Changed Entertainment Forever',
    slug: 'rise-and-fall-of-streaming',
    body: `The golden age of streaming promised a revolution. No more cable bundles, no more ads, no more waiting a week for the next episode. We were told we could have anything we wanted, anytime we wanted it, for a fraction of the cost of cable.

In 2010, Netflix had 20 million subscribers and a library of mostly licensed content from other studios. It was a simple, elegant product: pay $7.99, watch unlimited movies and TV shows. No tiers. No ads. No passwords to share.

By 2020, everything changed. Disney+ launched and hit 100 million subscribers in just 16 months. WarnerMedia became Max. Paramount+, Peacock, Apple TV+, and Amazon Prime all entered the race. The streaming wars had begun.

The problem is that every studio now wants to be Netflix. Disney pulls its content from Netflix to put it on Disney+. Warner does the same with Max. NBC does the same with Peacock. The result? You now need five or six subscriptions to watch what used to be on one service.

And prices have doubled. Netflix's premium plan went from $11.99 to $22.99. Disney+ went from $6.99 to $13.99. Combined, the major streaming services now cost more than the average cable bill.

The paradox is that streaming is becoming what it was supposed to replace: expensive, fragmented, and increasingly ad-supported. Every major service now has an ad tier. Netflix, which famously said "we don't do ads," launched its ad-supported plan in 2022.

The password-sharing crackdown was inevitable. Netflix lost subscribers for the first time in a decade in 2022 and responded by charging extra for shared accounts. It worked — they gained 9 million subscribers the next quarter. But it alienated a generation of users who grew up sharing logins.

What comes next is consolidation. The streaming market cannot sustain 10+ major players. We're already seeing it: Warner Bros. Discovery merged HBO Max with Discovery+. Paramount and NBC are reportedly exploring partnerships. Apple and Amazon treat streaming as a loss leader for their core businesses.

The future of streaming will look a lot like cable: a few large bundles, fewer choices, and rising prices. The revolution is over, and cable won.`,
    category_slug: 'lifestyle/streaming-services',
    reading_time: 6,
    cover_image: null,
  },
  {
    title: 'Why Time Management Is a Myth: The Science of Energy Management',
    slug: 'time-management-is-a-myth',
    body: `We've been told our entire lives that success comes from managing our time better. Wake up earlier. Use a calendar. Block your schedule. Be more efficient.

But here's the uncomfortable truth: time management doesn't work. Not because we're lazy or undisciplined, but because time is a finite resource that cannot be managed. You cannot create more time. You can only decide what to do with the 1,440 minutes you get each day.

What actually works is energy management.

The science is clear. Tony Schwartz, CEO of The Energy Project, spent decades researching high performers. His conclusion: "Energy, not time, is the fundamental currency of high performance."

Your cognitive performance follows a predictable pattern. You have about 90 to 120 minutes of peak focus in the morning. Then your energy dips. Then you get a second wind in the late afternoon. Fighting this rhythm by forcing yourself to work through energy slumps is counterproductive. You'll make more mistakes, take longer to complete tasks, and feel exhausted.

The most productive people in the world don't manage their time — they manage their attention and energy. They work in focused sprints, take real breaks, exercise, eat properly, and prioritize sleep above everything else.

Some practical shifts:

Work in 90-minute blocks. After 90 minutes of focused work, your brain needs a reset. This isn't optional — it's biology.

Stop multitasking. When you switch between tasks, your brain requires up to 23 minutes to refocus. What feels like productivity is actually fragmentation.

Protect your mornings. Every knowledge worker has a limited number of high-quality decisions they can make per day. Use your first 90 minutes for your hardest task, before you check email or social media.

Schedule nothing after 2 PM for decision-making. Your cognitive capacity declines throughout the day. Amazon CEO Jeff Bezos schedules his most important meetings at 10 AM. He knows his best decisions happen in the morning.

The takeaway is simple: you don't need more time. You need better energy. And that starts with accepting that you're a human being, not a productivity machine.`,
    category_slug: 'education/productivity',
    reading_time: 5,
    cover_image: null,
  },
  {
    title: 'How Dopamine Controls Your Life Without You Knowing',
    slug: 'dopamine-controls-your-life',
    body: `Dopamine is not about pleasure. This is the most misunderstood concept in modern neuroscience.

The popular idea that dopamine is the "pleasure molecule" came from a 1954 experiment where rats repeatedly pressed a lever to stimulate a brain region. Scientists assumed they felt pleasure. But later research revealed something more interesting: the rats didn't look like they were enjoying it. They looked addicted.

Dopamine is actually about anticipation and motivation. It's the molecule that makes you reach for your phone when you hear a notification buzz, reach for the next potato chip, or scroll to the next TikTok video. It's not about the enjoyment of the reward — it's about the craving for it.

This distinction matters because it explains why modern life feels so exhausting. Your brain evolved in an environment of scarcity, where finding food, shelter, and social connection required effort. Every success was a genuine reward. Today, you're surrounded by supernormal stimuli designed to hijack your dopamine system.

Social media apps are engineered to maximize dopamine hits. The variable reward schedule — the unpredictable mix of likes, comments, and notifications — is the same mechanism that makes slot machines addictive. You pull the lever (refresh the feed), and sometimes you get a hit. Sometimes you don't. That unpredictability keeps you coming back.

The solution isn't to eliminate dopamine. That's impossible and undesirable. The solution is to understand how it works and design your environment accordingly.

Remove friction from good habits. Put your running shoes next to your bed. Keep a bottle of water on your desk. Make the default choice the healthy choice.

Add friction to bad habits. Log out of social media after each use. Keep your phone in another room while you work. Use apps that block distracting websites.

Create long anticipation loops. When you look forward to something weeks or months in advance, your dopamine system rewards you throughout the waiting period. That's why planning a vacation can be as satisfying as taking one.

The goal isn't to beat dopamine. It's to stop letting it beat you.`,
    category_slug: 'health/mental-health',
    reading_time: 5,
    cover_image: null,
  },
];

const vsPosts = [
  {
    title: 'Ronaldo vs Messi — Who Is The Better Footballer?',
    post_type: 'this_vs_that',
    intro: 'The greatest debate in football history: Cristiano Ronaldo vs Lionel Messi. Two legends, two eras, one question that divides fans worldwide. Here is an honest breakdown of both sides.',
    category_slug: 'sports/football-soccer',
    items: [
      {
        rank: 1,
        title: 'Cristiano Ronaldo',
        justification: 'Ronaldo is the ultimate big-game player. He has won the Champions League 5 times with two different clubs (Manchester United and Real Madrid). He is the all-time leading scorer in Champions League history (140 goals) and international football (128 goals for Portugal). He also won the European Championship with Portugal in 2016. His physical attributes — speed, power, jumping ability — are unprecedented. At 6\'2", he is the complete modern athlete. He has won 5 Ballon d\'Or awards, played at the highest level in England, Spain, and Italy, and succeeded in every league he\'s played in. His work ethic is legendary: he transformed his body from a skinny teenager into a physical specimen through relentless training. Ronaldo\'s ability to deliver under pressure — clutch goals in Champions League finals, hat-tricks against Atlético Madrid to overturn deficits, and his iconic "SIUUU" celebration — makes him the player you want when everything is on the line.',
        image_url: null,
        source_url: 'https://www.uefa.com/uefachampionsleague/history/',
      },
      {
        rank: 2,
        title: 'Lionel Messi',
        justification: 'Messi is the most naturally gifted footballer ever. He has won 8 Ballon d\'Or awards — more than any player in history. His 2022 World Cup win with Argentina silenced any debate about his legacy. He is Argentina\'s all-time leading scorer and the all-time top scorer in La Liga. At 5\'7", his low center of gravity combined with his dribbling makes him virtually unplayable in 1v1 situations. What separates Messi is his vision and decision-making. He sees passes that no one else sees. His goal against Getafe in 2007 — dribbling past five players from midfield — is often compared to Maradona\'s 1986 goal. Messi holds the record for most goals in a calendar year (91 in 2012). He also has the most assists in football history, proving he is not just a scorer but a creator. His loyalty to Barcelona for 21 years before moving to PSG and then Inter Miami shows a different kind of greatness — one built on consistency and natural talent rather than physical dominance. For purists, Messi is football.',
        image_url: null,
        source_url: 'https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup',
      },
    ],
  },
  {
    title: 'Nike vs Adidas — Which Brand Dominates Sportswear?',
    post_type: 'this_vs_that',
    intro: 'The war between Nike and Adidas is one of the fiercest rivalries in the business world. Two giants, two philosophies, one question: which brand truly owns sportswear?',
    category_slug: 'business/entrepreneurship',
    items: [
      {
        rank: 1,
        title: 'Nike',
        justification: 'Nike is the undisputed global leader. With a market cap of over $170 billion, Nike dominates the sportswear industry. They own 27% of the global athletic footwear market. Their marketing strategy is legendary — from "Just Do It" to signing Michael Jordan in 1984, Nike doesn\'t just sell shoes, it sells culture. The Air Jordan brand alone generates over $5 billion annually. Nike\'s roster of athletes is unmatched: LeBron James, Cristiano Ronaldo, Serena Williams, and Kylian Mbappé. Their digital strategy is also superior — the Nike app and SNKRS app create scarcity and hype that no competitor can match. Nike\'s Flyknit technology, Vaporfly running shoes (which sparked super-shoe controversy), and Dri-FIT fabric innovations keep them at the cutting edge of performance wear. Critics point to their controversial overseas manufacturing practices, but from a business and cultural standpoint, Nike is the king.',
        image_url: null,
        source_url: 'https://about.nike.com/en/',
      },
      {
        rank: 2,
        title: 'Adidas',
        justification: 'Adidas has a different philosophy: authenticity and sustainability. While Nike chases hype, Adidas focuses on heritage and environmental responsibility. The Adidas Samba and Gazelle have become cultural icons without aggressive marketing — they achieved popularity organically through streetwear and fashion circles. Adidas is the global leader in sustainable sportswear. Their partnership with Parley for the Oceans has produced millions of shoes made from recycled ocean plastic. They have committed to using only recycled polyester by 2024. Adidas dominates in soccer — they are the kit supplier for FIFA World Cups, Bayern Munich, Real Madrid, and Manchester United. Their Ultraboost running shoes are widely considered the most comfortable on the market. Adidas has also made strong moves in fashion, with collaborations with Kanye West (Yeezy, now discontinued), Fear of God, and Gucci. While their market cap ($35 billion) is smaller than Nike\'s, Adidas has a deeper connection to sports culture, especially football, and a stronger commitment to environmental causes.',
        image_url: null,
        source_url: 'https://www.adidas-group.com/en/',
      },
    ],
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

    // Seed Articles
    let articleCount = 0;
    for (const a of articles) {
      const existing = await Article.findOne({ slug: a.slug });
      if (existing) {
        console.log(`Article exists: ${a.title}`);
        continue;
      }
      const cat = await Category.findOne({ slug: a.category_slug });
      if (!cat) {
        console.log(`Category not found: ${a.category_slug}`);
        continue;
      }
      await Article.create({
        title: a.title,
        slug: a.slug,
        body: a.body,
        category_slug: cat.slug,
        author_id: user.user_id,
        author_username: user.username,
        author_display_name: user.custom_display_name || user.username,
        reading_time: a.reading_time,
        cover_image: null,
        status: 'approved',
        view_count: Math.floor(Math.random() * 500) + 100,
        comment_count: 0,
        published_at: new Date(),
      });
      console.log(`Article created: ${a.title}`);
      articleCount++;
    }

    // Seed This vs That posts
    let vsCount = 0;
    for (const p of vsPosts) {
      const existing = await Post.findOne({ title: p.title });
      if (existing) {
        console.log(`Post exists: ${p.title}`);
        continue;
      }
      const cat = await Category.findOne({ slug: p.category_slug });
      if (!cat) {
        console.log(`Category not found: ${p.category_slug}`);
        continue;
      }
      const post = await createPost({
        author_id: user.user_id,
        author_username: user.username,
        author_display_name: user.custom_display_name || user.username,
        title: p.title,
        post_type: p.post_type,
        intro: p.intro,
        category_slug: cat.slug,
        status: 'approved',
        items: p.items.map(item => ({
          rank: item.rank,
          title: item.title,
          justification: item.justification,
          image_url: item.image_url || undefined,
          source_url: item.source_url || undefined,
        })),
        fire_count: 80,
        view_count: Math.floor(Math.random() * 5000) + 2000,
        published_at: new Date(),
      });
      console.log(`"This vs That" post created: ${post.title}`);
      console.log(`  View at: /${post.slug}`);
      vsCount++;
    }

    console.log(`\n✅ Seed completed!`);
    console.log(`  Articles: ${articleCount}`);
    console.log(`  This vs That posts: ${vsCount}`);

  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
