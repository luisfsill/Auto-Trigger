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
        this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        this.loginModal.show();
        this.addLoginListener();
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

function showFeedback(message, type) {
    const feedbackContainer = document.getElementById('feedbackContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alertDiv.innerHTML = `${message.replace(/\n/g, '<br>')}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    feedbackContainer.innerHTML = '';
    feedbackContainer.appendChild(alertDiv);
    setTimeout(() => { alertDiv.remove(); }, 30000);
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

        const result = await response.text();

        if (response.ok) {
            showFeedback(result || 'Mensagens enviadas com sucesso!', 'success');
            setTimeout(() => {
                document.getElementById('messageText').value = '';
                document.getElementById('groupSelect').value = '';
                removeImage();
            }, 30000);
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

// Inicia o fluxo de autenticação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => app.init());