exports.handler = async function(event) {
  // Permite apenas requisições POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { AUTH_USERNAME, AUTH_PASSWORD } = process.env;

  // Verifica se as credenciais estão configuradas no ambiente do servidor
  if (!AUTH_USERNAME || !AUTH_PASSWORD) {
    return { statusCode: 500, body: 'Credenciais de autenticação não configuradas no servidor.' };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    // Compara as credenciais recebidas com as do ambiente
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else {
      return { statusCode: 401, body: 'Credenciais inválidas.' };
    }
  } catch (error) {
    return { statusCode: 400, body: 'Corpo da requisição inválido.' };
  }
};
