function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function validarDataISO(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto;
}

function normalizarInteiro(valor, padrao, minimo, maximo) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return null;
  if (numero < minimo || numero > maximo) return null;
  return numero;
}

function validarOpcaoGut(valor, mapaPontuacao, rotuloCampo) {
  const texto = normalizarTexto(valor);
  if (!texto) return { opcao: null, pontos: null };

  if (!Object.prototype.hasOwnProperty.call(mapaPontuacao, texto)) {
    return {
      erro: `${rotuloCampo} invalida. Valores permitidos: ${Object.keys(mapaPontuacao).join(', ')}.`
    };
  }

  return { opcao: texto, pontos: mapaPontuacao[texto] };
}

function normalizarChaveImportacao(texto) {
  return String(texto || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

module.exports = {
  normalizarEmail,
  normalizarTexto,
  validarDataISO,
  normalizarInteiro,
  validarOpcaoGut,
  normalizarChaveImportacao
};
