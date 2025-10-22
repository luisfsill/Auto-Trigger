let isProcessing = false;
let selectedImage = null;

// Objeto principal da aplicação
const app = {
    config: {
        localStorageKey: 'autoTriggerGrupos'
    },
    data: {
        groups: [],
        auth: null // Armazenará as credenciais após o login
    },
    
    // Inicia o fluxo de autenticação
    init() {
        this.addLoginListener(); // Adiciona o listener de qualquer forma
        const savedAuth = localStorage.getItem('autoTriggerAuth');

        if (savedAuth) {
            try {
                const decodedAuth = atob(savedAuth);
                const [username, password] = decodedAuth.split(':');
                this.data.auth = { username, password };
                this.startApp(); // Pula o modal e inicia a app
            } catch (e) {
                console.error("Falha ao decodificar credenciais, limpando.", e);
                localStorage.removeItem('autoTriggerAuth');
                this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                this.loginModal.show();
            }
        } else {
            this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            this.loginModal.show();
        }
    },

    // Adiciona o listener para o formulário de login
    addLoginListener() {
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const loginError = document.getElementById('loginError');

            try {
                const response = await fetch('/.netlify/functions/authenticate', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    this.data.auth = { username, password }; // Salva as credenciais na memória
                    const encodedAuth = btoa(`${username}:${password}`);
                    localStorage.setItem('autoTriggerAuth', encodedAuth);

                    this.loginModal.hide();
                    this.startApp(); // Inicia a aplicação principal
                } else {
                    const errorText = await response.text();
                    loginError.textContent = errorText || 'Credenciais inválidas.';
                    loginError.style.display = 'block';
                }
            } catch (error) {
                loginError.textContent = 'Erro de conexão. Tente novamente.';
                loginError.style.display = 'block';
            }
        });
    },

    // Inicia a aplicação principal após o login
    async startApp() {
        document.querySelector('.container').style.display = 'block';
        this.data.groups = await this.getGroups();
        this.populateGroupDropdown(this.data.groups);
        this.addAppEventListeners();
    },

    async getGroups() {
        const storedGroups = localStorage.getItem(this.config.localStorageKey);
        if (storedGroups) {
            try { return JSON.parse(storedGroups); } catch (e) { console.error("Erro ao ler grupos do localStorage.", e); }
        }
        try {
            const response = await fetch('./grupos.json');
            if (!response.ok) throw new Error('Falha ao carregar configuração padrão de grupos.');
            const defaultData = await response.json();
            const defaultGroups = defaultData.grupos || [];
            localStorage.setItem(this.config.localStorageKey, JSON.stringify(defaultGroups));
            return defaultGroups;
        } catch (error) {
            console.error(error);
            showFeedback('Não foi possível carregar a lista de grupos.', 'danger');
            return [];
        }
    },

    saveGroups(groups) {
        localStorage.setItem(this.config.localStorageKey, JSON.stringify(groups));
        this.data.groups = groups;
    },

    populateGroupDropdown(groups) {
        const groupSelect = document.getElementById('groupSelect');
        groupSelect.innerHTML = '<option value="">Escolha um grupo...</option>';
        if (!groups) return;
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.value;
            option.textContent = group.displayName;
            groupSelect.appendChild(option);
        });
    },

    populateEditModal() {
        const modalBody = document.getElementById('editGroupsModalBody');
        modalBody.innerHTML = '';
        this.data.groups.forEach(group => {
            const formGroup = document.createElement('div');
            formGroup.className = 'mb-3';
            formGroup.innerHTML = `<label for="edit-${group.value}" class="form-label fw-bold">${group.value}</label><input type="text" class="form-control" id="edit-${group.value}" value="${group.displayName}">`;
            modalBody.appendChild(formGroup);
        });
    },

    addAppEventListeners() {
        document.getElementById('saveGroupNames').addEventListener('click', () => {
            const updatedGroups = this.data.groups.map(group => {
                const input = document.getElementById(`edit-${group.value}`);
                return { ...group, displayName: input.value.trim() || group.displayName };
            });
            this.saveGroups(updatedGroups);
            this.populateGroupDropdown(updatedGroups);
            const modalEl = document.getElementById('editGroupsModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();
            showFeedback('Nomes dos grupos atualizados com sucesso!', 'success');
        });

        document.getElementById('editGroupsModal').addEventListener('show.bs.modal', () => {
            this.populateEditModal();
        });

        document.getElementById('messageText').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') sendMessage();
        });
    }
};

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showFeedback('A imagem deve ter no máximo 5MB.', 'danger');
        event.target.value = '';
        return;
    }
    if (!file.type.startsWith('image/')) {
        showFeedback('Por favor, selecione apenas arquivos de imagem.', 'danger');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImage = e.target.result;
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedImage = null;
    document.getElementById('imageFile').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
}

let feedbackModal; // Variável global para a instância do modal

document.addEventListener('DOMContentLoaded', () => {
    feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    app.init();
});

function showFeedback(message, type) {
    const feedbackModalLabel = document.getElementById('feedbackModalLabel');
    const feedbackModalBody = document.getElementById('feedbackModalBody');
    const modalHeader = document.getElementById('feedbackModal').querySelector('.modal-header');

    // Define o título e a cor do cabeçalho do modal com base no tipo de feedback
    if (type === 'success') {
        feedbackModalLabel.textContent = 'Sucesso!';
        modalHeader.classList.remove('bg-danger');
        modalHeader.classList.add('bg-success', 'text-white');
    } else if (type === 'danger') {
        feedbackModalLabel.textContent = 'Erro!';
        modalHeader.classList.remove('bg-success');
        modalHeader.classList.add('bg-danger', 'text-white');
    } else {
        feedbackModalLabel.textContent = 'Aviso';
        modalHeader.classList.remove('bg-success', 'bg-danger');
    }

    feedbackModalBody.innerHTML = message.replace(/\n/g, '<br>');
    feedbackModal.show();
}


