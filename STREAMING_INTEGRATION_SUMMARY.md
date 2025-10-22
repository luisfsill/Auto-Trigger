# 🚀 Integração de Streaming de Progresso - Auto Trigger

## Visão Geral

A implementação integra **Server-Sent Events (SSE)** para monitoramento em tempo real do progresso de envios de mensagens via WhatsApp. O sistema agora permite que o usuário acompanhe o andamento do disparo com uma barra de progresso animada.

---

## 📋 Arquitetura da Solução

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (HTML/JS)                      │
│  - Captura grupo e mensagem                                     │
│  - Abre EventSource para SSE                                    │
│  - Atualiza progresso em tempo real                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
          POST /sendMessage (JSON)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│          NETLIFY FUNCTION: sendMessage.js                       │
│  - Valida grupo (formato "Grupo X")                             │
│  - Inicia workflow n8n                                          │
│  - Retorna executionId (202 Accepted)                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
          Webhook POST /auto-trigger
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              N8N WORKFLOW: Auto Trigger                         │
│  - Processa dados do webhook                                    │
│  - Busca contatos no Google Sheets                              │
│  - HTTP POST → Enviar Progresso Início (0%)                     │
│  - Itera em lotes (batchSize=1)                                 │
│  - HTTP POST → Enviar Progresso do Lote (% atual)              │
│  - Reescreve mensagem com Gemini AI                             │
│  - Envia via Evolution API (WhatsApp)                           │
│  - Atualiza status no Google Sheets                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
  HTTP POST /streamProgress (executionId, status, percentage, ...)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│       NETLIFY FUNCTION: streamProgress.js                       │
│  - Recebe POST do n8n com dados de progresso                    │
│  - Armazena em cache em memória                                 │
│  - Mantém conexão SSE aberta                                    │
│  - Envia atualizações ao cliente via polling                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
  GET /?executionId=xxx (EventSource)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND: Barra de Progresso                 │
│  - Recebe eventos SSE                                           │
│  - Atualiza percentage (0-100%)                                 │
│  - Exibe mensagem de status                                     │
│  - Fecha conexão ao completar                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Implementados

### 1. **Frontend: `script.js`**

#### Nova Função: `showProgressBar()`
```javascript
function showProgressBar() {
  progressContainer.style.display = 'flex';
  progressBar.style.width = '0%';
  progressText.textContent = 'Iniciando...';
}
```

#### Nova Função: `hideProgressBar()`
```javascript
function hideProgressBar() {
  progressContainer.style.display = 'none';
}
```

#### Nova Função: `streamProgress(executionId, sendButton)`
- Abre conexão EventSource com o servidor
- Recebe eventos SSE em tempo real
- Atualiza barra de progresso
- Mantém botão desativado durante processamento
- Fecha conexão ao completar

#### Modificação: `sendMessage()`
- Captura `executionId` da resposta
- Chama `streamProgress()` com o ID
- Mantém mensagem no campo após envio
- Desativa botão durante transmissão

### 2. **Frontend: `Index.html`**

Novo elemento de progresso:
```html
<div id="progressContainer" class="progress-container">
  <div class="progress">
    <div id="progressBar" class="progress-bar"></div>
  </div>
  <div id="progressText" class="progress-text">Iniciando...</div>
</div>
```

Estilos CSS:
```css
.progress-container {
  display: none;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.progress {
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  width: 0%;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6c757d;
  text-align: center;
}
```

### 3. **Backend: `netlify/functions/sendMessage.js`**

Alterações:
- ✅ Validação de grupo: `/^Grupo \d+$/`
- ✅ Resposta em JSON com `executionId`
- ✅ Status 202 Accepted (processamento assíncrono)
- ✅ Console logging para debugging

```javascript
// Resposta
return {
  statusCode: 202,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    success: true,
    message: 'Fluxo iniciado',
    executionId: data.id, // n8n execution ID
  }),
};
```

### 4. **Backend: `netlify/functions/streamProgress.js`** (NOVO)

#### Suporta dois métodos HTTP:

**POST** - Recebe atualizações do n8n
```javascript
POST /streamProgress
Body: {
  executionId: "abc-def-123",
  status: "processing",
  percentage: 45,
  message: "Processado: 45 de 100 contatos",
  totalContatos: 100
}
```

**GET** - Abre stream SSE para o cliente
```javascript
GET /?executionId=abc-def-123
Response: text/event-stream
```

#### Funcionalidades:
- ✅ Cache em memória para armazenar progresso
- ✅ Long-polling com intervalo de 1s
- ✅ Timeout de 5 minutos para segurança
- ✅ Limpeza automática do cache após conclusão
- ✅ Suporte a CORS

---

## 📝 N8N Workflow Integration

### Nós HTTP Request Adicionados

