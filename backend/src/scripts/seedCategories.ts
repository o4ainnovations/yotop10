import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Category } from '../models/Category';

dotenv.config();

const parentCategories = [
  {
    name: 'Technology & Digital',
    slug: 'technology',
    description: 'All things tech, software, hardware, and digital innovation',
    icon: '💻',
    children: [
      'Artificial Intelligence (AI)', 'Machine Learning', 'Cybersecurity', 'Cloud Computing',
      'Blockchain & Cryptocurrency', 'Software Development', 'Web Development', 'Mobile Apps',
      'Gaming & Consoles', 'Social Media Platforms', 'E-commerce', 'Fintech',
      'IoT & Smart Devices', 'Virtual Reality (VR)', 'Augmented Reality (AR)', 'Data Science',
      'DevOps & CI/CD', 'Programming Languages', 'Databases', 'Networking',
      'Operating Systems', 'Hardware & Components', 'Tech Startups', 'Digital Marketing',
      'SEO & Analytics', 'Content Management', 'API Development', 'Microservices',
      'Quantum Computing', 'Tech Careers'
    ],
  },
  {
    name: 'Health & Wellness',
    slug: 'health',
    description: 'Physical health, mental wellness, fitness, and medical topics',
    icon: '🏥',
    children: [
      'Fitness & Exercise', 'Nutrition & Diet', 'Mental Health', 'Yoga & Meditation',
      'Weight Loss', 'Bodybuilding', 'Cardio & Running', 'Sports Medicine',
      'Alternative Medicine', 'Pharmaceuticals', 'Medical Research', 'Public Health',
      'Dental Care', 'Vision & Eye Care', 'Skin Care', 'Hair Care',
      'Sleep & Recovery', 'Stress Management', 'Addiction & Recovery', 'Women\'s Health',
      'Men\'s Health', 'Children\'s Health', 'Elderly Care', 'Disability & Accessibility',
      'Health Technology', 'Medical Devices', 'Health Insurance', 'Nutrition Supplements',
      'Holistic Health', 'Health Careers'
    ],
  },
  {
    name: 'Sports & Athletics',
    slug: 'sports',
    description: 'All sports, athletic competitions, and fitness activities',
    icon: '⚽',
    children: [
      'Football (Soccer)', 'Cricket', 'Basketball', 'Hockey (Field & Ice)',
      'Tennis', 'Volleyball', 'Table Tennis', 'Badminton',
      'Baseball', 'American Football', 'Rugby', 'Golf',
      'MMA', 'Boxing', 'Formula 1', 'Cycling',
      'Athletics', 'Swimming', 'eSports', 'Snooker',
      'Handball', 'Gymnastics', 'Wrestling', 'Horse Racing',
      'Surfing', 'Skiing', 'Australian Rules Football', 'Archery',
      'Lacrosse', 'Bowling'
    ],
  },
  {
    name: 'Business & Finance',
    slug: 'business',
    description: 'Entrepreneurship, investing, markets, and financial topics',
    icon: '💼',
    children: [
      'Entrepreneurship', 'Startups', 'Venture Capital', 'Stock Market',
      'Real Estate Investing', 'Personal Finance', 'Banking', 'Insurance',
      'Accounting & Tax', 'Marketing & Advertising', 'Sales', 'E-commerce Business',
      'Supply Chain', 'Human Resources', 'Leadership', 'Management',
      'Business Strategy', 'Franchising', 'Small Business', 'Corporate Finance',
      'Cryptocurrency Trading', 'Forex Trading', 'Investment Funds', 'Retirement Planning',
      'Financial Planning', 'Business Law', 'International Business', 'Business Technology',
      'Business Analytics', 'Business Careers'
    ],
  },
  {
    name: 'Lifestyle & Leisure',
    slug: 'lifestyle',
    description: 'Travel, food, fashion, hobbies, and everyday living',
    icon: '🌴',
    children: [
      'Travel Destinations', 'Hotels & Resorts', 'Airlines & Flights', 'Cruises',
      'Food & Restaurants', 'Cooking & Recipes', 'Wine & Spirits', 'Coffee & Tea',
      'Fashion & Style', 'Beauty & Makeup', 'Luxury Brands', 'Streetwear',
      'Home Decor', 'Interior Design', 'Gardening', 'Pets & Animals',
      'Dating & Relationships', 'Weddings', 'Parenting', 'Family Activities',
      'Outdoor Activities', 'Camping & Hiking', 'Fishing', 'Photography',
      'Movies & TV Shows', 'Music', 'Books & Reading', 'Podcasts',
      'Streaming Services', 'Lifestyle Influencers'
    ],
  },
  {
    name: 'Creative Arts & Entertainment',
    slug: 'creative',
    description: 'Art, music, film, literature, and creative expression',
    icon: '🎨',
    children: [
      'Painting & Drawing', 'Sculpture', 'Digital Art', 'Graphic Design',
      'Animation', 'Film Production', 'Music Production', 'Songwriting',
      'Acting & Theater', 'Dance', 'Stand-up Comedy', 'Literature',
      'Poetry', 'Creative Writing', 'Photography Art', 'Video Games',
      'Board Games', 'Card Games', 'Cosplay', 'Fan Fiction',
      'Art Galleries', 'Museums', 'Concerts & Festivals', 'Nightlife',
      'Comics & Manga', 'Anime', 'K-Pop', 'Hip-Hop',
      'Electronic Music', 'Classical Music'
    ],
  },
  {
    name: 'Education & Self-Development',
    slug: 'education',
    description: 'Learning, skills, personal growth, and academic topics',
    icon: '📚',
    children: [
      'Online Learning', 'Universities', 'K-12 Education', 'Language Learning',
      'Professional Certifications', 'Coding Bootcamps', 'Study Tips', 'Career Development',
      'Public Speaking', 'Productivity', 'Time Management', 'Goal Setting',
      'Mindfulness', 'Self-Help Books', 'Motivation', 'Coaching',
      'Tutoring', 'Test Preparation', 'Scholarships', 'Student Life',
      'Academic Research', 'Scientific Papers', 'History Education', 'Philosophy',
      'Psychology', 'Sociology', 'Political Science', 'Economics',
      'Environmental Science', 'Education Technology'
    ],
  },
  {
    name: 'Home & Family',
    slug: 'home',
    description: 'Home improvement, family life, and domestic topics',
    icon: '🏠',
    children: [
      'Home Improvement', 'DIY Projects', 'Furniture', 'Appliances',
      'Smart Home', 'Home Security', 'Cleaning & Organization', 'Laundry',
      'Kitchen & Cooking', 'Bathroom', 'Bedroom', 'Living Room',
      'Outdoor & Garden', 'Landscaping', 'Pool & Spa', 'Garage & Workshop',
      'Baby & Toddler', 'Kids Activities', 'Teenagers', 'Elderly Care',
      'Family Vacations', 'Holiday Planning', 'Gift Ideas', 'Party Planning',
      'Pet Care', 'Dog Training', 'Cat Care', 'Aquariums',
      'Home Budget', 'Home Insurance'
    ],
  },
  {
    name: 'Professional & Industrial',
    slug: 'professional',
    description: 'Industry, manufacturing, trades, and professional services',
    icon: '🏭',
    children: [
      'Manufacturing', 'Construction', 'Engineering', 'Architecture',
      'Automotive', 'Aerospace', 'Energy & Utilities', 'Mining',
      'Agriculture', 'Forestry', 'Fishing Industry', 'Transportation',
      'Logistics', 'Warehousing', 'Retail', 'Hospitality',
      'Healthcare Industry', 'Legal Services', 'Consulting', 'Accounting Firms',
      'Marketing Agencies', 'IT Services', 'Telecommunications', 'Media & Broadcasting',
      'Publishing', 'Advertising', 'Public Relations', 'Government',
      'Non-Profit', 'Professional Associations'
    ],
  },
  {
    name: 'Social & Global Issues',
    slug: 'social',
    description: 'Society, politics, environment, and global challenges',
    icon: '🌍',
    children: [
      'Climate Change', 'Renewable Energy', 'Conservation', 'Pollution',
      'Human Rights', 'Social Justice', 'Equality', 'Immigration',
      'Politics & Government', 'Elections', 'International Relations', 'Diplomacy',
      'Economic Policy', 'Healthcare Policy', 'Education Policy', 'Technology Policy',
      'Poverty & Inequality', 'Homelessness', 'Food Security', 'Water Crisis',
      'War & Conflict', 'Peace & Resolution', 'Refugees', 'Terrorism',
      'Cybersecurity Threats', 'Privacy & Surveillance', 'Censorship', 'Free Speech',
      'Community Development', 'Volunteering'
    ],
  },
  {
    name: 'Niche Hobbies & Collections',
    slug: 'nichehobbies',
    description: 'Specialized interests, collecting, and unique pastimes',
    icon: '🎯',
    children: [
      'Coin Collecting', 'Stamp Collecting', 'Antiques', 'Vintage Items',
      'Trading Cards', 'Action Figures', 'Model Building', 'RC Vehicles',
      'Drones', 'Astronomy', 'Bird Watching', 'Genealogy',
      'Magic & Illusions', 'Juggling', 'Yo-Yo', 'Kite Flying',
      'Chess & Strategy Games', 'Puzzles', 'Escape Rooms', 'Trivia',
      'Brewing & Distilling', 'Fermentation', 'Cheese Making', 'Baking',
      'Woodworking', 'Metalworking', 'Pottery', 'Knitting & Crochet',
      'Sewing', 'Embroidery'
    ],
  },
];

