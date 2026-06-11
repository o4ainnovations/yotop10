import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Category } from '../models/Category';
import { createPost } from '../services/posts';

dotenv.config();

const posts = [
  {
    title: 'Best of 90s Hip Hop Albums',
    post_type: 'best_of',
    intro: 'The 1990s was the golden era of hip hop. From the East Coast to the West Coast, these albums defined a generation and still influence music today.',
    category_slug: 'creative/hip-hop',
    items: [
      { rank: 1, title: 'Illmatic — Nas', justification: 'A flawless debut that redefined lyrical hip hop. Nas painted vivid street narratives over jazz-infused beats, creating what many consider the greatest hip hop album ever made.' },
      { rank: 2, title: 'The Chronic — Dr. Dre', justification: 'G-funk perfected. Dre\'s debut launched Snoop Dogg and changed the sound of hip hop forever with its laid-back synths and funk samples.' },
      { rank: 3, title: 'Enter the Wu-Tang (36 Chambers) — Wu-Tang Clan', justification: 'Raw, gritty, and revolutionary. Wu-Tang brought martial arts imagery and a collective of uniquely skilled MCs that changed the industry\'s business model.' },
      { rank: 4, title: 'Ready to Die — The Notorious B.I.G.', justification: 'Biggie\'s debut is a masterclass in storytelling. From street hustler narratives to party anthems, his flow and charisma were unmatched.' },
      { rank: 5, title: 'Aquemini — OutKast', justification: 'Southern hip hop\'s coming-out party. OutKast blended funk, soul, and rock into a psychedelic hip hop sound that defied all conventions.' },
      { rank: 6, title: 'The Low End Theory — A Tribe Called Quest', justification: 'Jazz rap at its finest. Tribe\'s sophomore album merged intelligent lyrics with bass-heavy jazz samples, creating a blueprint for alternative hip hop.' },
      { rank: 7, title: 'Doggystyle — Snoop Doggy Dogg', justification: 'Snoop\'s debut was the most anticipated album of 1993 and delivered. His effortless flow and Dre\'s G-funk production created an instant classic.' },
      { rank: 8, title: 'Me Against the World — 2Pac', justification: 'Tupac\'s most introspective work. Recorded while he was incarcerated, the album captures his vulnerability, paranoia, and resilience.' },
      { rank: 9, title: 'Midnight Marauders — A Tribe Called Quest', justification: 'Tribe\'s third album perfected the Q-Tip and Phife chemistry. Bouncy production, clever wordplay, and an impeccable sense of groove.' },
      { rank: 10, title: 'Liquid Swords — GZA', justification: 'The darkest Wu-Tang solo album. GZA\'s chess-inspired lyricism over RZA\'s eerie, minimalist production creates a cinematic hip hop masterpiece.' },
    ],
  },
  {
    title: 'Best of 90s Movies That Still Hold Up',
    post_type: 'best_of',
    intro: 'Some movies age like fine wine. These 90s films remain as fresh, exciting, and culturally relevant today as they were on release day.',
    category_slug: 'lifestyle/movies-tv-shows',
    items: [
      { rank: 1, title: 'Pulp Fiction (1994)', justification: 'Tarantino\'s non-linear masterpiece redefined storytelling in cinema. Its razor-sharp dialogue, iconic characters, and killer soundtrack make it endlessly rewatchable.' },
      { rank: 2, title: 'The Matrix (1999)', justification: 'Revolutionary visual effects met philosophical storytelling. The Matrix changed action cinema forever with its "bullet time" and cyberpunk aesthetic.' },
      { rank: 3, title: 'Fight Club (1999)', justification: 'A subversive critique of consumerism and masculinity that only gets more relevant. Its twist ending still shocks first-time viewers.' },
      { rank: 4, title: 'Goodfellas (1990)', justification: 'Scorsese\'s greatest film. The kinetic camerawork, incredible performances, and darkly comedic tone make it the definitive mob movie.' },
      { rank: 5, title: 'The Shawshank Redemption (1994)', justification: 'A story of hope and friendship in the darkest circumstances. Its emotional payoff is earned through patient, masterful storytelling.' },
      { rank: 6, title: 'Jurassic Park (1993)', justification: 'Spielberg\'s dinosaur epic still looks incredible. The blend of CGI and animatronics, combined with a sense of wonder and terror, is unmatched.' },
      { rank: 7, title: 'Terminator 2: Judgment Day (1991)', justification: 'The rare sequel that surpasses the original. Groundbreaking visual effects, intense action, and surprising emotional depth from Arnold\'s T-800.' },
      { rank: 8, title: 'Seven (1995)', justification: 'Fincher\'s dark, rain-soaked thriller is a masterclass in atmosphere. The "What\'s in the box?" ending is one of cinema\'s most unforgettable moments.' },
      { rank: 9, title: 'Toy Story 2 (1999)', justification: 'Pixar proved sequels could be art with this emotionally devastating story about loyalty, purpose, and the fear of being forgotten.' },
      { rank: 10, title: 'Saving Private Ryan (1998)', justification: 'The opening Omaha Beach sequence changed war cinema forever. Beyond the brutality, it\'s a deeply human story about sacrifice and duty.' },
    ],
  },
  {
    title: 'Worst of Fast Food Items That Should Never Exist',
    post_type: 'worst_of',
    intro: 'Fast food innovation doesn\'t always work out. Some creations are so bizarre, unappetizing, or poorly executed that they deserve a special hall of shame.',
    category_slug: 'lifestyle/food-restaurants',
    items: [
      { rank: 1, title: 'McDonald\'s McLobster', justification: 'Lobster from a drive-through window. Served on a bun with iceberg lettuce and a suspicious "lobster" salad that tastes more like mayo than crustacean.' },
      { rank: 2, title: 'Taco Bell\'s Bell Beefer', justification: 'A sloppy joe in a taco shell that somehow manages to be both too messy and too bland. It satisfied neither burger nor taco cravings.' },
      { rank: 3, title: 'Burger King\'s Satisfries', justification: 'Marketing genius, product failure. Lower-calorie fries that tasted like cardboard soaked in disappointment. They lasted barely a year.' },
      { rank: 4, title: 'KFC\'s Donut Chicken Sandwich', justification: 'Two glazed donuts replacing the bun on a fried chicken filet. The sugar-savory balance was more nauseating than inspired.' },
      { rank: 5, title: 'Pizza Hut\'s Hot Dog Stuffed Crust', justification: 'Mini hot dogs baked into the pizza crust. A truly baffling creation that pleased neither pizza purists nor hot dog enthusiasts.' },
      { rank: 6, title: 'McDonald\'s Arch Deluxe', justification: 'McDonald\'s attempt at an "adult" burger. It was more expensive, more complicated, and somehow less satisfying than a regular Big Mac.' },
      { rank: 7, title: 'Dunkin\'s Beyond Sausage Breakfast Sandwich', justification: 'A plant-based sausage patty that tasted like sawdust soaked in artificial smoke flavor. The texture was dry and crumbly.' },
      { rank: 8, title: 'Domino\'s Pretzel Crust Pizza', justification: 'A soft pretzel crust that sounds good in theory but delivers a chewy, salty mess that fights with every topping.' },
      { rank: 9, title: 'Wendy\'s Bacon Mushroom Melt', justification: 'A soggy, greasy mess. The mushrooms released too much moisture, turning the bun into a sad, wet sponge.' },
      { rank: 10, title: 'Taco Bell\'s Naked Chicken Chalupa', justification: 'A fried chicken shell shaped like a taco. It was greasy, structurally unstable, and left you wondering why you didn\'t just order a regular taco.' },
    ],
  },
  {
    title: 'Worst of Tech Products That Bombed',
    post_type: 'worst_of',
    intro: 'For every iPhone, there are a dozen catastrophic flops. These tech products were supposed to change the world but instead became cautionary tales.',
    category_slug: 'technology/hardware-components',
    items: [
      { rank: 1, title: 'Google Glass', justification: 'Augmented reality glasses that made wearers look like cyborgs. Privacy concerns, a ridiculous price tag, and zero mainstream appeal killed it fast.' },
      { rank: 2, title: 'Apple Newton MessagePad', justification: 'Before the iPhone, there was this brick. Its handwriting recognition was so bad it became a running joke on The Simpsons.' },
      { rank: 3, title: 'Meta (Facebook) Portal', justification: 'A smart display from the company that had just lost millions of users\' trust over privacy scandals. Putting a Facebook camera in your living room felt insane.' },
      { rank: 4, title: 'Microsoft Zune', justification: 'Microsoft\'s iPod killer that killed nothing. A chunky, clunky device with a weird brown color scheme and a subscription model nobody wanted.' },
      { rank: 5, title: 'Samsung Galaxy Note 7', justification: 'The smartphone that literally exploded. A battery defect caused devices to catch fire, leading to a complete global recall and permanent ban on flights.' },
      { rank: 6, title: 'Amazon Fire Phone', justification: 'A phone with five cameras and a 3D display feature nobody asked for. It was so unsuccessful Amazon wrote off $170 million in unsold inventory.' },
      { rank: 7, title: 'HP TouchPad', justification: 'Launched with a clunky OS, poor app selection, and no clear audience. HP killed it after 49 days, selling the remaining stock for $99.' },
      { rank: 8, title: 'Google+', justification: 'Google\'s attempt to take on Facebook. A ghost town from day one, it forced integration with YouTube and Gmail but never gained real traction.' },
      { rank: 9, title: 'BlackBerry Storm', justification: 'BlackBerry\'s first touchscreen phone with a "clickable" screen that felt awful. It crashed constantly and cemented BlackBerry\'s decline.' },
      { rank: 10, title: 'Juicero', justification: 'A $700 internet-connected juicer that squeezed pre-packaged juice pouches. When investors discovered you could just squeeze the pouches by hand, the company collapsed.' },
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

    let createdCount = 0;
    for (const p of posts) {
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

      await createPost({
        author_id: user.user_id,
        author_username: user.username,
        author_display_name: user.custom_display_name || user.username,
        title: p.title,
        post_type: p.post_type,
        intro: p.intro,
        category_slug: cat.slug,
        status: 'approved',
        items: p.items,
        fire_count: Math.floor(Math.random() * 80),
        view_count: Math.floor(Math.random() * 3000) + 1000,
        published_at: new Date(),
      });

      console.log(`Created: ${p.title}`);
      createdCount++;
    }

    console.log(`\n✅ Seed completed! Created ${createdCount} new posts.`);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
