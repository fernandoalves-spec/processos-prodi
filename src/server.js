const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const processos = [];

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'processos-prodi'
  });
});

app.get('/api/processos', (req, res) => {
  res.json(processos);
});

app.post('/api/processos', (req, res) => {
  const {
    status,
    precisaResposta,
    dataRecebimento,
    protocolo,
    link,
    origem,
    destino,
    prazoDiasUteis,
    assunto,
    observacao
  } = req.body;

  if (!protocolo || !assunto) {
    return res.status(400).json({
      erro: 'Os campos protocolo e assunto são obrigatórios.'
    });
  }

  const novoProcesso = {
    id: Date.now(),
    status: status || 'Recebido',
    precisaResposta: precisaResposta || 'Não',
    dataRecebimento: dataRecebimento || '',
    protocolo: protocolo || '',
    link: link || '',
    origem: origem || '',
    destino: destino || '',
    prazoDiasUteis: prazoDiasUteis || '',
    assunto: assunto || '',
    observacao: observacao || '',
    criadoEm: new Date().toISOString()
  };

  processos.push(novoProcesso);

  res.status(201).json({
    mensagem: 'Processo cadastrado com sucesso.',
    processo: novoProcesso
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});