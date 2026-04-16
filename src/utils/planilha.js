const XLSX = require('xlsx');

function parseLinhasPlanilhaSetores(file) {
  if (!file || !file.buffer) {
    throw new Error('Arquivo da planilha nao informado.');
  }

  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Planilha sem abas para leitura.');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) throw new Error('Planilha sem linhas para importacao.');

  return rows;
}

module.exports = { parseLinhasPlanilhaSetores };
