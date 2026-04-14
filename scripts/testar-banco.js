const pool = require('../src/db');

async function testar() {
  try {
    const result = await pool.query('SELECT NOW() AS agora');
    console.log('Conexão OK:', result.rows[0]);
  } catch (error) {
    console.error('Erro ao conectar no banco:', error.message);
  } finally {
    await pool.end();
  }
}

testar();