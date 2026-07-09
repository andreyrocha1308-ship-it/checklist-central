// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBlUHMGTfK46mYixMj8Z6ESBDdX8GkH32k",
  authDomain: "checklistcentralusa.firebaseapp.com",
  projectId: "checklistcentralusa",
  storageBucket: "checklistcentralusa.firebasestorage.app",
  messagingSenderId: "351671399772",
  appId: "1:351671399772:web:d7c88b2130e12fc5ba7d99",
  measurementId: "G-51G1V0W30R"
};

// Inicializa Firebase e Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Lista estática de perguntas do checklist (para bater com o ID salvo no Firestore)
const checklistQuestions = [
    { id: 'oleo', title: 'Nível do Óleo do Motor' },
    { id: 'pneus_esteiras', title: 'Pneus / Esteiras (Desgaste/Pressão)' },
    { id: 'freios', title: 'Freios de Serviço e Estacionamento' },
    { id: 'iluminacao_sonoro', title: 'Faróis, Lanternas e Buzina/Alarme de Ré' },
    { id: 'vazamentos', title: 'Vazamentos Aparentes (Fluídos/Ar)' },
    { id: 'cinto_seguranca', title: 'Cinto de Segurança e Assento' }
];

// Estado local da página Admin
let localFleets = [];
let localChecklists = [];

// Elementos do DOM: Estatísticas
const statTotalChecklists = document.getElementById('stat-total-checklists');
const statApprovedChecklists = document.getElementById('stat-approved-checklists');
const statFailedChecklists = document.getElementById('stat-failed-checklists');
const statTotalFleets = document.getElementById('stat-total-fleets');

// Elementos do DOM: Filtros e Tabela
const filterFrota = document.getElementById('filter-frota');
const filterTurno = document.getElementById('filter-turno');
const filterData = document.getElementById('filter-data');
const reportsTableRows = document.getElementById('reports-table-rows');

// Elementos do DOM: Cadastro de Frota
const newFleetName = document.getElementById('new-fleet-name');
const newFleetModel = document.getElementById('new-fleet-model');
const btnAddFleet = document.getElementById('btn-add-fleet');
const fleetsList = document.getElementById('fleets-list');
const addFleetForm = document.getElementById('add-fleet-form');

// Elementos do DOM: Modal
const detailsModal = document.getElementById('details-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalMatricula = document.getElementById('modal-matricula');
const modalNome = document.getElementById('modal-nome');
const modalTurno = document.getElementById('modal-turno');
const modalFrota = document.getElementById('modal-frota');
const modalChecklistList = document.getElementById('modal-checklist-list');
const modalNextNotesSection = document.getElementById('modal-next-notes-section');
const modalNextNotes = document.getElementById('modal-next-notes');
const btnCloseModal = document.getElementById('btn-close-modal');

// Elementos do DOM: Login
const adminLoginScreen = document.getElementById('admin-login-screen');
const adminLoginForm = document.getElementById('admin-login-form');
const loginUser = document.getElementById('login-user');
const loginPass = document.getElementById('login-pass');
const loginError = document.getElementById('login-error');
const adminWrapper = document.getElementById('admin-wrapper');

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Controle de Login administrativo
    const checkLogin = () => {
        if (sessionStorage.getItem("adminLoggedIn") === "true") {
            adminLoginScreen.style.display = 'none';
            adminWrapper.style.display = 'block';
            return true;
        }
        return false;
    };

    if (checkLogin()) {
        await loadAllData();
    }

    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = loginUser.value.trim();
        const pass = loginPass.value.trim();

        if (user === 'admin' && pass === 'admin') {
            sessionStorage.setItem("adminLoggedIn", "true");
            loginError.style.display = 'none';
            adminLoginScreen.style.display = 'none';
            adminWrapper.style.display = 'block';
            await loadAllData();
        } else {
            loginError.style.display = 'block';
            loginPass.value = '';
            loginPass.focus();
        }
    });

    // 2. Eventos para filtros
    filterFrota.addEventListener('change', renderChecklists);
    filterTurno.addEventListener('change', renderChecklists);
    filterData.addEventListener('input', renderChecklists);

    // 3. Evento para adicionar nova frota
    addFleetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newFleetName.value.trim();
        const model = newFleetModel.value.trim();
        if (!name || !model) return;

        // Evita duplicados
        const exists = localFleets.some(f => f.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert("Este veículo já está cadastrado.");
            return;
        }

        btnAddFleet.disabled = true;
        btnAddFleet.textContent = "Salvando...";

        try {
            // Calcula o próximo valor de ordem (final da fila)
            const nextOrder = localFleets.length > 0 ? Math.max(...localFleets.map(f => f.order ?? 0)) + 1 : 0;

            await addDoc(collection(db, "fleets"), {
                name: name,
                model: model,
                order: nextOrder,
                timestamp: serverTimestamp()
            });

            newFleetName.value = '';
            newFleetModel.value = '';
            await loadFleetsData();
            renderFleets();
            populateFleetFilters();
            updateStats();
        } catch (error) {
            console.error("Erro ao cadastrar frota:", error);
            alert("Erro ao salvar no banco de dados.");
        } finally {
            btnAddFleet.disabled = false;
            btnAddFleet.textContent = "Salvar Veículo";
        }
    });

    // 4. Fechar Modal
    btnCloseModal.addEventListener('click', () => {
        detailsModal.style.display = 'none';
    });

    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            detailsModal.style.display = 'none';
        }
    });
});

