const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL não definida.');
}

const isRailwayInternal = connectionString.includes('railway.internal');

const pool = new Pool({
  connectionString,
  ssl: isRailwayInternal
    ? false
    : { rejectUnauthorized: false }
});

module.exports = pool;