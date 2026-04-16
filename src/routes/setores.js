const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { exigirAutenticacao, exigirMaster } = require('../middleware/auth');
const { normalizarTexto, normalizarChaveImportacao } = require('../utils/validators');
const { respostaSetor } = require('../utils/formatters');
const { parseLinhasPlanilhaSetores } = require('../utils/planilha');

const router = express.Router();
const uploadMemoria = multer({ storage: multer.memoryStorage() });

const SELECT_SETOR_COMPLETO = `
  s.id,
  s.nome,
  s.sigla,
  s.ativo,
  s.campus_id,
  c.nome AS campus_nome,
  c.sigla AS campus_sigla,
  s.criado_em,
  s.atualizado_em
`;

router.get('/', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT ${SELECT_SETOR_COMPLETO}
        FROM setores s
        LEFT JOIN campi c ON c.id = s.campus_id
        WHERE s.ativo = TRUE
        ORDER BY s.nome
      `
    );

    res.json(resultado.rows.map(respostaSetor));
  } catch (error) {
    console.error('Erro ao listar setores ativos:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar setores.' });
  }
});

router.get('/todos', exigirAutenticacao, exigirMaster, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT ${SELECT_SETOR_COMPLETO}
        FROM setores s
        LEFT JOIN campi c ON c.id = s.campus_id
        ORDER BY s.nome
      `
    );

    res.json(resultado.rows.map(respostaSetor));
  } catch (error) {
    console.error('Erro ao listar todos os setores:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar setores.' });
  }
});

router.post('/', exigirAutenticacao, exigirMaster, async (req, res) => {
  const nome = normalizarTexto(req.body.nome);
  const sigla = normalizarTexto(req.body.sigla).toUpperCase();
  const campusId = Number(req.body.campusId);

  if (!nome || !sigla || !Number.isInteger(campusId) || campusId <= 0) {
    return res.status(400).json({ erro: 'Informe nome, sigla e campus para cadastrar o setor.' });
  }

  try {
    const campus = await pool.query('SELECT id, ativo FROM campi WHERE id = $1', [campusId]);
    if (!campus.rowCount) {
      return res.status(404).json({ erro: 'Campus nao encontrado.' });
    }
    if (!campus.rows[0].ativo) {
      return res.status(400).json({ erro: 'Nao e possivel vincular setor a campus inativo.' });
    }

    const inserido = await pool.query(
      `
        INSERT INTO setores (nome, sigla, ativo, campus_id, atualizado_em)
        VALUES ($1, $2, TRUE, $3, NOW())
        RETURNING id
      `,
      [nome, sigla, campusId]
    );

    const detalhado = await pool.query(
      `SELECT ${SELECT_SETOR_COMPLETO} FROM setores s LEFT JOIN campi c ON c.id = s.campus_id WHERE s.id = $1`,
      [inserido.rows[0].id]
    );

    res.status(201).json({
      mensagem: 'Setor cadastrado com sucesso.',
      setor: respostaSetor(detalhado.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe setor com este nome ou sigla.' });
    }

    console.error('Erro ao cadastrar setor:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar setor.' });
  }
});

router.put('/:id', exigirAutenticacao, exigirMaster, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de setor invalido.' });
  }

  try {
    const atual = await pool.query(
      'SELECT id, nome, sigla, ativo, campus_id FROM setores WHERE id = $1',
      [id]
    );

    if (!atual.rowCount) {
      return res.status(404).json({ erro: 'Setor nao encontrado.' });
    }

    const setor = atual.rows[0];
    const nome = req.body.nome !== undefined ? normalizarTexto(req.body.nome) : setor.nome;
    const sigla = req.body.sigla !== undefined ? normalizarTexto(req.body.sigla).toUpperCase() : setor.sigla;
    const ativo = req.body.ativo !== undefined ? Boolean(req.body.ativo) : Boolean(setor.ativo);
    const campusId =
      req.body.campusId !== undefined && req.body.campusId !== null && req.body.campusId !== ''
        ? Number(req.body.campusId)
        : setor.campus_id;

    if (!nome || !sigla || !Number.isInteger(campusId) || campusId <= 0) {
      return res.status(400).json({ erro: 'Nome, sigla e campus do setor sao obrigatorios.' });
    }

    const campus = await pool.query('SELECT id, ativo FROM campi WHERE id = $1', [campusId]);
    if (!campus.rowCount) {
      return res.status(404).json({ erro: 'Campus nao encontrado.' });
    }
    if (!campus.rows[0].ativo) {
      return res.status(400).json({ erro: 'Nao e possivel vincular setor a campus inativo.' });
    }

    const atualizado = await pool.query(
      `
        UPDATE setores
        SET nome = $1, sigla = $2, ativo = $3, campus_id = $4, atualizado_em = NOW()
        WHERE id = $5
        RETURNING id
      `,
      [nome, sigla, ativo, campusId, id]
    );

    const detalhado = await pool.query(
      `SELECT ${SELECT_SETOR_COMPLETO} FROM setores s LEFT JOIN campi c ON c.id = s.campus_id WHERE s.id = $1`,
      [atualizado.rows[0].id]
    );

    res.json({
      mensagem: 'Setor atualizado com sucesso.',
      setor: respostaSetor(detalhado.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe setor com este nome ou sigla.' });
    }

    console.error('Erro ao atualizar setor:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar setor.' });
  }
});

