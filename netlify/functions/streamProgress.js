// Cache em memória para armazenar o progresso de cada execução
// Nota: Em produção, use Redis ou banco de dados
const progressCache = {};

// Função para tratar POST (receber atualizações do n8n)
const handlePost = async (event) => {
  try {
    let body;
    
    // Valida e parseia o corpo
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Body vazio' }),
      };
    }

    try {
      body = typeof event.body === 'string' 
        ? JSON.parse(event.body) 
        : event.body;
    } catch (parseError) {
      console.error('Erro ao parsear body:', parseError);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Body inválido - não é JSON válido' }),
      };
    }

    const { executionId, status, percentage, message, totalContatos } = body;

    if (!executionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing executionId' }),
      };
    }

    // Valida e normaliza percentage
    const validPercentage = Math.min(Math.max(parseInt(percentage) || 0, 0), 100);

    // Armazena o progresso no cache
    progressCache[executionId] = {
      status: status || 'processing',
      percentage: validPercentage,
      message: message || '',
      totalContatos: totalContatos || 0,
      timestamp: new Date().toISOString(),
    };

    console.log(`Progresso armazenado para ${executionId}:`, progressCache[executionId]);

    // Limpa o cache após 30 minutos (progresso completado)
    if (status === 'completed') {
      setTimeout(() => {
        delete progressCache[executionId];
        console.log(`Cache limpo para ${executionId}`);
      }, 30 * 60 * 1000);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Progresso atualizado',
        executionId 
      }),
    };
  } catch (error) {
    console.error('Erro ao processar POST:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        details: 'Erro ao processar atualização de progresso'
      }),
    };
  }
};

// Função para tratar GET (stream de SSE)
const handleGet = async (event) => {
  try {
    const executionId = event.queryStringParameters?.executionId;

    if (!executionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing executionId parameter' }),
      };
    }

    console.log(`Iniciando stream SSE para executionId: ${executionId}`);

    // Verifica se há progresso armazenado
    const initialProgress = progressCache[executionId];
    
    // Cria resposta SSE que será retornada ao cliente
    let response = '';
    let eventId = 0;

    const sendEvent = (data) => {
      return `id: ${eventId++}\ndata: ${JSON.stringify(data)}\n\n`;
    };

    // Envia evento inicial de conexão
    response += sendEvent({
      status: 'connected',
      message: 'Aguardando atualizações...',
      executionId,
      timestamp: new Date().toISOString(),
    });

    // Se há progresso anterior, envia imediatamente
    if (initialProgress) {
      console.log(`Progresso anterior encontrado:`, initialProgress);
      response += sendEvent(initialProgress);
    }

    // Nota: Netlify Functions têm limitações de timeout (~26 segundos)
    // Para streaming real, considere usar WebSockets ou long-polling com múltiplas requisições
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
      body: response,
      isBase64Encoded: false,
    };
  } catch (error) {
    console.error('Erro ao processar GET:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        details: 'Erro ao iniciar stream SSE'
      }),
    };
  }
};

exports.handler = async (event, context) => {
  // Define timeout para Lambda se necessário
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log(`Requisição ${event.httpMethod} recebida:`, {
      path: event.path,
      queryStringParameters: event.queryStringParameters,
    });

    // Roteia para o handler apropriado baseado no método HTTP
    if (event.httpMethod === 'POST') {
      return await handlePost(event);
    } else if (event.httpMethod === 'GET') {
      return await handleGet(event);
    } else if (event.httpMethod === 'OPTIONS') {
      // Suporta CORS preflight
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      };
    } else {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }
  } catch (error) {
    console.error('Erro geral:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
};
