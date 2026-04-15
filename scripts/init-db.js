const pool = require('../src/db');
const { initDatabase } = require('../src/bootstrap-db');

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initComRetry(maxTentativas = 6, esperaBaseMs = 2000) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      await initDatabase();
      return;
    } catch (error) {
      ultimoErro = error;
      const deveRetentar = tentativa < maxTentativas;

      console.error(`Tentativa ${tentativa}/${maxTentativas} falhou: ${error.message}`);

      if (deveRetentar) {
        await esperar(esperaBaseMs * tentativa);
      }
    }
  }

  throw ultimoErro;
}

async function main() {
  try {
    await initComRetry();
    console.log('Banco inicializado com sucesso.');
  } catch (error) {
    console.error('Falha ao inicializar banco:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
