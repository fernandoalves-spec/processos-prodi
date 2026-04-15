interface PlaceholderPageProps {
  titulo: string;
  descricao: string;
}

export function PlaceholderPage({ titulo, descricao }: PlaceholderPageProps) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>{titulo}</h2>
      </div>
      <p>{descricao}</p>
      <p className="muted">Página preparada para expansão e integração com dados reais.</p>
    </section>
  );
}
