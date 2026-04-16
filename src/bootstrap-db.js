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

    await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login_em TIMESTAMPTZ`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS setores (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        sigla TEXT NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`ALTER TABLE setores ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE`);
    await client.query(`ALTER TABLE setores ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await client.query(`ALTER TABLE setores ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

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
        numero_processo TEXT,
        tipo_processo TEXT,
        setor_atual TEXT,
        data_abertura TIMESTAMPTZ,
        data_conclusao TIMESTAMPTZ,
        sla_dias INTEGER,
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

    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Recebido'`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS precisa_resposta TEXT NOT NULL DEFAULT 'Nao'`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS data_recebimento DATE`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS protocolo TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS link TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS origem TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS destino TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS prazo_dias_uteis INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS numero_processo TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS tipo_processo TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS setor_atual TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS data_abertura TIMESTAMPTZ`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS sla_dias INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS assunto TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS observacao TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS criado_por TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS atualizado_por TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS dias_parado INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS data_encaminhamento DATE`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS prazo_em_dias_uteis INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS verificar_com_setor DATE`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS email_setor TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS dias_restantes INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS vencimento_proximo TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS faixa TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS iteracao INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS faixa_2 TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_gravidade TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_gravidade_pontos INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_urgencia TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_urgencia_pontos INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_tendencia TEXT`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_tendencia_pontos INTEGER`);
    await client.query(`ALTER TABLE processos ADD COLUMN IF NOT EXISTS gut_prioridade_final INTEGER`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessoes (
        session_id TEXT PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expira_em TIMESTAMPTZ NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pendencias_criticas (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        quantidade INTEGER,
        severidade TEXT NOT NULL DEFAULT 'media',
        prioridade INTEGER NOT NULL DEFAULT 1,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ck_pendencias_criticas_severidade
          CHECK (severidade IN ('alta', 'media', 'baixa'))
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tarefas_prioritarias (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'nao_iniciada',
        responsavel TEXT,
        prazo DATE,
        prioridade INTEGER NOT NULL DEFAULT 1,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ck_tarefas_prioritarias_status
          CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida'))
      )
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes(expira_em)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_processos_protocolo ON processos(protocolo)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_processos_data_abertura ON processos(data_abertura)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_processos_data_conclusao ON processos(data_conclusao)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pendencias_criticas_ativo_prioridade ON pendencias_criticas(ativo, prioridade)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tarefas_prioritarias_ativo_prioridade ON tarefas_prioritarias(ativo, prioridade)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_setores_sigla_lower ON setores ((LOWER(sigla)))');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_setores_nome_lower ON setores ((LOWER(nome)))');

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

    const qtdPendencias = await client.query('SELECT COUNT(*)::int AS total FROM pendencias_criticas');
    if ((qtdPendencias.rows[0]?.total || 0) === 0) {
      await client.query(
        `
          INSERT INTO pendencias_criticas (titulo, quantidade, severidade, prioridade)
          VALUES
            ('Relatorios pendentes de validacao', 6, 'alta', 1),
            ('Contratos com prazo vencido', 3, 'alta', 2),
            ('Orcamentos em analise sem parecer final', 5, 'media', 3)
        `
      );
    }

    const qtdTarefas = await client.query('SELECT COUNT(*)::int AS total FROM tarefas_prioritarias');
    if ((qtdTarefas.rows[0]?.total || 0) === 0) {
      await client.query(
        `
          INSERT INTO tarefas_prioritarias (titulo, status, responsavel, prazo, prioridade)
          VALUES
            ('Revisao de politicas institucionais', 'em_andamento', 'Gestao PRODI', NULL, 1),
            ('Auditoria interna de fluxos', 'nao_iniciada', 'Comissao Interna', NULL, 2),
            ('Planejamento estrategico consolidado', 'concluida', 'Coordenacao de Planejamento', NULL, 3)
        `
      );
    }

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
