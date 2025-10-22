// Cache em memória para armazenar o progresso de cada execução
// Nota: Em produção, use Redis ou banco de dados
const progressCache = {};

// Função para tratar POST (receber atualizações do n8n)
const handlePost = async (event) => {
  try {
    const body = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event.body;

    const { executionId, status, percentage, message, totalContatos } = body;

    if (!executionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing executionId' }),
      };
    }

    // Armazena o progresso no cache
    progressCache[executionId] = {
      status,
      percentage: Math.min(Math.max(percentage, 0), 100), // Garante que está entre 0-100
      message,
      totalContatos,
      timestamp: new Date().toISOString(),
    };

    // Limpa o cache após 30 minutos (progresso completado)
    if (status === 'completed') {
      setTimeout(() => {
        delete progressCache[executionId];
      }, 30 * 60 * 1000);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Progresso atualizado',
        executionId 
      }),
    };
  } catch (error) {
    console.error('Erro ao processar POST:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Função para tratar GET (stream de SSE)
const handleGet = async (event) => {
  const executionId = event.queryStringParameters?.executionId;

  if (!executionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing executionId parameter' }),
    };
  }

  // Obtém o contexto de entrega para manter a conexão aberta
  const isBase64Encoded = false;
  let eventId = 0;

  // Função para enviar eventos SSE
  const sendEvent = (data) => {
    return `id: ${eventId++}\ndata: ${JSON.stringify(data)}\n\n`;
  };

  // Cria uma resposta com streaming
  let response = '';

  // Envia evento inicial de conexão
  response += sendEvent({
    status: 'connected',
    message: 'Aguardando atualizações...',
    executionId,
    timestamp: new Date().toISOString(),
  });

  // Recupera progresso armazenado se existir
  if (progressCache[executionId]) {
    response += sendEvent(progressCache[executionId]);
  }

  // Implementação de polling: simula long-polling para manter a conexão
  // Na prática, use WebSockets ou tecnologias mais avançadas
  let pollCount = 0;
  const maxPolls = 300; // ~5 minutos com 1s de intervalo

  const pollInterval = setInterval(() => {
    pollCount++;

    // Verifica se há progresso atualizado
    const progressData = progressCache[executionId];
    if (progressData) {
      response += sendEvent(progressData);

      // Se completado, fecha a conexão
      if (progressData.status === 'completed') {
        clearInterval(pollInterval);
        response += 'event: complete\ndata: {}\n\n';
      }
    } else if (pollCount >= maxPolls) {
      // Timeout: fecha por segurança
      clearInterval(pollInterval);
      response += sendEvent({
        status: 'timeout',
        message: 'Conexão expirada após 5 minutos',
        percentage: 0,
      });
    }
  }, 1000);

  // Retorna streaming SSE
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
    body: response,
    isBase64Encoded,
  };
};

exports.handler = async (event, context) => {
  // Define timeout para Lambda se necessário
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Roteia para o handler apropriado baseado no método HTTP
    if (event.httpMethod === 'POST') {
      return await handlePost(event);
    } else if (event.httpMethod === 'GET') {
      return await handleGet(event);
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }
  } catch (error) {
    console.error('Erro geral:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }),
    };
  }
};
