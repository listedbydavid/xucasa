import { storage } from "../storage";

export async function seedDatabase() {
  const existingCount = await storage.getPropertiesCount();

  // Backfill address fields for seed properties that have null addresses
  const addressMap: Record<number, { addressStreetNumber: string; addressStreetName: string; addressCity: string; addressState: string; addressZip: string }> = {
    1: { addressStreetNumber: "123", addressStreetName: "Market St", addressCity: "San Francisco", addressState: "CA", addressZip: "94103" },
    2: { addressStreetNumber: "456", addressStreetName: "Oak Ave", addressCity: "San Mateo", addressState: "CA", addressZip: "94401" },
    3: { addressStreetNumber: "789", addressStreetName: "Mission St", addressCity: "San Francisco", addressState: "CA", addressZip: "94103" },
    4: { addressStreetNumber: "101", addressStreetName: "University Ave", addressCity: "Palo Alto", addressState: "CA", addressZip: "94301" },
  };
  for (const [idStr, addr] of Object.entries(addressMap)) {
    const prop = await storage.getProperty(Number(idStr));
    if (prop && !prop.addressCity) {
      await storage.updateProperty(prop.id, addr);
    }
  }

  if (existingCount === 0) {
    await storage.createProperty({
      title: "Beautiful Modern Home",
      description: "A stunning modern home in the heart of the city with open concept living.",
      price: 1250000,
      addressStreetNumber: "123",
      addressStreetName: "Market St",
      addressCity: "San Francisco",
      addressState: "CA",
      addressZip: "94103",
      location: "San Francisco, CA",
      beds: 3,
      baths: "2.5",
      sqft: 2100,
      lotSize: 4500,
      hoaFee: 0,
      isOffMarket: false,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
      photos: [
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=800",
      ],
    });

    await storage.createProperty({
      title: "Cozy Suburb Craftsman",
      description: "Charming craftsman style home with a large backyard and recent updates.",
      price: 850000,
      addressStreetNumber: "456",
      addressStreetName: "Oak Ave",
      addressCity: "San Mateo",
      addressState: "CA",
      addressZip: "94401",
      location: "San Mateo, CA",
      beds: 4,
      baths: "2.0",
      sqft: 1800,
      lotSize: 6000,
      hoaFee: 0,
      isOffMarket: false,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
    });

    await storage.createProperty({
      title: "Downtown Luxury Condo",
      description: "High-rise luxury condo with panoramic city views and top-tier amenities.",
      price: 950000,
      addressStreetNumber: "789",
      addressStreetName: "Mission St",
      addressUnitNumber: "1201",
      addressCity: "San Francisco",
      addressState: "CA",
      addressZip: "94103",
      location: "San Francisco, CA",
      beds: 2,
      baths: "2.0",
      sqft: 1200,
      lotSize: 0,
      hoaFee: 850,
      isOffMarket: false,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
    });

    await storage.createProperty({
      title: "Exclusive Off-Market Estate",
      description: "Make me move! This incredible estate is available for the right price.",
      price: 3500000,
      addressStreetNumber: "101",
      addressStreetName: "University Ave",
      addressCity: "Palo Alto",
      addressState: "CA",
      addressZip: "94301",
      location: "Palo Alto, CA",
      beds: 5,
      baths: "4.5",
      sqft: 4500,
      lotSize: 12000,
      hoaFee: 0,
      isOffMarket: true,
      status: "active",
      imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=800",
    });
  }
}