#### 1. **HTTP - Enviar Progresso Início**
Posição: Após "Preparar Lista de Contatos"
```
Method: POST
URL: https://auto-trigger.netlify.app/.netlify/functions/streamProgress
Body:
  - executionId: {{$execution.id}}
  - status: processing
  - percentage: 0
  - message: Iniciando processamento...
  - totalContatos: {{$('Buscar Contatos do Grupo').all().length}}
```

#### 2. **HTTP - Enviar Progresso do Lote**
Posição: Após "Processar em Lotes" (loop)
```
Method: POST
URL: https://auto-trigger.netlify.app/.netlify/functions/streamProgress
Body:
  - executionId: {{$execution.id}}
  - status: processing
  - percentage: {{Math.round((($node['Processar em Lotes'].context.currentNodeRunIndex + 1) / ($node['Processar em Lotes'].context.maxItemIndex + 1)) * 100)}}
  - message: Processado: {{$node['Processar em Lotes'].context.currentNodeRunIndex + 1}} de {{$node['Processar em Lotes'].context.maxItemIndex + 1}} contatos
  - totalContatos: {{$('Buscar Contatos do Grupo').all().length}}
```

---

## 🔄 Fluxo de Execução Passo a Passo

1. **Usuário envia mensagem**
   - Frontend: `POST /sendMessage` com `{group, message, hasImage?}`
   - Backend: Valida dados e retorna `executionId` (202)

2. **N8N workflow iniciado**
   - Processa webhook e busca contatos
   - HTTP POST: Enviar Progresso Início (0%)

3. **Para cada contato (em lotes)**
   - HTTP POST: Enviar Progresso Lote (% calculado)
   - Reescreve mensagem com Gemini
   - Envia via WhatsApp (Evolution API)
   - Atualiza status no Google Sheets

4. **Frontend acompanha em tempo real**
   - EventSource escuta: `/streamProgress?executionId=...`
   - Recebe eventos SSE com atualizações
   - Barra de progresso anima de 0% até 100%
   - Conexão fecha ao completar

---

## 📊 Estados de Progresso

| Status | Percentage | Mensagem | Ação |
|--------|-----------|----------|------|
| `connected` | 0 | Aguardando atualizações... | Mostra progresso |
| `processing` | 0-100 | Iniciando processamento... | Anima barra |
| `processing` | 10-99 | Processado: X de Y contatos | Atualiza barra |
| `completed` | 100 | Envio concluído! | Fecha conexão |
| `timeout` | 0 | Conexão expirada... | Erro de timeout |

---

## 🛡️ Tratamento de Erros

### Frontend
- Valida grupo antes de enviar
- Tratamento de erro em EventSource (onError)
- Fecha conexão em caso de erro
- Mostra mensagem de erro ao usuário

### Backend
- Validação de `executionId` obrigatório
- Limite de percentage entre 0-100
- Timeout de 5 minutos para long-polling
- Limpeza automática do cache

---

## 🚀 Deployamento

### Requisitos
- Node.js 14+ (Netlify Functions)
- Git para versionamento

### Implantação
```bash
git add -A
git commit -m 'feat: Add streaming progress integration'
git push origin main
```

O Netlify automaticamente:
1. Detecta mudanças
2. Compila Netlify Functions
3. Deploy em produção
4. Inicia o workflow atualizado

---

## 📈 Métricas de Desempenho

- **Latência de Atualização**: ~1s (polling interval)
- **Timeout**: 5 minutos (máximo)
- **Cache Memory**: ~1KB por execução
- **Conexões SSE**: Simultâneas (multiplexadas)

---

## 🔮 Possíveis Melhorias Futuras

1. **WebSockets**: Substituir polling por bi-direcional real
2. **Database**: Usar Redis/MongoDB em vez de memória
3. **Persistência**: Armazenar histórico de execuções
4. **Notificações**: Push notifications ao completar
5. **Analytics**: Dashboard com métricas de envios
6. **Retry Logic**: Reintentar falhas automaticamente

---

## 📚 Arquivos Modificados

```
d:\REPOSITORIES\Auto Trigger\
├── script.js                                    [MODIFICADO]
├── Index.html                                   [MODIFICADO]
├── netlify/functions/
│   ├── sendMessage.js                          [MODIFICADO]
│   └── streamProgress.js                        [CRIADO]
└── .git/logs/HEAD                              [Git commits]
```

---

## ✅ Checklist de Conclusão

- [x] Criar função `streamProgress.js` com suporte a POST/GET
- [x] Implementar cache em memória para progresso
- [x] Adicionar HTTPRequest nodes no n8n workflow
- [x] Modificar `sendMessage.js` para retornar `executionId`
- [x] Atualizar `script.js` com EventSource handler
- [x] Adicionar UI de progresso no `Index.html`
- [x] Commit e push de todas as mudanças
- [x] Validar integração n8n ↔ Netlify

---

## 📞 Suporte

Para dúvidas sobre a implementação, consulte:
- Documentação n8n: https://docs.n8n.io
- Netlify Functions: https://docs.netlify.com/functions
- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
