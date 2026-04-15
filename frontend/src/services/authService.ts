export interface SessaoUsuario {
  autenticado: boolean;
  usuario: {
    nome: string;
    perfilNome: string;
  } | null;
}

export async function getSessaoUsuario(): Promise<SessaoUsuario> {
  const resposta = await fetch('/api/auth/me');
  if (!resposta.ok) {
    return { autenticado: false, usuario: null };
  }
  return resposta.json();
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
