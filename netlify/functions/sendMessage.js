
const fetch = require('node-fetch');

exports.handler = async function(event) {
  // Garante que a requisição seja um POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  
      // Verifica se a variável de ambiente está configurada
      if (!n8nWebhookUrl) {
        return { statusCode: 500, body: 'Erro de configuração: A URL do webhook (N8N_WEBHOOK_URL) não foi definida.' };
      }  
  try {
    const { AUTH_USERNAME, AUTH_PASSWORD } = process.env;

    // Verifica se as credenciais de autenticação estão configuradas no servidor
    if (!AUTH_USERNAME || !AUTH_PASSWORD) {
      return { statusCode: 500, body: 'Credenciais de autenticação não configuradas no servidor.' };
    }

    // Extrai os dados e as credenciais do corpo da requisição
    const payload = JSON.parse(event.body);
    const { auth, message, group, hasImage, image } = payload;

    // Valida as credenciais recebidas
    if (!auth || auth.username !== AUTH_USERNAME || auth.password !== AUTH_PASSWORD) {
      return { statusCode: 401, body: 'Autenticação falhou.' };
    }

    // Prepara o payload para o webhook da n8n (sem as credenciais)
    const n8nPayload = { message, group, hasImage, image };

    // Faz a requisição para o webhook da n8n
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });

    const responseData = await response.text();

    // Retorna a mesma resposta (sucesso ou erro) que a n8n deu
    return {
      statusCode: response.status,
      body: responseData,
    };

  } catch (error) {
    console.error('Erro na função proxy:', error);
    return {
      statusCode: 500,
      body: 'Erro interno ao processar a requisição.',
    };
  }
};
