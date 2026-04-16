const { PERFIS } = require('../bootstrap-db');

const PERFIL_NOME_POR_ID = PERFIS.reduce((acc, item) => {
  acc[item.id] = item.nome;
  return acc;
}, {});

function respostaUsuario(usuario) {
  return {
    id: Number(usuario.id),
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    perfilNome: usuario.perfil_nome || PERFIL_NOME_POR_ID[usuario.perfil] || usuario.perfil,
    ativo: Boolean(usuario.ativo),
    origem: usuario.origem,
    criadoEm: usuario.criado_em,
    ultimoLoginEm: usuario.ultimo_login_em
  };
}

function respostaProcesso(processo) {
  return {
    id: Number(processo.id),
    status: processo.status,
    precisaResposta: processo.precisa_resposta,
    dataRecebimento: processo.data_recebimento,
    protocolo: processo.protocolo,
    link: processo.link,
    origem: processo.origem,
    destino: processo.destino,
    prazoDiasUteis: processo.prazo_dias_uteis ?? processo.prazo_em_dias_uteis,
    assunto: processo.assunto,
    observacao: processo.observacao,
    gutGravidade: processo.gut_gravidade,
    gutGravidadePontos: processo.gut_gravidade_pontos,
    gutUrgencia: processo.gut_urgencia,
    gutUrgenciaPontos: processo.gut_urgencia_pontos,
    gutTendencia: processo.gut_tendencia,
    gutTendenciaPontos: processo.gut_tendencia_pontos,
    gutPrioridadeFinal: processo.gut_prioridade_final,
    setorDestinoId: processo.setor_destino_id ? Number(processo.setor_destino_id) : null,
    setorDestinoNome: processo.setor_destino_nome || null,
    setorDestinoSigla: processo.setor_destino_sigla || null,
    distribuidoEm: processo.distribuido_em || null,
    distribuidoPor: processo.distribuido_por || null,
    filaInternaPendente: Boolean(processo.setor_destino_id) && processo.status !== 'Finalizado',
    criadoPor: processo.criado_por,
    atualizadoPor: processo.atualizado_por,
    criadoEm: processo.criado_em,
    atualizadoEm: processo.atualizado_em
  };
}

function respostaSetor(setor) {
  return {
    id: Number(setor.id),
    nome: setor.nome,
    sigla: setor.sigla,
    ativo: Boolean(setor.ativo),
    campusId: setor.campus_id ? Number(setor.campus_id) : null,
    campusNome: setor.campus_nome || null,
    campusSigla: setor.campus_sigla || null,
    criadoEm: setor.criado_em,
    atualizadoEm: setor.atualizado_em
  };
}

function respostaCampus(campus) {
  return {
    id: Number(campus.id),
    nome: campus.nome,
    sigla: campus.sigla,
    ativo: Boolean(campus.ativo),
    criadoEm: campus.criado_em,
    atualizadoEm: campus.atualizado_em
  };
}

module.exports = {
  respostaUsuario,
  respostaProcesso,
  respostaSetor,
  respostaCampus
};
