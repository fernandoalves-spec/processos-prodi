export interface ProcessoItem {
  id: number;
  status: string;
  precisaResposta: string;
  dataRecebimento?: string | null;
  protocolo: string;
  link?: string | null;
  origem?: string | null;
  destino?: string | null;
  prazoDiasUteis?: number | null;
  assunto: string;
  observacao?: string | null;
  gutGravidade?: string | null;
  gutGravidadePontos?: number | null;
  gutUrgencia?: string | null;
  gutUrgenciaPontos?: number | null;
  gutTendencia?: string | null;
  gutTendenciaPontos?: number | null;
  gutPrioridadeFinal?: number | null;
  criadoPor?: string | null;
  atualizadoPor?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}
