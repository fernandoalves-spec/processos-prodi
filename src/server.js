const express = require('express');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./bootstrap-db');
const { garantirUsuarioMaster } = require('./middleware/auth');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const processosRouter = require('./routes/processos');
const setoresRouter = require('./routes/setores');
const campiRouter = require('./routes/campi');
const usuariosRouter = require('./routes/usuarios');
const perfisRouter = require('./routes/perfis');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_DIST_DIR = path.join(__dirname, '..', 'dist', 'client');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(CLIENT_DIST_DIR, { index: false }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', sistema: 'processos-prodi' });
});

app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/processos', processosRouter);
app.use('/api/setores', setoresRouter);
app.use('/api/campi', campiRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/perfis', perfisRouter);

app.get(['/', '/dashboard', '/processos', '/setores', '/campi', '/usuarios', '/gut'], (req, res) => {
  res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
});

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initComRetry(maxTentativas = 6, esperaBaseMs = 2000) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      await initDatabase();
      await garantirUsuarioMaster();
      return;
    } catch (error) {
      ultimoErro = error;
      const deveRetentar = tentativa < maxTentativas;
      console.error(`Falha na inicializacao (tentativa ${tentativa}/${maxTentativas}):`, error.message);

      if (deveRetentar) {
        await esperar(esperaBaseMs * tentativa);
      }
    }
  }

  throw ultimoErro;
}

(async () => {
  try {
    await initComRetry();

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error.message);
    process.exit(1);
  }
})();