function showProgressBar() {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
}

function hideProgressBar() {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

function streamProgress(executionId, sendButton) {
    // Conecta ao stream de progresso usando EventSource (SSE)
    const eventSourceUrl = `/.netlify/functions/streamProgress?executionId=${encodeURIComponent(executionId)}`;
    console.log('Conectando ao stream:', eventSourceUrl);
    
    const eventSource = new EventSource(eventSourceUrl);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Progresso recebido:', data);

            // Atualiza a barra de progresso
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');

            if (data.percentage !== undefined) {
                if (progressBar) {
                    const percentage = Math.min(Math.max(data.percentage, 0), 100);
                    progressBar.style.width = `${percentage}%`;
                    progressBar.textContent = `${percentage}%`;
                }
            }

            if (data.message && progressText) {
                progressText.textContent = data.message;
            }

            // Se o status é "completed" ou "error", fecha a conexão
            if (data.status === 'completed' || data.status === 'error') {
                eventSource.close();
                hideProgressBar();
                
                if (data.status === 'completed') {
                    showFeedback('✅ Mensagens enviadas com sucesso!', 'success');
                    document.getElementById('messageText').value = '';
                    removeImage();
                } else {
                    showFeedback(`❌ Erro: ${data.message}`, 'danger');
                }

                isProcessing = false;
                sendButton.disabled = false;
                sendButton.textContent = 'ENVIAR';
            }
        } catch (error) {
            console.error('Erro ao processar evento SSE:', error);
        }
    };

    eventSource.onerror = (event) => {
        console.error('Erro na conexão SSE:', event);
        eventSource.close();
        hideProgressBar();
        
        // Verifica se é um erro 500 ou outro erro HTTP
        if (event.status === 500) {
            showFeedback('⚠️ Erro no servidor ao monitorar progresso', 'danger');
        } else {
            showFeedback('⚠️ Conexão perdida. O envio pode continuar em background.', 'warning');
        }
        
        isProcessing = false;
        sendButton.disabled = false;
        sendButton.textContent = 'ENVIAR';
    };

    // Timeout de segurança após 10 minutos
    setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
            console.warn('Timeout: Fechando conexão SSE após 10 minutos');
            eventSource.close();
            hideProgressBar();
            showFeedback('⏱️ Timeout na conexão. Verifique o status manualmente.', 'warning');
        }
    }, 10 * 60 * 1000);
}

async function sendMessage() {
    if (isProcessing) return;
    if (!app.data.auth) {
        showFeedback('Erro de autenticação. Por favor, recarregue a página.', 'danger');
        return;
    }

    const message = document.getElementById('messageText').value.trim();
    const group = document.getElementById('groupSelect').value;
    const sendButton = document.getElementById('sendButton');

    // Validação adicional do grupo
    if (!group || !/^Grupo \d+$/.test(group.trim())) {
        showFeedback('Por favor, selecione um grupo válido (Grupo 1, Grupo 2, etc).', 'danger');
        return;
    }

    if (!message || !group) {
        showFeedback('Por favor, preencha a mensagem e selecione um grupo.', 'danger');
        return;
    }

    isProcessing = true;
    sendButton.disabled = true;
    sendButton.textContent = 'ENVIANDO...';

    try {
        const payload = {
            auth: app.data.auth, // Adiciona as credenciais salvas
            message: message,
            group: group,
            hasImage: !!selectedImage,
            image: selectedImage || null
        };

        const response = await fetch('/.netlify/functions/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let errorData = null;
        
        if (!response.ok) {
            try {
                // Tenta parsear como JSON primeiro
                errorData = await response.json();
                console.error('Erro JSON da resposta:', errorData);
                throw new Error(errorData.message || errorData.error || `Erro ${response.status} do servidor`);
            } catch (parseError) {
                // Se não for JSON, trata como texto
                const errorText = await response.text();
                console.error('Erro de texto da resposta:', errorText);
                throw new Error(errorText || `Erro ${response.status} ao enviar mensagem`);
            }
        }

        // Captura o executionId da resposta JSON
        let jsonResponse;
        try {
            jsonResponse = await response.json();
        } catch (parseError) {
            console.error('Erro ao parsear resposta:', parseError);
            throw new Error('Resposta inválida do servidor');
        }

        const executionId = jsonResponse.executionId;

        if (!executionId) {
            console.error('Resposta do servidor:', jsonResponse);
            throw new Error('Falha ao obter o ID de execução do n8n. A workflow pode não ter sido iniciada.');
        }

        console.log('ExecutionId obtido:', executionId);

        // Mostra a barra de progresso e conecta ao streaming
        showProgressBar();
        streamProgress(executionId, sendButton);
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        const errorMessage = error.message || 'Erro ao enviar mensagens.';
        showFeedback(`⚠️ ${errorMessage}`, 'danger');
    } finally {
        isProcessing = false;
        sendButton.disabled = false;
        sendButton.textContent = 'ENVIAR';
    }
}



// Registra o Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}