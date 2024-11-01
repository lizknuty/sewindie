require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function createTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS designer (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(255),
        logo_url VARCHAR(255),
        email VARCHAR(255),
        address TEXT,
        facebook VARCHAR(255),
        instagram VARCHAR(255),
        pinterest VARCHAR(255),
        youtube VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS pattern (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        designer_id INTEGER REFERENCES designer(id),
        url VARCHAR(255),
        thumbnail_url VARCHAR(255),
        yardage FLOAT,
        sizes VARCHAR(255),
        language VARCHAR(50),
        audience VARCHAR(50),
        fabric_type VARCHAR(255)
      );
    `;
    console.log('Tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createTables();