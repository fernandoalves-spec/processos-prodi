import { ProcessoItem } from '../types/processos';

export async function listarProcessos(): Promise<ProcessoItem[]> {
  const response = await fetch('/api/processos');
  if (!response.ok) {
    throw new Error('Falha ao carregar processos.');
  }
  return response.json();
}
