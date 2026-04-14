const pool = require('./db');

const MASTER_EMAIL = 'fernando.alves@ifms.edu.br';

const PERFIS = [
  {
    id: 'ADMIN_MASTER',
    nome: 'Administrador Master',
    descricao: 'Controle total de usuarios, perfis e configuracoes do sistema.'
  },
  {
    id: 'GESTOR_PRODI',
    nome: 'Gestor PRODI',
    descricao: 'Acompanha indicadores, organiza fluxo e supervisiona processos.'
  },
  {
    id: 'ANALISTA_PROCESSOS',
    nome: 'Analista de Processos',
    descricao: 'Registra, atualiza e acompanha a tramitacao de processos.'
  },
  {
    id: 'APOIO_ADMINISTRATIVO',
    nome: 'Apoio Administrativo',
    descricao: 'Apoia cadastros e atualizacoes operacionais dos processos.'
  }
];

async function initDatabase() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS perfis (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        descricao TEXT NOT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        perfil TEXT NOT NULL REFERENCES perfis(id),
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        origem TEXT NOT NULL DEFAULT 'manual',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ultimo_login_em TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processos (
        id SERIAL PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'Recebido',
        precisa_resposta TEXT NOT NULL DEFAULT 'Nao',
        data_recebimento DATE,
        protocolo TEXT NOT NULL,
        link TEXT,
        origem TEXT,
        destino TEXT,
        prazo_dias_uteis INTEGER,
        assunto TEXT NOT NULL,
        observacao TEXT,
        criado_por TEXT,
        atualizado_por TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ,
        dias_parado INTEGER,
        data_encaminhamento DATE,
        prazo_em_dias_uteis INTEGER,
        verificar_com_setor DATE,
        email_setor TEXT,
        dias_restantes INTEGER,
        vencimento_proximo TEXT,
        faixa TEXT,
        iteracao INTEGER,
        faixa_2 TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessoes (
        session_id TEXT PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expira_em TIMESTAMPTZ NOT NULL
      )
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes(expira_em)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_processos_protocolo ON processos(protocolo)');

    for (const perfil of PERFIS) {
      await client.query(
        `
          INSERT INTO perfis (id, nome, descricao)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE
            SET nome = EXCLUDED.nome,
                descricao = EXCLUDED.descricao,
                atualizado_em = NOW()
        `,
        [perfil.id, perfil.nome, perfil.descricao]
      );
    }

    await client.query(
      `
        INSERT INTO usuarios (nome, email, perfil, ativo, origem)
        VALUES ($1, $2, $3, TRUE, 'seed')
        ON CONFLICT (email) DO UPDATE
          SET nome = EXCLUDED.nome,
              perfil = 'ADMIN_MASTER',
              ativo = TRUE,
              atualizado_em = NOW()
      `,
      ['Fernando Alves', MASTER_EMAIL, 'ADMIN_MASTER']
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  MASTER_EMAIL,
  PERFIS,
  initDatabase
};