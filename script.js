// Funções globais para o modal ENVIAR 2 temporário
function openSend2Modal() {
  document.getElementById('send2Modal').style.display = 'flex';
}
function closeSend2Modal() {
  document.getElementById('send2Modal').style.display = 'none';
}
// Fecha o modal ao clicar fora do conteúdo
window.addEventListener('click', function(event) {
  const modal = document.getElementById('send2Modal');
  if (event.target === modal) {
    closeSend2Modal();
  }
});

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
        showFeedback('A imagem deve ter no máximo 5MB.', 'warning');
        event.target.value = '';
        return;
    }
    if (!file.type.startsWith('image/')) {
        showFeedback('Por favor, selecione apenas arquivos de imagem.', 'warning');
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

// Ícones SVG para feedback
const feedbackIcons = {
  success: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="30" fill="#22c55e" fill-opacity="0.15"/>
    <path d="M20 31.5L27 38.5L41 24.5" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  error: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="30" fill="#ef4444" fill-opacity="0.15"/>
    <path d="M38 22L22 38" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
    <path d="M22 22L38 38" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  warning: `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="30" fill="#eab308" fill-opacity="0.15"/>
    <path d="M30 18V34" stroke="#eab308" stroke-width="4" stroke-linecap="round"/>
    <circle cx="30" cy="42" r="2.5" fill="#eab308"/>
  </svg>`
};

function showFeedback(message, type = 'success') {
  const feedbackModalLabel = document.getElementById('feedbackModalLabel');
  const feedbackModalBody = document.getElementById('feedbackModalBody');
  const feedbackModalIcon = document.getElementById('feedbackModalIcon');
  const modalContent = document.getElementById('feedbackModalCustomContent');

  // Limpa classes
  modalContent.classList.remove('error', 'warning');
  feedbackModalLabel.className = 'custom-modal-title';

  // Define o ícone, cor e título conforme o tipo
  if (type === 'success') {
    feedbackModalLabel.textContent = 'Sucesso!';
    feedbackModalIcon.innerHTML = feedbackIcons.success;
  } else if (type === 'danger' || type === 'error') {
    feedbackModalLabel.textContent = 'Erro!';
    feedbackModalIcon.innerHTML = feedbackIcons.error;
    modalContent.classList.add('error');
    feedbackModalLabel.classList.add('error');
  } else if (type === 'warning') {
    feedbackModalLabel.textContent = 'Atenção';
    feedbackModalIcon.innerHTML = feedbackIcons.warning;
    modalContent.classList.add('warning');
    feedbackModalLabel.classList.add('warning');
  } else {
    feedbackModalLabel.textContent = 'Aviso';
    feedbackModalIcon.innerHTML = '';
  }

  feedbackModalBody.innerHTML = message.replace(/\n/g, '<br>');
  feedbackModal.show();
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
        showFeedback('Por favor, selecione um grupo válido (Grupo 1, Grupo 2, etc).', 'warning');
        return;
    }

    if (!message || !group) {
        showFeedback('Por favor, preencha a mensagem e selecione um grupo.', 'warning');
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

        let result;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const jsonResponse = await response.json();
            result = jsonResponse.message || JSON.stringify(jsonResponse);
        } else {
            result = await response.text();
        }

        if (response.ok) {
            showFeedback(result || 'Mensagens enviadas com sucesso!', 'success');
            // Mantém a mensagem no campo de texto após o envio (não limpar)
            // Se quiser limpar o grupo também, descomente a linha abaixo
            // document.getElementById('groupSelect').value = '';
            removeImage();
        } else {
            throw new Error(result || 'Erro no servidor ao enviar mensagem');
        }
    } catch (error) {
        console.error('Erro:', error);
        showFeedback(error.message || 'Erro ao enviar mensagens.', 'danger');
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