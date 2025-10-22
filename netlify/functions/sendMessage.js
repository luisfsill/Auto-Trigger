
const fetch = require('node-fetch');

exports.handler = async function(event) {
  // Garante que a requisição seja um POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Method Not Allowed' };
  }

      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  
      // Verifica se a variável de ambiente está configurada
      if (!n8nWebhookUrl) {
        return { statusCode: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Erro de configuração: A URL do webhook (N8N_WEBHOOK_URL) não foi definida.' };
      }  
  try {
    const { AUTH_USERNAME, AUTH_PASSWORD } = process.env;

    // Verifica se as credenciais de autenticação estão configuradas no servidor
    if (!AUTH_USERNAME || !AUTH_PASSWORD) {
      return { statusCode: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Credenciais de autenticação não configuradas no servidor.' };
    }

    // Extrai os dados e as credenciais do corpo da requisição
    const payload = JSON.parse(event.body);
    console.log('Payload recebido:', { ...payload, auth: '[REDACTED]' });
    const { auth, message, group, hasImage, image } = payload;

    // Valida se o grupo foi fornecido
    if (!group || typeof group !== 'string' || group.trim() === '') {
      console.error('Erro: grupo inválido no payload:', group);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: 'O grupo é obrigatório e deve ser um texto válido'
      };
    }

    // Verifica se o grupo está no formato esperado (Grupo X)
    if (!/^Grupo \d+$/.test(group.trim())) {
      console.error('Erro: formato do grupo inválido:', group);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: 'Formato do grupo inválido. Deve ser "Grupo X" onde X é um número.'
      };
    }

    // Valida as credenciais recebidas
    if (!auth || auth.username !== AUTH_USERNAME || auth.password !== AUTH_PASSWORD) {
      return { statusCode: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Autenticação falhou.' };
    }

    // Prepara o payload para o webhook da n8n (sem as credenciais)
    // Garante que o grupo seja enviado exatamente como está no arquivo grupos.json
    const n8nPayload = { 
      message, 
      group: group.trim(), // Remove espaços extras
      sheetName: group.trim(), // Adiciona explicitamente o nome da aba
      hasImage, 
      image, 
      timestamp: new Date().toISOString() 
    };
    console.log('Payload enviado para n8n:', { ...n8nPayload, image: '[REDACTED]' });

    // Faz a requisição para o webhook da n8n e espera pela resposta
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      const n8nErrorText = await n8nResponse.text();
      console.error('Erro ao chamar webhook n8n:', n8nResponse.status, n8nErrorText);
      return {
        statusCode: n8nResponse.status || 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ message: `Erro ao iniciar fluxo no n8n: ${n8nErrorText}` }),
      };
    }

    // Extrai o corpo da resposta do n8n para obter o executionId
    const n8nResponseBody = await n8nResponse.json();
    const executionId = n8nResponseBody.executionId; // Ajuste este caminho se o n8n retornar uma estrutura diferente

    if (!executionId) {
      console.error('Erro: n8n não retornou um executionId.', n8nResponseBody);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ message: 'Falha ao obter o ID de execução do n8n.' }),
      };
    }

    // Retorna o executionId para o cliente
    return {
      statusCode: 202, // 202 Accepted indica que a requisição foi aceita para processamento
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ executionId: executionId }),
    };

  } catch (error) {
    console.error('Erro na função proxy:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Erro interno ao processar a requisição.',
    };
  }
};
