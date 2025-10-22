const { Readable } = require('stream');

exports.handler = async (event, context) => {
  const executionId = event.queryStringParameters.executionId;

  if (!executionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Missing executionId parameter.',
    };
  }

  // Define um stream para enviar dados ao cliente
  const stream = new Readable({
    read() {},
  });

  // Adiciona o cabeçalho Content-Type para Server-Sent Events (SSE)
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  // Envia um evento inicial
  stream.push(`data: ${JSON.stringify({ status: 'connected', message: 'Aguardando atualizações...', executionId })}\n\n`);

  // Implementação temporária: envia atualizações de progresso simuladas
  // Em uma implementação real, você buscará o progresso de um banco de dados/cache
  // ou receberá via webhook do n8n.
  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 100) {
      progress += 10;
      stream.push(`data: ${JSON.stringify({ status: 'processing', percentage: progress, message: `Progresso: ${progress}%` })}\n\n`);
    } else {
      stream.push(`data: ${JSON.stringify({ status: 'completed', message: 'Envio concluído!', percentage: 100 })}\n\n`);
      stream.push('event: end\n'); // Sinaliza o fim para o cliente
      stream.push('data: {}\n\n');
      stream.destroy(); // Fecha o stream
      clearInterval(interval);
    }
  }, 2000);

  // Retorna o stream. O Netlify Functions irá lidar com o envio gradual dos dados.
  return {
    statusCode: 200,
    headers,
    body: stream.read().toString(), // Nota: Isto é uma simplificação. Netlify Functions trata ReadableStream diretamente.
                                   // Na prática, você retornaria o stream de outra forma se a API do Netlify permitisse.
                                   // Para fins de POC e demonstração do streaming via SSE, isso simula a resposta.
  };
};
