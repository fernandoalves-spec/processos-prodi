import { ProcessoItem } from '../types/processos';

export async function listarProcessos(): Promise<ProcessoItem[]> {
  const response = await fetch('/api/processos');
  if (!response.ok) {
    throw new Error('Falha ao carregar processos.');
  }
  return response.json();
}

interface AtualizarProcessoInput {
  status: string;
  precisaResposta: string;
  dataRecebimento: string | null;
  protocolo: string;
  link: string | null;
  origem: string | null;
  destino: string | null;
  prazoDiasUteis: number | null;
  assunto: string;
  observacao: string | null;
}

interface AtualizarGutProcessoInput {
  protocolo: string;
  assunto: string;
  gutGravidade: string | null;
  gutUrgencia: string | null;
  gutTendencia: string | null;
}

export async function atualizarProcesso(id: number, payload: AtualizarProcessoInput): Promise<ProcessoItem> {
  const response = await fetch(`/api/processos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.erro || 'Falha ao atualizar processo.');
  }

  return data.processo as ProcessoItem;
}

export async function atualizarGutProcesso(id: number, payload: AtualizarGutProcessoInput): Promise<ProcessoItem> {
  const response = await fetch(`/api/processos/${id}/gut`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.erro || 'Falha ao atualizar matriz GUT.');
  }

  return data.processo as ProcessoItem;
}