// ==========================================================================
// FUNÇÕES DE COMUNICAÇÃO COM FIRESTORE
// ==========================================================================

async function loadAllData() {
    try {
        await loadFleetsData();
        await loadChecklistsData();
        
        renderFleets();
        populateFleetFilters();
        renderChecklists();
        updateStats();
    } catch (error) {
        console.error("Erro ao carregar dados do Firestore:", error);
    }
}

async function loadFleetsData() {
    const querySnapshot = await getDocs(collection(db, "fleets"));
    localFleets = [];
    querySnapshot.forEach((docSnap) => {
        localFleets.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });
    // Ordena pela propriedade customizada de ordenação
    localFleets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function loadChecklistsData() {
    const querySnapshot = await getDocs(collection(db, "checklists"));
    localChecklists = [];
    querySnapshot.forEach((docSnap) => {
        localChecklists.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });
}

// ==========================================================================
// RENDERIZADORES DA INTERFACE
// ==========================================================================

function updateStats() {
    statTotalChecklists.textContent = localChecklists.length.toString();
    statTotalFleets.textContent = localFleets.length.toString();

    const approvedCount = localChecklists.filter(c => c.status !== 'Atenção / Manutenção').length;
    const failedCount = localChecklists.length - approvedCount;

    statApprovedChecklists.textContent = approvedCount.toString();
    statFailedChecklists.textContent = failedCount.toString();
}

function renderFleets() {
    fleetsList.innerHTML = '';

    if (localFleets.length === 0) {
        fleetsList.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.9rem;">
                Nenhum veículo cadastrado.
            </div>
        `;
        return;
    }

    localFleets.forEach((fleet, index) => {
        const item = document.createElement('div');
        item.className = 'fleet-item';
        
        // Desabilita botões nas extremidades
        const disableUp = index === 0 ? 'disabled style="opacity: 0.25; cursor: not-allowed;"' : '';
        const disableDown = index === localFleets.length - 1 ? 'disabled style="opacity: 0.25; cursor: not-allowed;"' : '';

        item.innerHTML = `
            <span class="fleet-name">${fleet.name} <span style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic;">(${fleet.model || '-'})</span></span>
            <div class="fleet-actions">
                <button type="button" class="btn-icon-only btn-move-up" data-id="${fleet.id}" title="Mover para Cima" ${disableUp}>
                    ▲
                </button>
                <button type="button" class="btn-icon-only btn-move-down" data-id="${fleet.id}" title="Mover para Baixo" ${disableDown}>
                    ▼
                </button>
                <button type="button" class="btn-icon-only btn-edit" data-id="${fleet.id}" data-name="${fleet.name}" data-model="${fleet.model || ''}" title="Editar Nome/Modelo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/>
                    </svg>
                </button>
                <button type="button" class="btn-icon-only btn-delete" data-id="${fleet.id}" title="Excluir Veículo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </button>
            </div>
        `;

        // Eventos dos botões de ação
        if (index > 0) {
            item.querySelector('.btn-move-up').addEventListener('click', (e) => handleMoveFleet(e.currentTarget, -1));
        }
        if (index < localFleets.length - 1) {
            item.querySelector('.btn-move-down').addEventListener('click', (e) => handleMoveFleet(e.currentTarget, 1));
        }
        item.querySelector('.btn-edit').addEventListener('click', (e) => handleEditFleet(e.currentTarget));
        item.querySelector('.btn-delete').addEventListener('click', (e) => handleDeleteFleet(e.currentTarget));

        fleetsList.appendChild(item);
    });
}

function populateFleetFilters() {
    // Guarda o valor selecionado anteriormente
    const prevSelected = filterFrota.value;
    
    filterFrota.innerHTML = '<option value="">Todos os Veículos</option>';
    localFleets.forEach(fleet => {
        const opt = document.createElement('option');
        opt.value = fleet.name;
        opt.textContent = fleet.name;
        filterFrota.appendChild(opt);
    });

    filterFrota.value = prevSelected;
}

function renderChecklists() {
    reportsTableRows.innerHTML = '';

    const selectedFrota = filterFrota.value;
    const selectedTurno = filterTurno.value;
    const selectedData = filterData.value; // Formato YYYY-MM-DD

    // 1. Filtra os checklists locais em memória
    let filtered = localChecklists.filter(c => {
        // Filtro de Frota
        if (selectedFrota && c.frota !== selectedFrota) return false;
        
        // Filtro de Turno
        if (selectedTurno && c.turno !== selectedTurno) return false;

        // Filtro de Data
        if (selectedData) {
            // Se o checklist não tiver data confirmada (registros legados), usamos a data do timestamp
            const docDate = c.data || (c.timestamp ? c.timestamp.toDate().toISOString().split('T')[0] : '');
            if (docDate !== selectedData) return false;
        }

        return true;
    });

    // 2. Ordena checklists decrescente por data/timestamp (mais recentes primeiro)
    filtered.sort((a, b) => {
        // Compara por data de preenchimento (string YYYY-MM-DD)
        if (a.data && b.data && a.data !== b.data) {
            return b.data.localeCompare(a.data);
        }
        // Se a data for igual ou faltar, compara por timestamp
        const timeA = a.timestamp ? a.timestamp.toDate() : new Date(0);
        const timeB = b.timestamp ? b.timestamp.toDate() : new Date(0);
        return timeB - timeA;
    });

    if (filtered.length === 0) {
        reportsTableRows.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 35px;">
                    Nenhum relatório encontrado para os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach((item) => {
        const row = document.createElement('tr');

        // Formata data de exibição (DD/MM/YYYY)
        let displayDate = '-';
        if (item.data) {
            const parts = item.data.split('-');
            if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (item.timestamp) {
            displayDate = item.timestamp.toDate().toLocaleDateString('pt-BR');
        }

        const statusClass = item.status === 'Atenção / Manutenção' ? 'status-no' : 'status-yes';
        const statusLabel = item.status === 'Atenção / Manutenção' ? 'Atenção' : 'Aprovado';

        row.innerHTML = `
            <td style="font-weight: 600;">${displayDate}</td>
            <td>${item.frota}</td>
            <td>${item.nome || '-'}</td>
            <td>${item.turno || '-'}</td>
            <td><span class="status-indicator-dot ${statusClass}"></span>${statusLabel}</td>
            <td style="text-align: center;">
                <button type="button" class="btn-mini" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Ver Detalhes
                </button>
            </td>
        `;

        row.querySelector('.btn-mini').addEventListener('click', (e) => showChecklistDetails(item.id));
        reportsTableRows.appendChild(row);
    });
}

// ==========================================================================
// AÇÕES DO GERENCIADOR DE FROTA
// ==========================================================================

async function handleEditFleet(target) {
    const id = target.getAttribute('data-id');
    const oldName = target.getAttribute('data-name');
    const oldModel = target.getAttribute('data-model') || '';
    const newName = prompt("Editar nome do veículo da frota:", oldName);

    if (newName === null) return; // Cancelado
    const trimmedName = newName.trim();
    if (!trimmedName) {
        alert("O nome do veículo não pode ser vazio.");
        return;
    }

    const newModel = prompt("Editar modelo do veículo:", oldModel);
    if (newModel === null) return; // Cancelado
    const trimmedModel = newModel.trim();
    if (!trimmedModel) {
        alert("O modelo do veículo não pode ser vazio.");
        return;
    }

    try {
        await updateDoc(doc(db, "fleets", id), {
            name: trimmedName,
            model: trimmedModel
        });
        await loadFleetsData();
        renderFleets();
        populateFleetFilters();
        renderChecklists(); // Atualiza a tabela se o nome do veículo listado mudar
        updateStats();
    } catch (error) {
        console.error("Erro ao atualizar veículo:", error);
        alert("Erro ao editar o veículo da frota.");
    }
}

async function handleDeleteFleet(target) {
    const id = target.getAttribute('data-id');
    if (!confirm("Tem certeza que deseja excluir este veículo da frota? Ele deixará de aparecer para novas inspeções.")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "fleets", id));
        await loadFleetsData();
        renderFleets();
        populateFleetFilters();
        updateStats();
    } catch (error) {
        console.error("Erro ao deletar veículo:", error);
        alert("Erro ao excluir o veículo da frota.");
    }
}

async function handleMoveFleet(target, direction) {
    const id = target.getAttribute('data-id');
    const idx = localFleets.findIndex(f => f.id === id);
    if (idx === -1) return;

    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= localFleets.length) return;

    const currentFleet = localFleets[idx];
    const targetFleet = localFleets[targetIdx];

    // Troca os valores de ordem
    const currentOrder = currentFleet.order ?? 0;
    const targetOrder = targetFleet.order ?? 0;

    let newCurrentOrder = targetOrder;
    let newTargetOrder = currentOrder;

    // Se tiverem a mesma ordem, recalcula baseando-se no índice
    if (currentOrder === targetOrder) {
        newCurrentOrder = targetOrder + (direction < 0 ? -1 : 1);
    }

    try {
        await updateDoc(doc(db, "fleets", currentFleet.id), {
            order: newCurrentOrder
        });
        await updateDoc(doc(db, "fleets", targetFleet.id), {
            order: newTargetOrder
        });

        // Recarrega todos os dados de frotas e renderiza novamente na nova ordem
        await loadFleetsData();
        renderFleets();
        populateFleetFilters();
    } catch (error) {
        console.error("Erro ao reordenar frota:", error);
        alert("Erro ao reordenar veículo da frota no banco de dados.");
    }
}

// ==========================================================================
// DETALHES DO RELATÓRIO (MODAL)
// ==========================================================================

function showChecklistDetails(checklistId) {
    const record = localChecklists.find(c => c.id === checklistId);
    if (!record) return;

    // Cabeçalhos
    modalTitle.textContent = `Inspeção - ${record.frota}`;
    
    let displayDate = '-';
    if (record.data) {
        const parts = record.data.split('-');
        if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else if (record.timestamp) {
        displayDate = record.timestamp.toDate().toLocaleDateString('pt-BR');
    }
    
    modalSubtitle.textContent = `${record.checklistId || 'CK-######'} | Data: ${displayDate}`;

    // Identificação
    modalMatricula.textContent = record.matricula || '-';
    modalNome.textContent = record.nome || '-';
    modalTurno.textContent = record.turno || '-';
    modalFrota.textContent = record.modelo ? `${record.frota} (${record.modelo})` : (record.frota || '-');

    // Notas de Passagem de turno
    if (record.nextShiftNotes && record.nextShiftNotes.trim() !== '') {
        modalNextNotes.textContent = `"${record.nextShiftNotes}"`;
        modalNextNotesSection.style.display = 'block';
    } else {
        modalNextNotesSection.style.display = 'none';
    }

    // Itens de Inspeção
    modalChecklistList.innerHTML = '';
    
    checklistQuestions.forEach(question => {
        const answer = record.answers[question.id] || { value: 'Não respondido', details: '' };
        
        const card = document.createElement('div');
        card.className = 'summary-checklist-item';
        
        const isYes = answer.value === 'Sim';
        const badgeClass = isYes ? 'badge-yes' : 'badge-no';
        const badgeLabel = answer.value;

        card.innerHTML = `
            <div class="summary-q-header">
                <span class="summary-q-title" style="font-weight: 500;">${question.title}</span>
                <span class="badge ${badgeClass}">${badgeLabel}</span>
            </div>
            ${answer.details ? `<p class="summary-q-details" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px; font-style: italic;">Obs: "${answer.details}"</p>` : ''}
        `;
        
        modalChecklistList.appendChild(card);
    });

    detailsModal.style.display = 'flex';
}
