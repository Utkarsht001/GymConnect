import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Overpass API query for gyms, fitness centres, and sports centres in Jaipur, Rajasthan
const OVERPASS_QUERY = `
[out:json][timeout:30];
(
  node["leisure"="fitness_centre"](26.70,75.60,27.10,76.00);
  way["leisure"="fitness_centre"](26.70,75.60,27.10,76.00);
  node["leisure"="sports_centre"](26.70,75.60,27.10,76.00);
  way["leisure"="sports_centre"](26.70,75.60,27.10,76.00);
  node["amenity"="gym"](26.70,75.60,27.10,76.00);
  way["amenity"="gym"](26.70,75.60,27.10,76.00);
);
out center tags;
`;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

// Curated high quality fitness cover images to attach to real venues
const GYM_COVERS = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=1200&auto=format&fit=crop'
];

async function fetchGymsFromOSM() {
  console.log('📡 Fetching real gym and fitness centers in Jaipur from OpenStreetMap Overpass API...');

  let osmData = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Connecting to: ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: OVERPASS_QUERY }),
        headers: {
          'User-Agent': 'GymConnect-Importer/1.0 (https://github.com/Utkarsht001/GymConnect)'
        }
      });

      if (response.ok) {
        osmData = await response.json();
        console.log(`✅ Successfully received data from: ${endpoint}`);
        break;
      } else {
        console.warn(`Endpoint returned HTTP ${response.status}, trying fallback...`);
      }
    } catch (err) {
      console.warn(`Failed with ${endpoint} (${err.message}), trying next...`);
    }
  }

  if (!osmData || !osmData.elements) {
    throw new Error('Failed to fetch data from all Overpass API mirrors.');
  }

  console.log(`📊 Total raw OSM elements received: ${osmData.elements.length}`);
  return osmData.elements;
}

function buildAddress(tags, fallbackName) {
  const parts = [];
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:suburb']) parts.push(tags['addr:suburb']);
  if (tags['addr:district']) parts.push(tags['addr:district']);
  if (tags['addr:postcode']) parts.push(tags['addr:postcode']);

  if (parts.length > 0) {
    return `${parts.join(', ')}, Jaipur, Rajasthan`;
  }
  return `${fallbackName}, Jaipur, Rajasthan, 302001`;
}

function buildDescription(tags, gymName) {
  const website = tags.website || tags['contact:website'] || tags.url;
  const sport = tags.sport ? ` Specializing in ${tags.sport.replace(/;/g, ', ')}.` : '';
  const websiteText = website ? ` | Official Website: ${website}` : '';
  const opening = tags.opening_hours ? ` Operating hours: ${tags.opening_hours}.` : '';

  return `Premier fitness center located in Jaipur, Rajasthan. Real-world venue verified via OpenStreetMap.${sport}${opening}${websiteText}`;
}

async function importGyms() {
  const rawElements = await fetchGymsFromOSM();

  // 1. Filter elements that have a valid name and coordinate
  const validElements = rawElements.filter(el => {
    const name = el.tags?.name || el.tags?.['name:en'];
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;
    return !!name && !!lat && !!lon;
  });

  console.log(`🔍 Elements with valid gym names & coordinates: ${validElements.length}`);

  // 2. Fetch existing gyms from database to avoid duplicates
  const existingGyms = await prisma.gym.findMany({
    select: { id: true, name: true, latitude: true, longitude: true }
  });
  console.log(`🏢 Existing gyms currently in database: ${existingGyms.length}`);

  // Fetch available facilities to assign
  const availableFacilities = await prisma.facility.findMany();

  // Pre-hash password for gym owners
  const salt = await bcrypt.genSalt(10);
  const ownerHashedPassword = await bcrypt.hash('GymOwner@123', salt);

  const importedList = [];
  const TARGET_MIN = 10;
  const TARGET_MAX = 20;

  for (const el of validElements) {
    if (importedList.length >= TARGET_MAX) break;

    const rawName = (el.tags.name || el.tags['name:en']).trim();
    const lat = parseFloat((el.lat || el.center?.lat).toFixed(6));
    const lon = parseFloat((el.lon || el.center?.lon).toFixed(6));

    // Avoid duplicate: check in-memory list and DB
    const isDuplicate = existingGyms.some(g => 
      g.name.toLowerCase() === rawName.toLowerCase() ||
      (Math.abs(g.latitude - lat) < 0.0008 && Math.abs(g.longitude - lon) < 0.0008)
    ) || importedList.some(g =>
      g.name.toLowerCase() === rawName.toLowerCase() ||
      (Math.abs(g.latitude - lat) < 0.0008 && Math.abs(g.longitude - lon) < 0.0008)
    );

    if (isDuplicate) {
      console.log(`⚠️ Skipping duplicate or overlapping gym: "${rawName}"`);
      continue;
    }

    const cleanSlug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
    const ownerEmail = `owner.${cleanSlug}_${el.id}@jaipurgyms.local`;

    // Create unique Gym Owner account for this Gym
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        password: ownerHashedPassword,
        name: `${rawName} Management`,
        role: 'GYM_OWNER',
        isApproved: true,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanSlug}`
      }
    });

    const phone = el.tags.phone || el.tags['contact:phone'] || el.tags['contact:mobile'] || el.tags.mobile || '+91-141-2550100';
    const email = el.tags.email || el.tags['contact:email'] || `info@${cleanSlug}.in`;
    const openingHours = el.tags.opening_hours || '06:00 AM - 10:00 PM';
    const address = buildAddress(el.tags, rawName);
    const description = buildDescription(el.tags, rawName);
    const coverImage = GYM_COVERS[importedList.length % GYM_COVERS.length];

    // Create Gym entry
    const gym = await prisma.gym.create({
      data: {
        ownerId: owner.id,
        name: rawName,
        description,
        address,
        city: 'Jaipur',
        latitude: lat,
        longitude: lon,
        contactNumber: phone,
        email,
        openingHours,
        coverImage,
        logo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(rawName)}`,
        isApproved: true,
        isSubscriptionPaid: true,
        trialMonths: 6,
        // Add 2 membership plans
        plans: {
          create: [
            {
              name: 'Monthly Standard Fitness',
              price: 1499.0,
              durationDays: 30,
              description: 'Full workout access, cardio zone, and locker facilities.',
              features: 'Cardio Access,Strength Equipment,Locker Room,Free Water'
            },
            {
              name: 'Quarterly Pro Membership',
              price: 3999.0,
              durationDays: 90,
              description: '3 months full gym access including personal trainer consultation.',
              features: 'All Access,Trainer Consultation,Diet Guidance,Sauna'
            }
          ]
        },
        // Link 2-3 standard facilities
        facilities: {
          create: availableFacilities.slice(0, 3).map(fac => ({
            facilityId: fac.id
          }))
        }
      }
    });

    importedList.push(gym);
    console.log(`[${importedList.length}] Added Gym: "${gym.name}" (Lat: ${gym.latitude}, Lon: ${gym.longitude})`);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 Successfully imported ${importedList.length} real gyms in Jaipur, Rajasthan!`);
  console.log(`======================================================\n`);

  // Verify total gyms in database
  const totalGyms = await prisma.gym.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      contactNumber: true,
      latitude: true,
      longitude: true
    }
  });

  console.log(`Current Total Gyms in Database: ${totalGyms.length}`);
  console.table(totalGyms.map(g => ({
    Name: g.name,
    City: g.city,
    Contact: g.contactNumber,
    Coordinates: `${g.latitude}, ${g.longitude}`
  })));
}

importGyms()
  .catch((err) => {
    console.error('❌ Error during OSM gym import:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
