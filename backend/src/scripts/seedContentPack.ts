import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import https from 'https';
import sharp from 'sharp';

import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { User } from '../models/User';
import { Article } from '../models/Article';
import { Category } from '../models/Category';
import { createPost } from '../services/posts';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || `mongodb://${process.env.MONGO_USERNAME || 'yotop10_admin'}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST || 'mongodb'}:27017/${process.env.MONGO_DB || 'yotop10'}?authSource=admin`;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const IMAGES = {
  mysteries: 'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=1200&q=80',
  worldCup: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&q=80',
  wwe: 'https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?w=1200&q=80',
  ww2: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&q=80',
};

async function downloadImage(url: string, dest: string): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const req = https.get(url, { timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  } catch {
    // Fallback: generate a gradient placeholder image using sharp
    console.log('  Download failed, generating placeholder...');
    const w = 1200, h = 675;
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f97316;stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:#dc2626;stop-opacity:0.3" />
      </linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#g)" />
      <circle cx="${w/2}" cy="${h/2}" r="60" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>
      <circle cx="${w/2}" cy="${h/2}" r="100" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    </svg>`;
    await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(dest.replace(/\.[^.]+$/, '.jpg'));
  }
}

async function processHeroImage(url: string): Promise<string> {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  const rawName = `seed_${crypto.randomBytes(8).toString('hex')}.jpg`;
  const rawPath = path.join(UPLOAD_DIR, rawName);
  console.log(`  Downloading ${url}...`);
  await downloadImage(url, rawPath);

  const heroName = rawName.replace('.jpg', '_1200x675.webp');
  const heroPath = path.join(UPLOAD_DIR, heroName);
  await sharp(rawPath)
    .resize(1200, 675, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toFile(heroPath);

  await fsp.unlink(rawPath).catch(() => {});
  return `/uploads/${heroName}`;
}

async function getOrCreateUser(): Promise<string> {
  let user = await User.findOne({ username: 'nekwasar' });
  if (!user) {
    const fpVal = 'seed_' + crypto.randomBytes(16).toString('hex');
    user = new User({
      username: 'nekwasar',
      display_name: 'Nekwasar',
      trust_score: 2.0,
      trust_tier: 'scholar',
      device_fingerprint: fpVal,
      user_id: fpVal,
    });
    await user.save();
  }
  return user._id.toString();
}

async function getCategory(slug: string): Promise<string> {
  const cat = await Category.findOne({ slug });
  if (cat) return cat.slug;
  // try parent/child pattern
  const parts = slug.split('/');
  if (parts.length === 2) {
    const child = await Category.findOne({ slug: parts[1], parent_id: { $ne: null } });
    if (child) return child.slug;
  }
  console.warn(`  Category "${slug}" not found, using "education"`);
  return 'education';
}

async function seedMysteries(authorId: string, imageUrl: string) {
  console.log('\n📀 Seeding: Top 10 Mysteries of the World...');
  const slug = 'top-10-mysteries-of-the-world-' + crypto.randomBytes(3).toString('hex');
  const cat = await getCategory('education');

  const post = new Post({
    title: 'Top 10 Mysteries of the World',
    slug,
    post_type: 'top_list',
    intro: 'From ancient artifacts to unexplained phenomena, these mysteries have baffled scientists, historians, and researchers for centuries. Here are the top 10 mysteries that continue to defy explanation.',
    category_slug: cat,
    author_id: authorId,
    author_username: 'nekwasar',
    author_display_name: 'Nekwasar',
    status: 'approved',
    published_at: new Date(),
    hero_image_url: imageUrl,
    comment_count: 0,
    view_count: 0,
  });
  await post.save();

  const items = [
    { rank: 1, title: 'The Bermuda Triangle', justification: 'A region in the western part of the North Atlantic Ocean where numerous aircraft and ships are said to have disappeared under mysterious circumstances. Despite extensive research, no single explanation accounts for all the incidents, with theories ranging from magnetic anomalies to methane hydrates.' },
    { rank: 2, title: 'The Pyramids of Giza', justification: 'Built over 4,500 years ago, these massive structures continue to puzzle engineers and archaeologists. The precision of their construction, the alignment with celestial bodies, and the methods used to transport 2.3 million stone blocks remain subjects of intense debate.' },
    { rank: 3, title: 'The Voynich Manuscript', justification: 'A illustrated codex hand-written in an unknown writing system, carbon-dated to the early 15th century. Despite centuries of attempts by cryptographers and linguists, the manuscript has never been deciphered.' },
    { rank: 4, title: 'The Wow! Signal', justification: 'A strong narrowband radio signal detected by astronomer Jerry R. Ehman in 1977. Lasting 72 seconds, the signal matched the expected signature of extraterrestrial origin but has never been detected again.' },
    { rank: 5, title: 'Stonehenge', justification: 'A prehistoric monument in Wiltshire, England, consisting of massive standing stones arranged in a circular layout. How Neolithic builders transported stones weighing up to 30 tons over 150 miles remains one of archaeology\'s greatest questions.' },
    { rank: 6, title: 'The Mary Celeste', justification: 'An American merchant brigantine found adrift and deserted in the Atlantic Ocean in 1872. The crew had vanished without a trace, with their personal belongings untouched and the ship in seaworthy condition.' },
    { rank: 7, title: 'The Taos Hum', justification: 'A low-frequency humming noise heard by residents and visitors in the town of Taos, New Mexico. Only about 2% of visitors can hear it, and its source has not been identified despite years of investigation.' },
    { rank: 8, title: 'Easter Island Moai', justification: 'Nearly 1,000 monolithic human figures carved by the Rapa Nui people between 1250 and 1500 CE. The methods used to transport these multi-ton statues across the island remain debated among researchers.' },
    { rank: 9, title: 'The Dancing Plague of 1518', justification: 'A bizarre event in Strasbourg where hundreds of people danced uncontrollably for days without rest. Some danced until they collapsed from exhaustion or died. Theories range from mass hysteria to ergot poisoning.' },
    { rank: 10, title: 'The Zodiac Killer', justification: 'An unidentified serial killer active in Northern California in the late 1960s and 1970s. Despite sending ciphers and letters to newspapers, the killer\'s identity has never been conclusively determined.' },
  ];

  await ListItem.insertMany(
    items.map(item => ({
      post_id: post._id,
      rank: item.rank,
      title: item.title,
      justification: item.justification,
    }))
  );
  console.log(`  ✅ Created: ${post.title} (${slug})`);
}

async function seedWorldCup(authorId: string, imageUrl: string) {
  console.log('\n⚽ Seeding: Top 20 Favorite Countries to Win the World Cup 2026...');
  const slug = 'top-20-countries-world-cup-2026-' + crypto.randomBytes(3).toString('hex');
  const cat = await getCategory('sports');

  const post = new Post({
    title: 'Top 20 Favorite Countries to Win the World Cup 2026',
    slug,
    post_type: 'top_list',
    intro: 'As the 2026 FIFA World Cup approaches, hosted across the United States, Canada, and Mexico with an expanded 48-team format, we rank the top 20 contenders most likely to lift the trophy based on current squad strength, recent performances, and historical pedigree.',
    category_slug: cat,
    author_id: authorId,
    author_username: 'nekwasar',
    author_display_name: 'Nekwasar',
    status: 'approved',
    published_at: new Date(),
    hero_image_url: imageUrl,
    comment_count: 0,
    view_count: 0,
  });
  await post.save();

  const items = [
    { rank: 1, title: 'Argentina', justification: 'The reigning champions after their 2022 triumph in Qatar. Led by Lionel Messi\'s continued brilliance and a young core including Enzo Fernández, Julián Álvarez, and Alexis Mac Allister, Argentina boasts the perfect blend of experience and emerging talent.' },
    { rank: 2, title: 'France', justification: 'Les Bleus have reached the final in two of the last three tournaments. With Kylian Mbappé entering his prime, plus talents like Eduardo Camavinga and Aurélien Tchouaméni, France\'s depth is unmatched across the pitch.' },
    { rank: 3, title: 'Brazil', justification: 'The five-time champions are always favorites. Vinícius Júnior, Rodrygo, and Endrick represent a new generation of Brazilian flair, while the 2026 tournament being partly in South America could feel like a home advantage.' },
    { rank: 4, title: 'England', justification: 'With Jude Bellingham, Bukayo Saka, and Phil Foden leading a golden generation, England have the attacking firepower to go all the way. Gareth Southgate\'s squad has consistently reached deep into tournaments.' },
    { rank: 5, title: 'Spain', justification: 'La Roja\'s young midfield trio of Pedri, Gavi, and Rodri controls games like few others. Their tiki-taka style, proven at Euro 2024, makes them a nightmare to play against.' },
    { rank: 6, title: 'Germany', justification: 'Hosting history and a revitalized squad under Julian Nagelsmann. Jamal Musiala, Florian Wirtz, and Kai Havertz represent a new wave of German talent ready to restore Die Mannschaft to glory.' },
    { rank: 7, title: 'Portugal', justification: 'Even post-Ronaldo, Portugal has one of the deepest talent pools in world football. Bruno Fernandes, Bernardo Silva, Rafael Leão, and Rúben Dias form a formidable spine.' },
    { rank: 8, title: 'Netherlands', justification: 'Virgil van Dijk anchors a defense that remains world-class, while Frenkie de Jong and Xavi Simons provide creativity. The Dutch always rise to the occasion on the biggest stage.' },
    { rank: 9, title: 'Italy', justification: 'After missing 2022, Italy will be hungry. The Azzurri proved their pedigree by winning Euro 2024, and their tactical discipline under Luciano Spalletti makes them dangerous.' },
    { rank: 10, title: 'Belgium', justification: 'The golden generation may have faded, but a new core including Kevin De Bruyne and Jérémy Doku keeps Belgium competitive. Their never-ending talent pipeline ensures they remain in contention.' },
    { rank: 11, title: 'Croatia', justification: 'Despite an aging Luka Modrić, Croatia\'s midfield factory keeps producing world-class talent. Their remarkable tournament mentality — reaching semifinals in 2022 and 2018 — cannot be ignored.' },
    { rank: 12, title: 'Uruguay', justification: 'With Federico Valverde, Darwin Núñez, and Ronald Araújo, Uruguay has one of the most exciting young squads in South America. The return of Marcelo Bielsa as manager adds tactical intrigue.' },
    { rank: 13, title: 'USA', justification: 'As co-hosts with home advantage, the USMNT has its best chance ever. Christian Pulisic, Weston McKennie, Gio Reyna, and Folarin Balogun lead a squad that has grown tremendously in experience.' },
    { rank: 14, title: 'Morocco', justification: 'After becoming the first African semifinalist in 2022, Morocco proved they belong among the elite. Achraf Hakimi and Sofyan Amrabat lead a resilient, organized side.' },
    { rank: 15, title: 'Mexico', justification: 'Co-hosts with passionate home support. Despite recent struggles, Mexico\'s youth movement including Santiago Giménez and Edson Álvarez could galvanize a nation hungry for a deep run.' },
    { rank: 16, title: 'Canada', justification: 'Making their Men\'s World Cup debut in 2022, Canada now co-hosts in 2026. Alphonso Davies and Jonathan David form one of the most dangerous attacking duos in CONCACAF.' },
    { rank: 17, title: 'Japan', justification: 'Samurai Blue has quietly become one of the most consistent tournament performers. Their technical discipline, tactical flexibility, and growing European influence make them Asia\'s best hope.' },
    { rank: 18, title: 'Senegal', justification: 'African champions with Sadio Mané and Kalidou Koulibaly leading a squad packed with Premier League and Ligue 1 talent. Their 2022 Round of 16 run showed they can compete with anyone.' },
    { rank: 19, title: 'South Korea', justification: 'Son Heung-min leads a golden generation with Kim Min-jae anchoring defense and Lee Kang-in providing creativity. The 2002 semifinal run proves Asian hosts can overachieve.' },
    { rank: 20, title: 'Switzerland', justification: 'Consistent tournament performers who reached the quarterfinals in 2024. Granit Xhaka and Manuel Akanji lead a disciplined, tactically astute squad that thrives as underdogs.' },
  ];

  await ListItem.insertMany(
    items.map(item => ({
      post_id: post._id,
      rank: item.rank,
      title: item.title,
      justification: item.justification,
    }))
  );
  console.log(`  ✅ Created: ${post.title} (${slug})`);
}

async function seedWweDebate(authorId: string, imageUrl: string) {
  console.log('\n🤼 Seeding: Brock Lesnar vs Roman Reigns — Who Wrecked More Havoc in WWE?...');
  const slug = 'brock-lesnar-vs-roman-reigns-havoc-' + crypto.randomBytes(3).toString('hex');
  const cat = await getCategory('sports');

  const post = new Post({
    title: 'Brock Lesnar vs Roman Reigns — Who Wrecked More Havoc in WWE?',
    slug,
    post_type: 'this_vs_that',
    intro: 'Two of the most dominant forces in WWE history. Both have held world championships, main-evented WrestleManias, and left a trail of destruction. But who truly wrecked more havoc? Let the debate begin.',
    category_slug: cat,
    author_id: authorId,
    author_username: 'nekwasar',
    author_display_name: 'Nekwasar',
    status: 'approved',
    published_at: new Date(),
    hero_image_url: imageUrl,
    comment_count: 0,
    view_count: 0,
  });
  await post.save();

  await ListItem.insertMany([
    {
      post_id: post._id,
      rank: 1,
      title: 'Brock Lesnar — The Beast Incarnate',
      justification: 'Brock Lesnar\'s path of destruction began in 2002 when he became the youngest WWE Champion at 25. His F5 has leveled everyone from The Rock to John Cena to The Undertaker. He ended The Streak at WrestleMania XXX (21-1), arguably the most shocking moment in wrestling history. Lesnar has been a part-time destroyer who appears, wreaks havoc, and disappears — making every appearance feel like a natural disaster. His UFC background, amateur wrestling credentials, and sheer athleticism for a man his size make him physically unparalleled in WWE history. He has held 10 world championships and defeated virtually every legend the company has produced.',
    },
    {
      post_id: post._id,
      rank: 2,
      title: 'Roman Reigns — The Tribal Chief',
      justification: 'Roman Reigns\' reign of terror peaked during his historic 1,316-day championship run as the Tribal Chief. Leading The Bloodline, he dominated WWE like no one since the Attitude Era. He stacked and pinned John Cena, Brock Lesnar, and Cody Rhodes at WrestleManias. His spear and guillotine choke have left a generation of challengers broken. Reigns has main-evented more WrestleManias than any other active superstar (8), and his character work as the arrogant, untouchable head of the table has drawn comparisons to the greatest heels of all time. The difference? Reigns has been a full-time destroyer, appearing weekly to remind everyone who runs the show — making his havoc sustained rather than sporadic.',
    },
  ]);

  console.log(`  ✅ Created: ${post.title} (${slug})`);
}

async function seedWW2Article(authorId: string, imageUrl: string) {
  console.log('\n📖 Seeding: Everything You Need to Know About World War II...');
  const slug = 'everything-about-world-war-ii-' + crypto.randomBytes(3).toString('hex');
  const cat = await getCategory('education');

  const article = new Article({
    title: 'Everything You Need to Know About World War II',
    slug,
    body: `World War II (1939–1945) was the deadliest and most widespread conflict in human history, involving over 30 countries and resulting in an estimated 70–85 million casualties, the majority of whom were civilians. It reshaped the global order, led to the rise of the United States and Soviet Union as superpowers, and laid the groundwork for the Cold War that would dominate the second half of the 20th century.

## The Causes: A World on the Brink

The seeds of World War II were planted in the aftermath of World War I. The Treaty of Versailles (1919) imposed harsh penalties on Germany, including massive reparations, territorial losses, and military restrictions. This created deep resentment among the German population and economic instability that made the rise of extremist ideologies possible.

The Great Depression of the 1930s further destabilized Europe and Asia. In Germany, Adolf Hitler and the Nazi Party rose to power in 1933, promising to restore German pride and reverse the terms of Versailles. Hitler pursued an aggressive expansionist policy, remilitarizing the Rhineland in 1936, annexing Austria in 1938 (the Anschluss), and demanding the Sudetenland region of Czechoslovakia.

Meanwhile, in Asia, the Empire of Japan had been pursuing its own expansionist agenda. Japan invaded Manchuria in 1931 and launched a full-scale invasion of China in 1937, committing atrocities like the Nanking Massacre that killed an estimated 300,000 civilians.

Despite these aggressions, Western powers pursued a policy of appeasement, hoping to avoid another devastating war. The Munich Agreement of 1938 allowed Germany to annex the Sudetenland in exchange for promises of peace. This policy proved disastrous when Hitler violated the agreement by occupying the rest of Czechoslovakia in March 1939.

The final trigger came on September 1, 1939, when Germany invaded Poland. Britain and France, having pledged to defend Poland, declared war on Germany on September 3, 1939. World War II had begun.

## The Major Theaters of War

### The European Theater

Germany\'s blitzkrieg ("lightning war") tactics quickly overwhelmed Poland, Denmark, Norway, the Netherlands, Belgium, and France. By June 1940, France had fallen, and Britain stood alone against Nazi Germany. The Battle of Britain (July–October 1940) saw the Royal Air Force repel the German Luftwaffe, forcing Hitler to abandon plans for a cross-Channel invasion.

Hitler\'s greatest strategic mistake was the invasion of the Soviet Union on June 22, 1941 (Operation Barbarossa). Despite initial successes, the German advance stalled at the gates of Moscow in December 1941 and was decisively defeated at the Battle of Stalingrad (1942–1943), which became the turning point on the Eastern Front. The brutal Eastern Front saw some of the largest battles in history, including Kursk (the largest tank battle ever) and the prolonged Siege of Leningrad, which lasted 872 days.

The Western Allies launched the D-Day invasion on June 6, 1944 (Operation Overlord), the largest amphibious invasion in history. Allied forces liberated France and pushed toward Germany. The Battle of the Bulge (December 1944–January 1945) was Germany\'s last major offensive. By April 1945, Allied forces had crossed the Rhine, and Soviet forces had captured Berlin. Hitler committed suicide on April 30, 1945, and Germany surrendered unconditionally on May 7–8, 1945 (V-E Day).

### The Pacific Theater

Japan\'s attack on Pearl Harbor on December 7, 1941 brought the United States into the war. Japan rapidly conquered Southeast Asia and the Western Pacific, including the Philippines, Singapore, and the Dutch East Indies.

The turning point came at the Battle of Midway (June 1942), where the U.S. Navy destroyed four Japanese aircraft carriers. The subsequent Allied strategy of "island hopping" — capturing key islands while bypassing others — gradually pushed Japanese forces back. Major battles included Guadalcanal (1942–1943), Iwo Jima (February–March 1945), and Okinawa (April–June 1945), where casualties on both sides were staggering.

The war in the Pacific was characterized by its brutality, with both sides committing atrocities. The war ended after the United States dropped atomic bombs on Hiroshima (August 6, 1945) and Nagasaki (August 9, 1945). Japan surrendered on August 15, 1945 (V-J Day).

## The Holocaust: The Greatest Crime

The Holocaust was the systematic, state-sponsored persecution and murder of six million Jews by the Nazi regime and its collaborators. Additionally, millions of others — including Roma, Slavs, disabled individuals, political dissidents, and homosexuals — were murdered in concentration and extermination camps. Auschwitz-Birkenau, Treblinka, and Sobibor became symbols of industrial-scale murder.

The full scale of the Holocaust became apparent only after the war, when Allied forces liberated the camps. The Nuremberg Trials (1945–1946) held Nazi leaders accountable for crimes against humanity, establishing principles of international law that endure today.

## The Home Front and Total War

World War II was a total war that mobilized entire societies. In the United States, women entered the workforce in unprecedented numbers ("Rosie the Riveter"), and the government rationed food, fuel, and materials. The war effort pulled the United States out of the Great Depression.

In Britain, civilians endured the Blitz — nightly bombing campaigns that killed 43,000 civilians. The Soviet Union lost an estimated 27 million people, with entire cities like Stalingrad and Leningrad reduced to rubble.

The war also saw the forced relocation and internment of Japanese Americans in the United States, a violation of civil liberties that was later acknowledged as unjust.

## Technological and Scientific Impact

World War II accelerated technological development at an astonishing pace. Radar, jet engines, rocketry, computers (the Colossus and ENIAC), and nuclear weapons all emerged from wartime research. Penicillin was mass-produced for the first time. Blood plasma transfusions, advanced surgery techniques, and psychological understanding of trauma (then called "shell shock") advanced dramatically.

The war also led to the development of the first electronic digital computers, used for codebreaking at Bletchley Park, where Alan Turing\'s work on the Enigma machine helped shorten the war by an estimated two years.

## The Aftermath and Legacy

World War II left a devastated world. Europe lay in ruins, Japan was occupied, and an estimated 60–80 million people had died — about 3% of the world\'s population at the time.

The war\'s aftermath reshaped global politics:
- The United Nations was established in 1945 to prevent future conflicts.
- The United States launched the Marshall Plan, providing $13 billion (over $150 billion today) to rebuild Western Europe.
- Germany was divided into East and West, becoming the frontline of the Cold War.
- The Soviet Union emerged as a superpower, controlling Eastern Europe through puppet governments.
- Decolonization accelerated as European powers, exhausted by war, could no longer maintain their empires.
- The Nuremberg Principles established that individuals could be held accountable for war crimes and crimes against humanity.
- Nuclear weapons fundamentally altered the nature of warfare, ushering in an era of mutually assured destruction that paradoxically prevented direct conflict between superpowers for decades.

The human cost of World War II is almost incomprehensible. Beyond the military casualties, approximately 30 million civilians died from bombing, starvation, disease, and genocide. The war displaced millions and created a refugee crisis that took years to resolve.

For the countries that fought it, World War II became a defining national memory — a testament to sacrifice, resilience, and the capacity for both terrible destruction and remarkable heroism. It demonstrated the worst and best of humanity, from Auschwitz to the beaches of Normandy, from the firebombing of Tokyo to the courage of resistance fighters across occupied Europe.

Eighty years later, World War II continues to shape international relations, military strategy, and our understanding of what happens when diplomacy fails and total war consumes nations. Its lessons — about the dangers of nationalism, the importance of international cooperation, and the human cost of conflict — remain as relevant today as they were in 1945.`,
    category_slug: cat,
    cover_image: imageUrl,
    reading_time: 12,
    sources: [
      { url: 'https://www.iwm.org.uk/history/world-war-ii', title: 'Imperial War Museums — World War II Overview', accessed_at: new Date().toISOString().split('T')[0] },
      { url: 'https://encyclopedia.ushmm.org/', title: 'United States Holocaust Memorial Museum', accessed_at: new Date().toISOString().split('T')[0] },
      { url: 'https://www.nationalww2museum.org/', title: 'The National WWII Museum', accessed_at: new Date().toISOString().split('T')[0] },
    ],
    author_id: authorId,
    author_username: 'nekwasar',
    author_display_name: 'Nekwasar',
    status: 'approved',
    published_at: new Date(),
  });
  await article.save();

  console.log(`  ✅ Created article: ${article.title} (${article.slug}) — ~${article.body.length} chars`);
}

async function main() {
  console.log('🌱 Seeding Content Pack\n');

  await mongoose.connect(MONGO_URI);
  console.log('📦 Connected to MongoDB\n');

  const authorId = await getOrCreateUser();
  console.log(`👤 Author: nekwasar (${authorId})\n`);

  const mysteriesUrl = await processHeroImage(IMAGES.mysteries);
  const worldCupUrl = await processHeroImage(IMAGES.worldCup);
  const wweUrl = await processHeroImage(IMAGES.wwe);
  const ww2Url = await processHeroImage(IMAGES.ww2);

  await seedMysteries(authorId, mysteriesUrl);
  await seedWorldCup(authorId, worldCupUrl);
  await seedWweDebate(authorId, wweUrl);
  await seedWW2Article(authorId, ww2Url);

  console.log('\n✨ Content pack seeding complete!');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
