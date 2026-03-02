import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register auth routes first
  registerAuthRoutes(app);

  // Properties API
  app.get(api.properties.list.path, async (req, res) => {
    try {
      const filters = api.properties.list.input?.parse(req.query);
      const props = await storage.getProperties(filters);
      res.status(200).json(props);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.properties.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    
    const prop = await storage.getProperty(id);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    
    res.status(200).json(prop);
  });

  app.post(api.properties.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.properties.create.input.parse(req.body);
      const prop = await storage.createProperty({ ...input, agentId: user.sub });
      res.status(201).json(prop);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put(api.properties.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const prop = await storage.getProperty(id);
      if (!prop) return res.status(404).json({ message: "Property not found" });
      
      const user = req.user.claims;
      if (prop.agentId !== user.sub) {
        return res.status(401).json({ message: "Unauthorized: You can only edit your own properties" });
      }

      const input = api.properties.update.input.parse(req.body);
      const updatedProp = await storage.updateProperty(id, input);
      res.status(200).json(updatedProp);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.properties.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const prop = await storage.getProperty(id);
      if (!prop) return res.status(404).json({ message: "Property not found" });
      
      const user = req.user.claims;
      if (prop.agentId !== user.sub) {
        return res.status(401).json({ message: "Unauthorized: You can only delete your own properties" });
      }

      await storage.deleteProperty(id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Saved Properties API
  app.get(api.savedProperties.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const saved = await storage.getSavedProperties(user.sub);
      res.status(200).json(saved);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.savedProperties.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.savedProperties.create.input.parse(req.body);
      const saved = await storage.saveProperty(user.sub, input.propertyId);
      res.status(201).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.savedProperties.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const propertyId = parseInt(req.params.propertyId);
      if (isNaN(propertyId)) return res.status(400).json({ message: "Invalid ID" });
      
      await storage.removeSavedProperty(user.sub, propertyId);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Saved Searches API
  app.get(api.savedSearches.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const searches = await storage.getSavedSearches(user.sub);
      res.status(200).json(searches);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.savedSearches.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const input = api.savedSearches.create.input.parse(req.body);
      const search = await storage.createSavedSearch(user.sub, input);
      res.status(201).json(search);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.savedSearches.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      await storage.deleteSavedSearch(id, user.sub);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Seed data function to be called on startup
  seedDatabase().catch(console.error);

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProperties();
  if (existing.length === 0) {
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