async function seedCategories() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    // Create parent categories using bulkWrite for upsert
    const parentOperations = parentCategories.map(cat => ({
      updateOne: {
        filter: { slug: cat.slug },
        update: {
          $set: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            icon: cat.icon,
            is_featured: true,
          },
        },
        upsert: true,
      },
    }));

    await Category.bulkWrite(parentOperations);
    console.log(`✅ Created/updated parent categories`);

    // Fetch all parent categories to get their IDs
    const parentDocs = await Category.find({ slug: { $in: parentCategories.map(c => c.slug) } });
    console.log(`✅ Fetched ${parentDocs.length} parent categories`);

    // Create child categories using bulkWrite for upsert
    let childCount = 0;
    const childOperations: any[] = [];

    for (let i = 0; i < parentCategories.length; i++) {
      const parent = parentCategories[i];
      const parentDoc = parentDocs.find(p => p.slug === parent.slug);
      if (!parentDoc) continue;

      for (const childName of parent.children) {
        const childSlug = `${parent.slug}/${childName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
        childOperations.push({
          updateOne: {
            filter: { slug: childSlug },
            update: {
              $set: {
                name: childName,
                slug: childSlug,
                parent_id: parentDoc._id,
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (childOperations.length > 0) {
      await Category.bulkWrite(childOperations, { ordered: false });
      childCount = childOperations.length;
    }

    console.log(`✅ Created ${childCount} child categories`);
    console.log(`📊 Total categories: ${parentDocs.length + childCount}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    console.log('🎉 Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedCategories();