router.post('/importar', exigirAutenticacao, exigirMaster, async (req, res) => {
  const lista = Array.isArray(req.body.setores) ? req.body.setores : [];

  if (!lista.length) {
    return res.status(400).json({ erro: 'Informe uma lista de setores para importar.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const item of lista) {
      const nome = normalizarTexto(item.nome);
      const sigla = normalizarTexto(item.sigla).toUpperCase();

      if (!nome || !sigla) {
        ignorados += 1;
        continue;
      }

      const resultado = await client.query(
        `
          INSERT INTO setores (nome, sigla, ativo, atualizado_em)
          VALUES ($1, $2, TRUE, NOW())
          ON CONFLICT ((LOWER(sigla))) DO UPDATE
            SET nome = EXCLUDED.nome,
                sigla = EXCLUDED.sigla,
                ativo = TRUE,
                atualizado_em = NOW()
          RETURNING (xmax = 0) AS inserido
        `,
        [nome, sigla]
      );

      if (resultado.rows[0].inserido) {
        inseridos += 1;
      } else {
        atualizados += 1;
      }
    }

    await client.query('COMMIT');

    res.json({
      mensagem: 'Importacao de setores concluida.',
      resumo: { inseridos, atualizados, ignorados }
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Conflito de nome ou sigla ao importar setores.' });
    }

    console.error('Erro ao importar setores:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao importar setores.' });
  } finally {
    client.release();
  }
});

router.post(
  '/importar-planilha',
  exigirAutenticacao,
  exigirMaster,
  uploadMemoria.single('arquivo'),
  async (req, res) => {
    let linhas;
    try {
      linhas = parseLinhasPlanilhaSetores(req.file);
    } catch (error) {
      return res.status(400).json({ erro: error.message || 'Falha ao ler planilha enviada.' });
    }

    const required = {
      setorNome: ['setor nome'],
      setorSigla: ['setor sigla'],
      campusNome: ['campus'],
      campusSigla: ['campus sigla']
    };

    const chavesOriginais = Object.keys(linhas[0] || {});
    const mapaCabecalho = {};
    for (const chave of chavesOriginais) {
      mapaCabecalho[normalizarChaveImportacao(chave)] = chave;
    }

    const faltantes = Object.entries(required)
      .filter(([, aliases]) => !aliases.some((alias) => Object.prototype.hasOwnProperty.call(mapaCabecalho, alias)))
      .map(([key]) => key);

    if (faltantes.length) {
      return res.status(400).json({
        erro: `Cabecalhos obrigatorios ausentes na planilha: ${faltantes.join(', ')}.`
      });
    }

    const keySetorNome = mapaCabecalho['setor nome'];
    const keySetorSigla = mapaCabecalho['setor sigla'];
    const keyCampusNome = mapaCabecalho['campus'];
    const keyCampusSigla = mapaCabecalho['campus sigla'];

    const dados = linhas.map((row, index) => ({
      linha: index + 2,
      setorNome: normalizarTexto(row[keySetorNome]),
      setorSigla: normalizarTexto(row[keySetorSigla]).toUpperCase(),
      campusNome: normalizarTexto(row[keyCampusNome]),
      campusSigla: normalizarTexto(row[keyCampusSigla]).toUpperCase()
    }));

    const client = await pool.connect();
    try {
      const campi = await client.query('SELECT id, nome, sigla, ativo FROM campi');
      const mapCampusSigla = new Map(campi.rows.map((c) => [normalizarTexto(c.sigla).toUpperCase(), c]));
      const mapCampusNome = new Map(campi.rows.map((c) => [normalizarTexto(c.nome).toLowerCase(), c]));

      const inconsistencias = [];
      const preparados = [];

      for (const item of dados) {
        if (!item.setorNome || !item.setorSigla || !item.campusNome || !item.campusSigla) {
          inconsistencias.push({
            linha: item.linha,
            erro: 'Campos obrigatorios vazios (Setor Nome, Setor Sigla, Campus, Campus Sigla).'
          });
          continue;
        }

        const campusPorSigla = mapCampusSigla.get(item.campusSigla);
        const campusPorNome = mapCampusNome.get(item.campusNome.toLowerCase());

        if (!campusPorSigla && !campusPorNome) {
          inconsistencias.push({
            linha: item.linha,
            erro: `Campus nao cadastrado: ${item.campusSigla} / ${item.campusNome}.`
          });
          continue;
        }

        if (campusPorSigla && campusPorNome && campusPorSigla.id !== campusPorNome.id) {
          inconsistencias.push({
            linha: item.linha,
            erro: `Campus Sigla e Campus Nome divergem (${item.campusSigla} x ${item.campusNome}).`
          });
          continue;
        }

        const campus = campusPorSigla || campusPorNome;
        if (!campus.ativo) {
          inconsistencias.push({
            linha: item.linha,
            erro: `Campus inativo (${campus.sigla} - ${campus.nome}).`
          });
          continue;
        }

        preparados.push({ nome: item.setorNome, sigla: item.setorSigla, campusId: campus.id });
      }

      if (inconsistencias.length) {
        return res.status(400).json({
          erro: 'Falha na validacao da planilha. Corrija as linhas informadas e tente novamente.',
          inconsistencias
        });
      }

      await client.query('BEGIN');
      let inseridos = 0;
      let atualizados = 0;

      for (const item of preparados) {
        const resultado = await client.query(
          `
            INSERT INTO setores (nome, sigla, ativo, campus_id, atualizado_em)
            VALUES ($1, $2, TRUE, $3, NOW())
            ON CONFLICT ((LOWER(sigla))) DO UPDATE
              SET nome = EXCLUDED.nome,
                  sigla = EXCLUDED.sigla,
                  campus_id = EXCLUDED.campus_id,
                  ativo = TRUE,
                  atualizado_em = NOW()
            RETURNING (xmax = 0) AS inserido
          `,
          [item.nome, item.sigla, item.campusId]
        );

        if (resultado.rows[0].inserido) inseridos += 1;
        else atualizados += 1;
      }

      await client.query('COMMIT');
      return res.json({
        mensagem: 'Importacao de planilha de setores concluida com sucesso.',
        resumo: { totalLinhas: preparados.length, inseridos, atualizados }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao importar planilha de setores:', error.message);
      return res.status(500).json({ erro: 'Erro interno ao importar planilha de setores.' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
