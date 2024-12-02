require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkTables() {
  try {
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    
    console.log('Tables in the database:');
    result.rows.forEach(row => {
      console.log(row.table_name);
    });
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkTables();