const pool = require('../src/db');
const { initDatabase } = require('../src/bootstrap-db');

async function main() {
  try {
    await initDatabase();
    console.log('Banco inicializado com sucesso.');
  } catch (error) {
    console.error('Falha ao inicializar banco:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();