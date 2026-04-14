const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL nao definida. Configure a variavel de ambiente antes de iniciar.');
}

const isRailwayInternal = connectionString.includes('railway.internal');

const pool = new Pool({
  connectionString,
  ssl: isRailwayInternal
    ? false
    : { rejectUnauthorized: false }
});

module.exports = pool;