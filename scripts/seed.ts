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
  }
];

const dummyComponents = [
  { name: 'Kabel 1.5mm² (Rot/Schwarz) 10m', type: 'cable', cross_section: 1.5, price: 12.99, brand: 'Auprotec' },
  { name: 'Kabel 2.5mm² (Rot/Schwarz) 10m', type: 'cable', cross_section: 2.5, price: 18.99, brand: 'Auprotec' },
  { name: 'Kabel 6mm² (Rot/Schwarz) 5m', type: 'cable', cross_section: 6, price: 24.99, brand: 'Auprotec' },
  { name: 'Batteriekabel 16mm² 1m', type: 'cable', cross_section: 16, price: 14.50, brand: 'Ebrom' },
  { name: 'Batteriekabel 25mm² 1m', type: 'cable', cross_section: 25, price: 19.50, brand: 'Ebrom' },
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
