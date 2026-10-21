import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STORE_PRODUCTS = [
  // EQUIPMENT
  {
    name: 'Commercial Rubber Hex Dumbbell Set (Pair 10kg)',
    category: 'EQUIPMENT',
    price: 3499.0,
    discount: 15,
    stock: 20,
    description: 'Heavy duty commercial grade rubber encased hexagonal dumbbells. Anti-roll design with knurled chrome handles for maximum grip during training.',
    image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop',
    isFeatured: true,
    isPromoted: true
  },
  {
    name: 'Adjustable Weight Multi-Bench (7 Incline Positions)',
    category: 'EQUIPMENT',
    price: 7999.0,
    discount: 10,
    stock: 8,
    description: 'Heavy duty steel multi-angle bench supporting flat, incline, and decline chest presses, shoulder presses, and dumbbell rows. 300kg weight capacity.',
    image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&auto=format&fit=crop',
    isFeatured: true
  },
  {
    name: 'Olympic Hard Chrome Barbell 20kg (7 Feet / 2.2m)',
    category: 'EQUIPMENT',
    price: 6499.0,
    discount: 12,
    stock: 15,
    description: 'Standard 20kg Olympic barbell rated for 1500 lbs. Smooth needle bearings for clean snatches, deadlifts, and squats with dual knurl marks.',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop',
    isFeatured: true
  },
  {
    name: 'Cast Iron Kettlebell 16kg (Powder Coated)',
    category: 'EQUIPMENT',
    price: 2499.0,
    discount: 5,
    stock: 25,
    description: 'Solid single-cast iron kettlebell with matte powder coating for textured grip. Perfect for kettlebell swings, Turkish get-ups, and functional circuits.',
    image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop'
  },
  {
    name: 'Heavy Duty Power Squat Rack Station with Pull-Up Bar',
    category: 'EQUIPMENT',
    price: 21999.0,
    discount: 18,
    stock: 5,
    description: 'Commercial power rack with safety spotter arms, multi-grip pull-up bar, and plate storage horns. Built for heavy benching, squats, and rack pulls.',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop',
    isPromoted: true
  },
  {
    name: 'High-Density Rubber Bumper Plates Pair (20kg x 2)',
    category: 'EQUIPMENT',
    price: 8999.0,
    discount: 10,
    stock: 12,
    description: '100% virgin rubber bumper plates with solid stainless steel collar inserts. Low bounce formula protects gym flooring and bars.',
    image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=600&auto=format&fit=crop'
  },

  // ACCESSORIES
  {
    name: 'Pro Heavy Leather Weightlifting Belt (10mm)',
    category: 'ACCESSORIES',
    price: 1499.0,
    discount: 20,
    stock: 30,
    description: 'Genuine layered saddle leather powerlifting belt with heavy steel dual-prong buckle. Provides unmatched intra-abdominal pressure support for heavy lifts.',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop',
    isFeatured: true
  },
  {
    name: '5-Level Elastic Resistance Loop Bands Set with Carry Pouch',
    category: 'ACCESSORIES',
    price: 699.0,
    discount: 25,
    stock: 50,
    description: 'Premium natural latex resistance loops ranging from X-Light to X-Heavy. Ideal for warming up rotator cuffs, glute activation, and mobility work.',
    image: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=600&auto=format&fit=crop'
  },
  {
    name: 'Reinforced Wrist Wraps Pair (18 Inch Heavy Duty Elastic)',
    category: 'ACCESSORIES',
    price: 499.0,
    discount: 15,
    stock: 45,
    description: 'Thumb loop elastic wrist supports with wide velcro closure. Eliminates wrist pain and hyperextension during heavy bench press and overhead squats.',
    image: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=600&auto=format&fit=crop'
  },
  {
    name: 'Pro Speed Bearing Jump Rope (Tangle-Free Steel Cable)',
    category: 'ACCESSORIES',
    price: 399.0,
    discount: 10,
    stock: 60,
    description: 'High-speed 360-degree ball bearing jump rope with coated steel wire. Built for double-unders, HIIT cardio circuits, and boxing conditioning.',
    image: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=600&auto=format&fit=crop'
  },
  {
    name: 'Deep Tissue Grid Foam Roller (Muscle Recovery 45cm)',
    category: 'ACCESSORIES',
    price: 899.0,
    discount: 15,
    stock: 25,
    description: 'High density EVA foam roller with multi-density grid pattern for myofascial release, tight IT bands, back stiffness, and accelerated recovery.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&auto=format&fit=crop'
  },

  // SUPPLEMENTS
  {
    name: '100% Whey Isolate Protein (Rich Double Chocolate, 2kg)',
    category: 'SUPPLEMENTS',
    price: 4299.0,
    discount: 15,
    stock: 40,
    description: 'Ultra-pure microfiltered whey protein isolate delivering 27g protein, 5.5g BCAAs, and less than 1g carb per scoop. Zero bloating, instant mixing.',
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop',
    isFeatured: true,
    isPromoted: true
  },
  {
    name: 'Micronized Creatine Monohydrate (Creapure 300g)',
    category: 'SUPPLEMENTS',
    price: 999.0,
    discount: 10,
    stock: 50,
    description: 'Pure pharmaceutical grade micronized creatine monohydrate. Clinically proven to boost ATP muscle power, strength output, and workout endurance.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop'
  },
  {
    name: 'BCAA 2:1:1 Intra-Workout Electrolytes (Blue Raspberry 400g)',
    category: 'SUPPLEMENTS',
    price: 1499.0,
    discount: 20,
    stock: 35,
    description: 'Instantized Leucine, Isoleucine, and Valine with hydration coconut water powder and pink Himalayan salt to prevent muscle cramping and breakdown.',
    image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop'
  },
  {
    name: 'Ignite Pre-Workout Explosive Energy (Watermelon Burst 300g)',
    category: 'SUPPLEMENTS',
    price: 1799.0,
    discount: 15,
    stock: 30,
    description: 'High-stim pre-workout loaded with 300mg Caffeine, 3.2g Beta-Alanine, and 6g L-Citrulline Malate for skin-splitting pumps and intense focus.',
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop'
  },

  // APPAREL
  {
    name: 'GYMGO Dry-Fit Muscle Fit Compression T-Shirt',
    category: 'APPAREL',
    price: 799.0,
    discount: 25,
    stock: 45,
    description: 'Four-way stretch moisture-wicking athletic tee. Breathable side mesh panels keep you cool through grueling heavy training sessions.',
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&auto=format&fit=crop'
  },
  {
    name: 'Athletic Workout Joggers with Zipper Pockets',
    category: 'APPAREL',
    price: 1199.0,
    discount: 20,
    stock: 30,
    description: 'Tapered ankle gym joggers with elastic waistband and deep zip phone pockets. Super comfortable for squats, lunges, or casual wear.',
    image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop'
  },
  {
    name: 'Breathable Raw-Cut Bodybuilding Stringer Tank',
    category: 'APPAREL',
    price: 599.0,
    discount: 15,
    stock: 40,
    description: 'Classic deep-cut bodybuilding tank top. Lightweight combed cotton blend allows maximum range of motion during chest and shoulder days.',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop'
  }
];

async function seedProducts() {
  console.log('Seeding store products and equipment across Jaipur gyms...');

  const gyms = await prisma.gym.findMany({
    select: { id: true, name: true }
  });

  if (gyms.length === 0) {
    throw new Error('No gyms found in database. Run import-gyms first.');
  }

  console.log(`Found ${gyms.length} gyms to associate products with.`);

  let createdCount = 0;
  for (let i = 0; i < STORE_PRODUCTS.length; i++) {
    const prodData = STORE_PRODUCTS[i];
    // Assign products cyclically across the gyms
    const gym = gyms[i % gyms.length];

    // Check if product already exists
    const existing = await prisma.product.findFirst({
      where: { name: prodData.name }
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          ...prodData,
          gymId: gym.id
        }
      });
      createdCount++;
      console.log(`[${createdCount}] Created: ${prodData.name} (Category: ${prodData.category}) -> Assigned to "${gym.name}"`);
    } else {
      console.log(`Product already exists: ${prodData.name}`);
    }
  }

  const total = await prisma.product.count();
  console.log(`\n🎉 Store seeding complete! Total products in store: ${total}`);
}

seedProducts()
  .catch(err => {
    console.error('Error seeding store products:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
