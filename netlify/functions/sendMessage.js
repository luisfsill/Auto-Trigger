
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
    let n8nResponseBody;
    try {
      const responseText = await n8nResponse.text();
      console.log('Resposta bruta do n8n:', responseText);
      
      // Tenta parsear como JSON
      if (responseText) {
        n8nResponseBody = JSON.parse(responseText);
      } else {
        n8nResponseBody = {};
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta n8n:', parseError);
      n8nResponseBody = {};
    }

    // Tenta extrair executionId de diferentes estruturas possíveis
    let executionId = n8nResponseBody.executionId 
      || n8nResponseBody.id 
      || n8nResponseBody.execution?.id
      || n8nResponseBody.data?.executionId;

    // Se não encontrou executionId, gera um temporário baseado no timestamp
    if (!executionId) {
      console.warn('Aviso: n8n não retornou um executionId. Gerando ID temporário.');
      executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    console.log('ExecutionId extraído/gerado:', executionId);

    // Retorna o executionId para o cliente
    return {
      statusCode: 202, // 202 Accepted indica que a requisição foi aceita para processamento
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ 
        success: true,
        executionId: executionId,
        message: 'Fluxo iniciado com sucesso'
      }),
    };

  } catch (error) {
    console.error('Erro na função proxy:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ 
        error: 'Erro interno ao processar a requisição.',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};
