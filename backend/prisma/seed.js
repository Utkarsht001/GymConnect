import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clear existing database entries (order matters due to foreign keys)
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.gymUpdate.deleteMany();
  await prisma.gymPhoto.deleteMany();
  await prisma.gymFacility.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.product.deleteMany();
  await prisma.gym.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create default Facilities
  const facilitiesData = [
    { name: 'Cardio Area', icon: 'Heart' },
    { name: 'Weight Training', icon: 'Dumbbell' },
    { name: 'CrossFit Zone', icon: 'Flame' },
    { name: 'Personal Training', icon: 'UserCheck' },
    { name: 'Yoga Studio', icon: 'Sparkles' },
    { name: 'Steam / Sauna', icon: 'Droplets' },
    { name: 'Locker Rooms', icon: 'Shield' },
    { name: 'Free Wi-Fi', icon: 'Wifi' },
    { name: 'Air Conditioning', icon: 'Wind' },
    { name: 'Cafeteria', icon: 'Coffee' },
  ];

  const dbFacilities = [];
  for (const fac of facilitiesData) {
    const dbFac = await prisma.facility.create({ data: fac });
    dbFacilities.push(dbFac);
  }
  console.log(`Created ${dbFacilities.length} facilities.`);

  // 3. Create Users with hashed passwords
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@fithub.com',
      password: hashedPassword,
      name: 'System Admin',
      role: 'ADMIN',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    },
  });

  // Gym Owners
  const owner1 = await prisma.user.create({
    data: {
      email: 'owner1@fithub.com',
      password: hashedPassword,
      name: 'Vikram Singh',
      role: 'GYM_OWNER',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: 'owner2@fithub.com',
      password: hashedPassword,
      name: 'Rohit Sharma',
      role: 'GYM_OWNER',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  });

  const owner3 = await prisma.user.create({
    data: {
      email: 'owner3@fithub.com',
      password: hashedPassword,
      name: 'Anjali Mehta',
      role: 'GYM_OWNER',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  });

  // Customers
  const customer1 = await prisma.user.create({
    data: {
      email: 'customer1@fithub.com',
      password: hashedPassword,
      name: 'Amit Patel',
      role: 'CUSTOMER',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150',
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'customer2@fithub.com',
      password: hashedPassword,
      name: 'Priya Sharma',
      role: 'CUSTOMER',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    },
  });

  console.log('Created admin, owners, and customers.');

  // Create initial empty carts for customers
  await prisma.cart.create({ data: { userId: customer1.id } });
  await prisma.cart.create({ data: { userId: customer2.id } });

  // 4. Create Gym Profiles
  // Gym 1 - Golds Elite (Approved)
  const gym1 = await prisma.gym.create({
    data: {
      ownerId: owner1.id,
      name: "Gold's Elite Gym",
      description: "Step into Jaipur's premium fitness destination. We offer state-of-the-art strength training machinery, an expansive cardio zone, custom functional workout spaces, and elite certified personal trainers dedicated to shifting your limits.",
      address: "Plot 12, Vaishali Nagar Main Rd",
      city: "Jaipur",
      latitude: 26.9124,
      longitude: 75.7873,
      contactNumber: "+91 98765 43210",
      email: "golds.vaishali@gmail.com",
      logo: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300",
      coverImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200",
      openingHours: "05:30 AM - 10:30 PM",
      isApproved: true,
    },
  });

  // Gym 2 - Iron Paradise (Approved)
  const gym2 = await prisma.gym.create({
    data: {
      ownerId: owner2.id,
      name: "Iron Paradise Fitness Center",
      description: "No excuses, just results. Iron Paradise is built for heavy lifters, powerlifters, and bodybuilders. Outfitted with high-grade plate loaded equipment, squat cages, dumbbells up to 80kg, and dedicated lifting platforms.",
      address: "Sector 5, Mansarovar Circle",
      city: "Jaipur",
      latitude: 26.8566,
      longitude: 75.7635,
      contactNumber: "+91 99887 76655",
      email: "iron.paradise@gmail.com",
      logo: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=300",
      coverImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200",
      openingHours: "06:00 AM - 10:00 PM",
      isApproved: true,
    },
  });

  // Gym 3 - SoulYoga & Wellness (Pending Approval)
  const gym3 = await prisma.gym.create({
    data: {
      ownerId: owner3.id,
      name: "SoulYoga & Wellness Studio",
      description: "Find your zen in a peaceful oasis. We provide daily therapeutic yoga flows, meditation guidance, pilates classes, steam treatment rooms, and healthy nutrition plans to heal both your mind and body.",
      address: "45, Malviya Nagar",
      city: "Jaipur",
      latitude: 26.8532,
      longitude: 75.8254,
      contactNumber: "+91 88776 65544",
      email: "soulyoga@gmail.com",
      logo: "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=300",
      coverImage: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200",
      openingHours: "06:00 AM - 08:30 PM",
      isApproved: false, // PENDING ADMIN APPROVAL
    },
  });

  console.log('Created gym profiles.');

  // 5. Connect Facilities to Gyms
  // Gym 1 has: Cardio, Weight Training, Personal Training, WiFi, AC, Locker Rooms
  const gym1FacNames = ['Cardio Area', 'Weight Training', 'Personal Training', 'Free Wi-Fi', 'Air Conditioning', 'Locker Rooms'];
  for (const name of gym1FacNames) {
    const fac = dbFacilities.find(f => f.name === name);
    if (fac) {
      await prisma.gymFacility.create({
        data: { gymId: gym1.id, facilityId: fac.id },
      });
    }
  }

  // Gym 2 has: Weight Training, CrossFit Zone, Locker Rooms, Security
  const gym2FacNames = ['Weight Training', 'CrossFit Zone', 'Locker Rooms'];
  for (const name of gym2FacNames) {
    const fac = dbFacilities.find(f => f.name === name);
    if (fac) {
      await prisma.gymFacility.create({
        data: { gymId: gym2.id, facilityId: fac.id },
      });
    }
  }

  // Gym 3 has: Yoga Studio, Steam / Sauna, Locker Rooms, Free Wi-Fi, Air Conditioning
  const gym3FacNames = ['Yoga Studio', 'Steam / Sauna', 'Locker Rooms', 'Free Wi-Fi', 'Air Conditioning'];
  for (const name of gym3FacNames) {
    const fac = dbFacilities.find(f => f.name === name);
    if (fac) {
      await prisma.gymFacility.create({
        data: { gymId: gym3.id, facilityId: fac.id },
      });
    }
  }

  console.log('Connected facilities to gyms.');

  // 6. Create Membership Plans for Gyms
  // Gym 1 Plans
  const gym1Plans = [
    { name: 'Basic Monthly', price: 1500, durationDays: 30, description: 'Access to general gym cardio and weight floor. 1 induction session.', features: 'Gym Floor Access, Cardio Equipment, Lockers' },
    { name: 'Pro Quarterly', price: 3999, durationDays: 90, description: 'Full access to weight section, cardio zone, and group classes. Includes 3 personal training credits.', features: 'Full Gym Access, Group Classes, 3x Personal Trainer Sessions, High Speed WiFi' },
    { name: 'Elite Annual', price: 12999, durationDays: 365, description: 'All-inclusive premium annual membership. Unlimited group classes, steam bath, customized workout and nutrition roadmap.', features: '24/7 Access, Unlimited Group Classes, Steam/Sauna Access, Custom Workout Plans, Nutrition Guide, VIP Lounge' },
  ];

  for (const plan of gym1Plans) {
    await prisma.membershipPlan.create({
      data: { ...plan, gymId: gym1.id },
    });
  }

  // Gym 2 Plans
  const gym2Plans = [
    { name: 'Iron Monthly', price: 1200, durationDays: 30, description: 'Access to the free weights and heavy lifting zones.', features: 'Heavy Weight Area, Squat Racks, Locker Access' },
    { name: 'Hardcore Half-Yearly', price: 6000, durationDays: 180, description: 'Six months of hardcore strength training. Includes custom powerlifting assessment.', features: 'All Weight Floors, Powerlifting Area, CrossFit Cage Access, Chalk Allowed' },
    { name: 'Paradise Annual', price: 9999, durationDays: 365, description: 'Unlimited annual lifting. Best value package.', features: 'All-Time Weight Access, CrossFit Classes, Free Training Seminars, Free Shaker Bottle' },
  ];

  for (const plan of gym2Plans) {
    await prisma.membershipPlan.create({
      data: { ...plan, gymId: gym2.id },
    });
  }

  // Gym 3 Plans (Yoga)
  const gym3Plans = [
    { name: 'Zen Monthly Pass', price: 2000, durationDays: 30, description: 'Access to 12 yoga and meditation sessions a month.', features: 'Yoga Studio Access, Mats Provided, Water Service' },
    { name: 'Holistic Quarterly', price: 5000, durationDays: 90, description: 'Unlimited classes for yoga, pilates, and meditation. 2 steam room sessions included.', features: 'Unlimited Yoga & Pilates, Meditation guidance, 2x Steam Room Passes, Locker Access' },
  ];

  for (const plan of gym3Plans) {
    await prisma.membershipPlan.create({
      data: { ...plan, gymId: gym3.id },
    });
  }

  console.log('Created membership plans.');

  // 7. Create Store Products for Gyms
  const gym1Products = [
    { name: 'Premium Steel Dumbbell Pair (10kg)', description: 'Professional rubber coated hex dumbbells with contoured steel handles for superior grip and durability.', price: 2499, discount: 15, stock: 12, category: 'EQUIPMENT', image: 'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=400' },
    { name: 'Premium Whey Protein (1kg) - Chocolate', description: '25g of high quality fast-absorbing whey protein isolate per scoop. Gluten free, low sugar.', price: 3499, discount: 10, stock: 25, category: 'SUPPLEMENTS', image: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=400' },
    { name: 'Aluminium Thermal Gym Water Bottle (750ml)', description: 'Vacuum insulated double-walled water bottle. Keeps liquids ice cold for 24 hours.', price: 799, discount: 5, stock: 40, category: 'ACCESSORIES', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400' },
  ];

  for (const prod of gym1Products) {
    await prisma.product.create({
      data: { ...prod, gymId: gym1.id },
    });
  }

  const gym2Products = [
    { name: 'Heavy Duty Lift Wrist Wraps', description: 'Elite powerlifting wrist support straps. 18-inch length, heavy elastic build with thumb loops.', price: 599, discount: 0, stock: 30, category: 'ACCESSORIES', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400' },
    { name: 'Non-Slip TPE Workout Yoga Mat (6mm)', description: 'Eco-friendly TPE material with double-sided anti-slip texture. Extra cushioning for joints.', price: 1299, discount: 20, stock: 18, category: 'EQUIPMENT', image: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=400' },
    { name: 'FitHub Sports Stringer Vest - Obsidian Black', description: 'Ultra breathable cotton spandex fabric blend with deep cut sides for extreme freedom during workouts.', price: 499, discount: 10, stock: 15, category: 'APPAREL', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400' },
  ];

  for (const prod of gym2Products) {
    await prisma.product.create({
      data: { ...prod, gymId: gym2.id },
    });
  }

  console.log('Created marketplace products.');

  // 8. Create Gym Gallery Photos
  const gym1Photos = [
    { url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800', category: 'INTERIOR' },
    { url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800', category: 'EQUIPMENT' },
    { url: 'https://images.unsplash.com/photo-1623874514711-4f96491c36e7?w=800', category: 'EQUIPMENT' },
    { url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800', category: 'EXTERIOR' },
  ];

  for (const pic of gym1Photos) {
    await prisma.gymPhoto.create({
      data: { ...pic, gymId: gym1.id },
    });
  }

  const gym2Photos = [
    { url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800', category: 'INTERIOR' },
    { url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800', category: 'EQUIPMENT' },
  ];

  for (const pic of gym2Photos) {
    await prisma.gymPhoto.create({
      data: { ...pic, gymId: gym2.id },
    });
  }

  console.log('Created gym photo galleries.');

  // 9. Create Subscriptions
  const goldsPlans = await prisma.membershipPlan.findMany({ where: { gymId: gym1.id } });
  const monthlyPlan = goldsPlans.find(p => p.name === 'Basic Monthly');
  const annualPlan = goldsPlans.find(p => p.name === 'Elite Annual');

  if (monthlyPlan) {
    await prisma.subscription.create({
      data: {
        customerId: customer1.id,
        gymId: gym1.id,
        planId: monthlyPlan.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        pricePaid: monthlyPlan.price,
        status: 'ACTIVE',
      },
    });
  }

  if (annualPlan) {
    await prisma.subscription.create({
      data: {
        customerId: customer2.id,
        gymId: gym1.id,
        planId: annualPlan.id,
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000),
        pricePaid: annualPlan.price,
        status: 'ACTIVE',
      },
    });
  }

  console.log('Created default active memberships.');

  // 10. Create Gym Updates
  await prisma.gymUpdate.create({
    data: {
      gymId: gym1.id,
      title: 'New Heavy Hammer Strength Racks Installed!',
      description: 'We have added three brand new commercial-grade multi-purpose squat cages and heavy plate loader machinery in the weight room. Check them out this week!',
      imageUrl: 'https://images.unsplash.com/photo-1623874514711-4f96491c36e7?w=600',
    },
  });

  await prisma.gymUpdate.create({
    data: {
      gymId: gym1.id,
      title: 'Updated Independence Day Holiday Timing',
      description: 'Please note that on Independence Day (August 15th), the gym will operate on half-day schedules, from 06:00 AM to 01:00 PM. Regular schedules resume the next day.',
      imageUrl: null,
    },
  });

  await prisma.gymUpdate.create({
    data: {
      gymId: gym2.id,
      title: '15% Off Annual Gym Memberships!',
      description: 'Start your winter bulk early. Buy the Paradise Annual membership this week and secure a flat 15% discount automatically! Offer expires Friday.',
      imageUrl: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=600',
    },
  });

  console.log('Created gym updates.');

  // 11. Create Reviews
  await prisma.review.create({
    data: {
      customerId: customer1.id,
      gymId: gym1.id,
      rating: 5,
      comment: 'Excellent gym in Jaipur! The staff is friendly, facilities are top tier, and hygiene is always maintained. Totally worth the premium.',
      ownerReply: 'Thank you Amit! We work hard to maintain the best standard for our community.',
    },
  });

  await prisma.review.create({
    data: {
      customerId: customer2.id,
      gymId: gym1.id,
      rating: 4,
      comment: 'Golds Elite is amazing. The only problem is it gets super crowded during peak hours (6 PM - 8 PM). Highly recommend going in the morning.',
      ownerReply: null,
    },
  });

  await prisma.review.create({
    data: {
      customerId: customer1.id,
      gymId: gym2.id,
      rating: 5,
      comment: 'Best raw lifting gym. Excellent plate-loaded machines. If you want serious strength results, join this club.',
      ownerReply: 'Appreciate it Vikram! Keep grinding.',
    },
  });

  console.log('Created gym reviews.');

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
