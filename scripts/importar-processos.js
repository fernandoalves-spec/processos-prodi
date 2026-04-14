const pool = require('../src/db');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQnnvro-sOwrEbCrAhVY6zy5q__X9nr5CSXvmTk9Hja-nJ4oFFI9EBUf383aWBCwEe72gP0k6UWPxTR/pub?gid=0&single=true&output=csv';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim();
    });
    return row;
  });
}

function parseDateBR(value) {
  if (!value) return null;
  const v = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;

  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function importar() {
  const client = await pool.connect();

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`Falha ao baixar CSV: ${response.status}`);

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    console.log(`Linhas encontradas: ${rows.length}`);

    await client.query('BEGIN');

    for (const row of rows) {
      const status = row['Status'] || null;
      const precisaResposta = row['Precisa de Resposta?'] || null;
      const dataRecebimento = parseDateBR(row['Data recebimento']);
      const protocolo = row['Protocolo'] || null;
      const link = row['Link'] || null;
      const origem = row['Origem'] || null;
      const assunto = row['Assunto'] || null;
      const observacao = row['Observação'] || row['Observacao'] || null;
      const destino = row['Destino'] || null;
      const diasParado = parseInteger(row['Dias parado']);
      const dataEncaminhamento = parseDateBR(row['Data do encaminhamento']);
      const prazoEmDiasUteis = parseInteger(row['Prazo em dias úteis']);
      const verificarComSetor = parseDateBR(row['Verificar com setor']);
      const emailSetor = row['e-mail do setor'] || row['Email do setor'] || null;
      const diasRestantes = parseInteger(row['Dias restantes']);
      const vencimentoProximo = row['Vencimento Próximo'] || row['Vencimento Proximo'] || null;
      const faixa = row['Faixa'] || null;
      const iteracao = parseInteger(row['Iteração'] || row['Iteracao']);
      const faixa2 = row['Faixa 2'] || null;

      await client.query(
        `
        INSERT INTO processos (
          status,
          precisa_resposta,
          data_recebimento,
          protocolo,
          link,
          origem,
          assunto,
          observacao,
          destino,
          dias_parado,
          data_encaminhamento,
          prazo_em_dias_uteis,
          verificar_com_setor,
          email_setor,
          dias_restantes,
          vencimento_proximo,
          faixa,
          iteracao,
          faixa_2
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19
        )
        `,
        [
          status,
          precisaResposta,
          dataRecebimento,
          protocolo,
          link,
          origem,
          assunto,
          observacao,
          destino,
          diasParado,
          dataEncaminhamento,
          prazoEmDiasUteis,
          verificarComSetor,
          emailSetor,
          diasRestantes,
          vencimentoProximo,
          faixa,
          iteracao,
          faixa2
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Importação concluída com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na importação:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

importar();