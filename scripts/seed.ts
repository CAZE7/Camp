import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import pool from '../lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

const guides = [
  {
    content: "Holzausbau im Camper: Für den Bodenbau empfiehlt sich Siebdruckplatte oder OSB. Achte auf gute Isolierung mit Armaflex (z.B. 19mm) darunter, um Kältebrücken zu vermeiden. Befestige die Platten mit Montagekleber oder verschraube sie mit den Karosseriestreben.",
    metadata: { topic: "holzausbau", type: "guide" }
  },
  {
    content: "Kabelverlegung im Camper: 12V Kabel sollten immer gut abgesichert werden. Die Sicherung sollte maximal 30cm nach der Batterie platziert sein. Verwende für Hauptleitungen mindestens 16mm² bis 25mm², für normale Verbraucher (Licht, Wasserpumpe) reichen oft 1.5mm² oder 2.5mm², je nach Länge der Leitung. Achte auf Scheuerschutz durch Leerrohre.",
    metadata: { topic: "elektrik", type: "guide" }
  },
  {
    content: "Dämmung und Isolierung: Armaflex AF ist der Standard im Camperausbau. Es ist selbstklebend und verhindert Kondenswasserbildung. Für Hohlräume eignet sich Schafwolle oder Stopfhanf, da diese Materialien Feuchtigkeit aufnehmen und wieder abgeben können, ohne an Dämmwirkung zu verlieren.",
    metadata: { topic: "isolierung", type: "guide" }
  },
  {
    content: "Nach DIN VDE 0100-721 muss der Mindestquerschnitt für 12V-Kabel im Wohnmobil 1,5 mm² betragen.",
    metadata: { topic: "elektrik", type: "norm", standard: "VDE 0100-721" }
  },
  {
    content: "Es dürfen im Camper nur feindrähtige Leitungen verwendet werden. Starre NYM-Kabel aus der Hausinstallation sind verboten.",
    metadata: { topic: "elektrik", type: "norm" }
  },
  {
    content: "Für 230V-Landstrom-Anlagen ist zwingend ein RCD (FI-Schutzschalter) mit maximal 30 mA Fehlerstrom vorgeschrieben.",
    metadata: { topic: "elektrik", type: "norm", voltage: "230V" }
  },
  {
    content: "LiFePO4-Batterien (Lithium) können zu 80% bis 100% entladen werden (DoD), während AGM-Batterien nur zu maximal 50% entladen werden sollten, um irreparable Schäden zu vermeiden.",
    metadata: { topic: "batterien", type: "fakt" }
  }
];

const dummyComponents = [
  // Budget Solar & Charge Controllers
  { name: 'Eco-Worthy 120W Monokristallines Solarpanel', type: 'solar', cross_section: null, price: 69.99, brand: 'Eco-Worthy' },
  { name: 'Renogy 100W 12V Monokristallines Solarpanel', type: 'solar', cross_section: null, price: 89.99, brand: 'Renogy' },
  { name: 'Eco-Worthy 20A MPPT Laderegler', type: 'charge_controller', cross_section: null, price: 54.99, brand: 'Eco-Worthy' },
  { name: 'Renogy Rover 20A MPPT Laderegler', type: 'charge_controller', cross_section: null, price: 119.99, brand: 'Renogy' },

  // Premium Inverters & MPPTs
  { name: 'Victron Energy SmartSolar MPPT 75/15', type: 'charge_controller', cross_section: null, price: 145.00, brand: 'Victron Energy' },
  { name: 'Victron Energy SmartSolar MPPT 100/30', type: 'charge_controller', cross_section: null, price: 210.00, brand: 'Victron Energy' },
  { name: 'Victron Phoenix Inverter 12/500 230V', type: 'inverter', cross_section: null, price: 185.00, brand: 'Victron Energy' },
  { name: 'Victron MultiPlus 12/1200/50', type: 'inverter_charger', cross_section: null, price: 650.00, brand: 'Victron Energy' },

  // Standard Cables
  { name: 'Kabel 1.5mm² FLYY feindrähtig 10m', type: 'cable', cross_section: 1.5, price: 10.99, brand: 'Standard' },
  { name: 'Kabel 2.5mm² FLYY feindrähtig 10m', type: 'cable', cross_section: 2.5, price: 15.99, brand: 'Standard' },
  { name: 'Kabel 4mm² FLYY feindrähtig 5m', type: 'cable', cross_section: 4, price: 14.99, brand: 'Standard' },
  { name: 'Kabel 6mm² FLYY feindrähtig 5m', type: 'cable', cross_section: 6, price: 19.99, brand: 'Standard' },
  { name: 'Kabel 10mm² FLYY feindrähtig 5m', type: 'cable', cross_section: 10, price: 29.99, brand: 'Standard' },
  { name: 'Kabel 16mm² Batteriekabel feindrähtig 2m', type: 'cable', cross_section: 16, price: 22.50, brand: 'Standard' },

  // Batteries
  { name: 'AGM Batterie 100Ah', type: 'battery', cross_section: null, price: 149.99, brand: 'Varta' },
  { name: 'LiFePO4 Batterie 100Ah', type: 'battery', cross_section: null, price: 399.00, brand: 'Redodo' },
];

async function seed() {
  console.log("Starting DB seeding...");
  const client = await pool.connect();

  try {
    // 1. Setup Extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 2. Create Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS Knowledge_Chunks (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Components (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        cross_section DECIMAL(5,2),
        price DECIMAL(10,2),
        brand VARCHAR(100)
      );
    `);

    // Clear existing data for a fresh seed
    await client.query('TRUNCATE TABLE Knowledge_Chunks RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE Components RESTART IDENTITY CASCADE');

    console.log("Tables created/truncated.");

    // 3. Generate embeddings and insert into Knowledge_Chunks
    console.log("Generating embeddings...");
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key') {
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: guides.map(g => g.content),
      });

      console.log("Inserting knowledge chunks...");
      for (let i = 0; i < guides.length; i++) {
        const guide = guides[i];
        const embedding = embeddings[i];

        await client.query(
          'INSERT INTO Knowledge_Chunks (content, embedding, metadata) VALUES ($1, $2::vector, $3)',
          [guide.content, `[${embedding.join(',')}]`, guide.metadata]
        );
      }
    } else {
        console.warn("OPENAI_API_KEY is not set. Skipping real embeddings, using mock vectors...");
        for (let i = 0; i < guides.length; i++) {
            const guide = guides[i];
            const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

            await client.query(
              'INSERT INTO Knowledge_Chunks (content, embedding, metadata) VALUES ($1, $2::vector, $3)',
              [guide.content, `[${mockEmbedding.join(',')}]`, guide.metadata]
            );
        }
    }


    // 4. Insert dummy components
    console.log("Inserting components...");
    for (const comp of dummyComponents) {
      await client.query(
        'INSERT INTO Components (name, type, cross_section, price, brand) VALUES ($1, $2, $3, $4, $5)',
        [comp.name, comp.type, comp.cross_section, comp.price, comp.brand]
      );
    }

    console.log("Seeding complete!");

  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    client.release();
    pool.end();
  }
}

seed().catch(console.error);
