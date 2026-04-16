import { CampusItem } from '../types/campi';

interface HttpError extends Error {
  status?: number;
}

interface CampusInput {
  nome: string;
  sigla: string;
  ativo?: boolean;
}

async function parseError(response: Response, fallbackMessage: string): Promise<HttpError> {
  const erro = new Error(fallbackMessage) as HttpError;
  erro.status = response.status;

  try {
    const payload = await response.json();
    if (payload?.erro) erro.message = payload.erro;
  } catch {
    // Mantem fallback.
  }

  return erro;
}

export async function listarCampiAtivos(): Promise<CampusItem[]> {
  const response = await fetch('/api/campi');
  if (!response.ok) throw await parseError(response, 'Falha ao carregar campi ativos.');
  return response.json();
}

export async function listarCampiTodos(): Promise<CampusItem[]> {
  const response = await fetch('/api/campi/todos');
  if (!response.ok) throw await parseError(response, 'Falha ao carregar campi.');
  return response.json();
}

export async function criarCampus(input: CampusInput): Promise<CampusItem> {
  const response = await fetch('/api/campi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw await parseError(response, 'Falha ao cadastrar campus.');
  const payload = await response.json();
  return payload.campus as CampusItem;
}

export async function atualizarCampus(id: number, input: CampusInput): Promise<CampusItem> {
  const response = await fetch(`/api/campi/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw await parseError(response, 'Falha ao atualizar campus.');
  const payload = await response.json();
  return payload.campus as CampusItem;
}

