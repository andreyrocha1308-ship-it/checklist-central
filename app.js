/**
 * Checklist Central - Lógica da Aplicação
 * Gerenciamento de estado, fluxo de etapas, validações e resumo de dados.
 */

// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBlUHMGTfK46mYixMj8Z6ESBDdX8GkH32k",
  authDomain: "checklistcentralusa.firebaseapp.com",
  projectId: "checklistcentralusa",
  storageBucket: "checklistcentralusa.firebasestorage.app",
  messagingSenderId: "351671399772",
  appId: "1:351671399772:web:d7c88b2130e12fc5ba7d99",
  measurementId: "G-51G1V0W30R"
};

// Inicialização do Firebase e Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // CONFIGURAÇÃO DOS ITENS DO CHECKLIST
    // ==========================================================================
    // Facilmente expansível pelo usuário adicionando novos objetos ao array.
    const checklistQuestions = [
        {
            id: 'oleo',
            title: 'Nível do Óleo compatível?',
            description: 'Verifique a vareta de óleo do motor. O nível deve estar entre as marcas de mínimo e máximo.',
            category: 'Mecânica'
        },
        {
            id: 'pneus_esteiras',
            title: 'Pneus ou esteiras em bom estado?',
            description: 'Verifique o desgaste, cortes profundos, bolhas ou calibragem visual de todos os pneus/esteiras.',
            category: 'Rodagem'
        },
        {
            id: 'freios',
            title: 'Sistema de freios operacional?',
            description: 'Teste o freio de serviço e o freio de estacionamento em área segura antes de iniciar as atividades.',
            category: 'Segurança'
        },
        {
            id: 'iluminacao_sonoro',
            title: 'Sinalização luminosa e buzina funcionando?',
            description: 'Teste faróis, lanternas traseiras, setas, giroflex, buzina e alarme de ré.',
            category: 'Elétrica / Alertas'
        },
        {
            id: 'vazamentos',
            title: 'Ausência de vazamentos aparentes?',
            description: 'Inspecione visualmente embaixo do veículo para identificar vazamentos de óleo, água ou fluído hidráulico.',
            category: 'Mecânica'
        },
        {
            id: 'cinto_seguranca',
            title: 'Cinto de segurança em perfeitas condições?',
            description: 'Verifique se o cinto está travando perfeitamente e se não apresenta rasgos ou desgaste excessivo.',
            category: 'Segurança'
        }
    ];

    // ==========================================================================
    // ESTADO DA APLICAÇÃO
    // ==========================================================================
    const state = {
        matricula: '',
        nome: '',
        data: '',
        turno: '',
        frota: '',
        modelo: '',
        answers: {}, // Estrutura: { questionId: { value: 'Sim'|'Não', details: 'Texto opcional' } }
        declarationConfirmed: false,
        nextShiftNotes: ''
    };

    let currentStep = 1;
    
    // Passos fixos iniciais: 5 (Matrícula, Nome, Data, Turno, Frota)
    const fixedStepsCount = 5;
    // Checklist dinâmico: checklistQuestions.length
    // Passo de Notas do próximo turno: 1
    // Passo de resumo final: 1
    const totalSteps = fixedStepsCount + checklistQuestions.length + 2;

    // ==========================================================================
    // REFERÊNCIAS DOS ELEMENTOS DO DOM
    // ==========================================================================
    const form = document.getElementById('checklist-form');
    const dynamicContainer = document.getElementById('dynamic-checklist-container');
    const navControls = document.getElementById('nav-controls');
    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');
    
    const progressStepText = document.getElementById('progress-step-text');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressFill = document.getElementById('progress-fill');

    const nextShiftStep = document.getElementById('next-shift-step');
    const nextShiftStepNumber = document.getElementById('next-shift-step-number');
    const nextShiftObs = document.getElementById('next-shift-obs');
    const summaryStep = document.getElementById('summary-step');
    const successStep = document.getElementById('success-step');

    // Alerta do Turno Anterior
    const prevShiftNotesContainer = document.getElementById('prev-shift-notes-container');
    const prevShiftNotesText = document.getElementById('prev-shift-notes-text');
    const prevShiftNotesMeta = document.getElementById('prev-shift-notes-meta');

    // Elementos de Resumo
    const sumData = document.getElementById('sum-data');
    const sumMatricula = document.getElementById('sum-matricula');
    const sumNome = document.getElementById('sum-nome');
    const sumTurno = document.getElementById('sum-turno');
    const sumFrota = document.getElementById('sum-frota');
    const sumChecklistList = document.getElementById('sum-checklist-list');
    const confirmDeclaration = document.getElementById('confirm-declaration');

    // Elementos do Recibo
    const receiptId = document.getElementById('receipt-id');
    const receiptStatus = document.getElementById('receipt-status');
    const receiptDate = document.getElementById('receipt-date');
    const receiptVehicle = document.getElementById('receipt-vehicle');
    const btnDownloadReport = document.getElementById('btn-download-report');
    const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
    const btnRestart = document.getElementById('btn-restart');

    // Elementos do Dropdown de Busca de Frota
    const selectFrota = document.getElementById('frota');
    const frotaSearch = document.getElementById('frota-search');
    const dropdownTrigger = document.getElementById('frota-dropdown-trigger');
    const dropdownList = document.getElementById('frota-dropdown-list');

    // ==========================================================================
    // CARREGAR FROTA DINAMICAMENTE
    // ==========================================================================
    async function loadFleets() {
        if (!selectFrota) return;

        try {
            const querySnapshot = await getDocs(collection(db, "fleets"));
            const fleets = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.name) {
                    fleets.push({
                        name: data.name,
                        model: data.model || '',
                        order: data.order ?? 0
                    });
                }
            });

            // Ordena pela propriedade customizada de ordenação
            fleets.sort((a, b) => a.order - b.order);
            selectFrota.innerHTML = '';
            
            if (dropdownList) {
                dropdownList.innerHTML = '';
            }
            
            if (fleets.length === 0) {
                selectFrota.innerHTML = '<option value="" disabled selected hidden>Nenhum veículo cadastrado (Acesse /admin.html)</option>';
                if (dropdownList) {
                    dropdownList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); text-align: center; font-size: 0.85rem;">Nenhum veículo cadastrado</div>';
                }
                return;
            }

            selectFrota.innerHTML = '<option value="" disabled selected hidden>Selecione o veículo</option>';
            fleets.forEach(fleet => {
                // Preenche o select escondido
                const opt = document.createElement('option');
                opt.value = fleet.name;
                opt.textContent = fleet.name;
                opt.setAttribute('data-modelo', fleet.model || 'Inspeção Diária');
                selectFrota.appendChild(opt);

                // Preenche a lista customizada do dropdown de pesquisa
                if (dropdownList) {
                    const item = document.createElement('div');
                    item.className = 'custom-dropdown-item';
                    item.setAttribute('data-value', fleet.name);
                    item.setAttribute('data-modelo', fleet.model || 'Inspeção Diária');
                    item.innerHTML = `
                        <span class="item-name" style="font-weight: 600;">${fleet.name}</span>
                        <span class="item-model" style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic;">(${fleet.model || '-'})</span>
                    `;
                    
                    // Evento de clique para selecionar o veículo
                    item.addEventListener('click', () => {
                        selectVehicleFromDropdown(fleet.name, fleet.model || 'Inspeção Diária');
                    });
                    
                    dropdownList.appendChild(item);
                }
            });
        } catch (error) {
            console.error("Erro ao carregar frotas do Firestore:", error);
            selectFrota.innerHTML = '<option value="" disabled selected hidden>Erro ao carregar frotas</option>';
        }
    }

    // ==========================================================================
    // INICIALIZAÇÃO E GERAÇÃO DINÂMICA DO CHECKLIST
    // ==========================================================================
    function initializeChecklist() {
        dynamicContainer.innerHTML = ''; // Limpa conteúdo anterior
        
        // Inicializa o campo de data com a data de hoje
        const inputData = document.getElementById('data-inspecao');
        if (inputData) {
            inputData.value = new Date().toISOString().split('T')[0];
            state.data = inputData.value;
        }

        // Carrega a frota dinamicamente do Firestore
        loadFleets();
        
        checklistQuestions.forEach((question, index) => {
            const stepNum = fixedStepsCount + 1 + index;
            const stepCard = document.createElement('div');
            stepCard.className = 'step-card';
            stepCard.setAttribute('data-step', stepNum.toString());
            stepCard.setAttribute('data-question-id', question.id);

            stepCard.innerHTML = `
                <div class="step-header">
                    <div class="step-number">${String(stepNum).padStart(2, '0')}</div>
                    <h2>${question.category}</h2>
                    <p class="question-title">${question.title}</p>
                    <span class="question-description" style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                        ${question.description}
                    </span>
                </div>
                
                <div class="input-group">
                    <div class="option-buttons-container">
                        <button type="button" class="btn-option btn-yes" data-value="Sim">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Sim
                        </button>
                        <button type="button" class="btn-option btn-no" data-value="Não">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Não
                        </button>
                    </div>
                    
                    <span class="validation-message" id="error-q-${question.id}">
                        Por favor, selecione Sim ou Não para responder esta questão.
                    </span>

                    <div class="details-toggle-container">
                        <button type="button" class="btn-details-toggle" id="btn-toggle-${question.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            + Detalhes
                        </button>
                    </div>

                    <div class="details-textarea-wrapper" id="details-wrapper-${question.id}">
                        <textarea id="details-text-${question.id}" placeholder="Escreva aqui detalhes adicionais sobre o estado do item..." autocomplete="off"></textarea>
                    </div>
                </div>
            `;

            dynamicContainer.appendChild(stepCard);

            // Vincula Eventos aos Botões Sim/Não desta pergunta
            const btnYes = stepCard.querySelector('.btn-yes');
            const btnNo = stepCard.querySelector('.btn-no');
            const btnToggle = stepCard.querySelector('.btn-details-toggle');
            const detailsWrapper = stepCard.querySelector('.details-textarea-wrapper');
            const detailsText = stepCard.querySelector('textarea');
            const errorMsg = stepCard.querySelector('.validation-message');

            const selectOption = (selectedValue) => {
                // Atualiza o estado
                if (!state.answers[question.id]) {
                    state.answers[question.id] = { value: '', details: '' };
                }
                state.answers[question.id].value = selectedValue;

                // Estiliza os botões do DOM
                if (selectedValue === 'Sim') {
                    btnYes.classList.add('selected');
                    btnNo.classList.remove('selected');
                } else {
                    btnYes.classList.remove('selected');
                    btnNo.classList.add('selected');
                    
                    // UX Extra: Se o usuário clica em "Não", e a caixa de detalhes não está aberta, abrimos automaticamente!
                    // Isso orienta o operador a justificar a falha técnica identificada.
                    if (!btnToggle.classList.contains('active')) {
                        toggleDetails();
                    }
                }
                
                // Oculta mensagem de erro caso estivesse ativa
                errorMsg.style.display = 'none';
            };

            btnYes.addEventListener('click', () => selectOption('Sim'));
            btnNo.addEventListener('click', () => selectOption('Não'));

            // Função para alternar detalhes
            const toggleDetails = () => {
                btnToggle.classList.toggle('active');
                detailsWrapper.classList.toggle('show');
                if (detailsWrapper.classList.contains('show')) {
                    detailsText.focus();
                }
            };

            btnToggle.addEventListener('click', toggleDetails);

            // Escuta a digitação nos detalhes para gravar no estado
            detailsText.addEventListener('input', (e) => {
                if (!state.answers[question.id]) {
                    state.answers[question.id] = { value: '', details: '' };
                }
                state.answers[question.id].details = e.target.value;
            });
        });

        // Configura o número do passo de passagem de turno de forma dinâmica
        if (nextShiftStep) {
            nextShiftStep.setAttribute('data-step', String(totalSteps - 1));
        }
        if (nextShiftStepNumber) {
            nextShiftStepNumber.textContent = String(totalSteps - 1).padStart(2, '0');
        }

        // Configura o número do passo do resumo de forma dinâmica
        if (summaryStep) {
            summaryStep.setAttribute('data-step', String(totalSteps));
        }
        const summaryStepNumber = document.getElementById('summary-step-number');
        if (summaryStepNumber) {
            summaryStepNumber.textContent = String(totalSteps).padStart(2, '0');
        }

        // Exibe o primeiro passo
        goToStep(1);
    }

    // ==========================================================================
    // CONTROLE DE FLUXO & NAVEGAÇÃO ENTRE PASSOS
    // ==========================================================================
    function goToStep(stepNumber) {
        // Oculta todas as telas/etapas
        const allSteps = document.querySelectorAll('.step-card');
        allSteps.forEach(card => {
            card.classList.remove('active');
            card.style.display = 'none';
        });

        // Exibe a etapa pretendida
        if (stepNumber <= totalSteps) {
            const activeCard = document.querySelector(`.step-card[data-step="${stepNumber}"]`);
            if (activeCard) {
                activeCard.classList.add('active');
                activeCard.style.display = 'block';
                
                // Se for a etapa final (resumo), renderiza os dados coletados
                if (stepNumber === totalSteps) {
                    renderSummaryData();
                }
            }
        }

        currentStep = stepNumber;

        // Atualiza a barra de progresso
        updateProgressBar();

        // Controla status dos botões de controle de fluxo
        if (currentStep === 1) {
            btnBack.disabled = true;
        } else {
            btnBack.disabled = false;
        }

        // Altera o rótulo do botão principal de avanço
        if (currentStep === totalSteps) {
            btnNext.innerHTML = `
                Finalizar Checklist
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
            btnNext.style.background = 'linear-gradient(135deg, var(--color-success) 0%, #00b0ff 100%)';
            btnNext.style.boxShadow = '0 4px 15px var(--color-success-glow)';
        } else {
            btnNext.innerHTML = `
                Próximo
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                </svg>
            `;
            btnNext.style.background = ''; // Retorna ao padrão definido no CSS
            btnNext.style.boxShadow = '';
        }
    }

    function updateProgressBar() {
        // Se estivermos na tela de sucesso final, não exibimos ou preenchemos a barra em 100%
        if (successStep.style.display === 'block') {
            progressStepText.textContent = "CONCLUÍDO";
            progressPercentage.textContent = "100%";
            progressFill.style.width = "100%";
            return;
        }

        // Calcula porcentagem do progresso baseado no passo ativo
        const pct = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
        progressPercentage.textContent = `${pct}%`;
        progressFill.style.width = `${pct}%`;

        // Altera texto descritivo
        if (currentStep <= fixedStepsCount) {
            progressStepText.textContent = `Identificação - Passo ${currentStep} de ${totalSteps}`;
        } else if (currentStep <= fixedStepsCount + checklistQuestions.length) {
            progressStepText.textContent = `Itens do Veículo - Passo ${currentStep} de ${totalSteps}`;
        } else if (currentStep === totalSteps - 1) {
            progressStepText.textContent = `Notas de Turno - Passo ${currentStep} de ${totalSteps}`;
        } else {
            progressStepText.textContent = `Revisão Geral - Passo ${currentStep} de ${totalSteps}`;
        }
    }

    // ==========================================================================
    // VALIDAÇÃO DE CAMPOS E ENTRADA DO OPERADOR
    // ==========================================================================
    function validateCurrentStep() {
        let isValid = true;
        
        // Remove mensagens de erro ativas da etapa
        const activeCard = document.querySelector(`.step-card[data-step="${currentStep}"]`);
        if (!activeCard && currentStep !== totalSteps) return false;

        if (currentStep === 1) {
            const inputMatricula = document.getElementById('matricula');
            const val = inputMatricula.value.trim();
            const error = document.getElementById('error-matricula');
            
            // Aceita matrículas com pelo menos 3 caracteres alfanuméricos
            if (val.length < 3) {
                error.style.display = 'flex';
                inputMatricula.focus();
                isValid = false;
            } else {
                error.style.display = 'none';
                state.matricula = val;
            }
        }
        else if (currentStep === 2) {
            const inputNome = document.getElementById('nome');
            const val = inputNome.value.trim();
            const error = document.getElementById('error-nome');

            // Exige nome completo mínimo
            if (val.length < 3 || !val.includes(' ')) {
                error.style.display = 'flex';
                inputNome.focus();
                isValid = false;
            } else {
                error.style.display = 'none';
                state.nome = val;
            }
        }
        else if (currentStep === 3) {
            const inputData = document.getElementById('data-inspecao');
            const val = inputData.value;
            const error = document.getElementById('error-data-inspecao');

            if (!val) {
                error.style.display = 'flex';
                isValid = false;
            } else {
                error.style.display = 'none';
                state.data = val;
            }
        }
        else if (currentStep === 4) {
            const selectTurno = document.getElementById('turno');
            const val = selectTurno.value;
            const error = document.getElementById('error-turno');

            if (!val) {
                error.style.display = 'flex';
                isValid = false;
            } else {
                error.style.display = 'none';
                state.turno = val;
            }
        }
        else if (currentStep === 5) {
            const val = selectFrota.value;
            const error = document.getElementById('error-frota');

            if (!val || frotaSearch.value !== val) {
                error.style.display = 'flex';
                if (frotaSearch) frotaSearch.focus();
                isValid = false;
            } else {
                error.style.display = 'none';
                state.frota = val;
            }
        }
        else if (currentStep > fixedStepsCount && currentStep <= fixedStepsCount + checklistQuestions.length) {
            // Valida as etapas dinâmicas de perguntas
            const questionId = activeCard.getAttribute('data-question-id');
            const answer = state.answers[questionId];
            const error = document.getElementById(`error-q-${questionId}`);

            if (!answer || !answer.value) {
                error.style.display = 'flex';
                isValid = false;
            } else {
                error.style.display = 'none';
            }
        }
        else if (currentStep === totalSteps - 1) {
            // Passo de passagem de turno (opcional, sempre válido)
            state.nextShiftNotes = nextShiftObs.value.trim();
        }
        else if (currentStep === totalSteps) {
            // Valida o aceite da declaração final no resumo
            const checkbox = document.getElementById('confirm-declaration');
            const error = document.getElementById('error-confirm');

            if (!checkbox.checked) {
                error.style.display = 'flex';
                isValid = false;
            } else {
                error.style.display = 'none';
                state.declarationConfirmed = true;
            }
        }

        return isValid;
    }

    // ==========================================================================
    // RENDERIZAÇÃO DO RESUMO E PROCESSAMENTO FINAL
    // ==========================================================================
    function renderSummaryData() {
        // Preenche campos de identificação
        if (sumData) {
            const dateParts = state.data.split('-');
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : state.data;
            sumData.textContent = formattedDate;
        }
        sumMatricula.textContent = state.matricula;
        sumNome.textContent = state.nome;
        sumTurno.textContent = state.turno;
        sumFrota.textContent = state.frota;

        // Limpa lista de checklist
        sumChecklistList.innerHTML = '';

        // Cria a visualização para cada item inspecionado
        checklistQuestions.forEach(question => {
            const answerObj = state.answers[question.id] || { value: 'Não respondido', details: '' };
            const row = document.createElement('div');
            row.className = 'summary-check-row';

            const badgeClass = answerObj.value === 'Sim' ? 'yes' : 'no';
            
            let detailsHtml = '';
            if (answerObj.details && answerObj.details.trim() !== '') {
                detailsHtml = `<span class="sum-question-details">Nota: "${answerObj.details}"</span>`;
            }

            row.innerHTML = `
                <div class="sum-question-info">
                    <span class="sum-question-title">${question.title}</span>
                    ${detailsHtml}
                </div>
                <span class="sum-answer-badge ${badgeClass}">${answerObj.value}</span>
            `;

            sumChecklistList.appendChild(row);
        });
    }

    async function processFinalSubmission() {
        // Desabilita o botão e mostra indicador de loading
        btnNext.disabled = true;
        btnNext.innerHTML = `
            Salvando...
            <svg class="btn-icon spinner" style="animation: spin 1s linear infinite;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
        `;

        // Verifica se há alguma resposta "Não" (que indica falha no veículo)
        const hasFailures = Object.values(state.answers).some(ans => ans.value === 'Não');
        const checklistStatus = hasFailures ? 'Atenção / Manutenção' : 'Aprovado para Uso';
        
        // Gera um ID de registro randômico
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const checklistIdGenerated = `CK-${randomNum}`;

        try {
            // Salva os dados no banco de dados do Firebase Firestore
            await addDoc(collection(db, "checklists"), {
                checklistId: checklistIdGenerated,
                matricula: state.matricula,
                nome: state.nome,
                data: state.data,
                turno: state.turno,
                frota: state.frota,
                status: checklistStatus,
                answers: state.answers,
                nextShiftNotes: state.nextShiftNotes,
                timestamp: serverTimestamp()
            });

            // Oculta todas as etapas e exibe apenas a de sucesso
            const allSteps = document.querySelectorAll('.step-card');
            allSteps.forEach(card => {
                card.classList.remove('active');
                card.style.display = 'none';
            });

            navControls.style.display = 'none';
            
            // Define o status do veículo no recibo final
            if (hasFailures) {
                receiptStatus.textContent = 'Atenção / Manutenção';
                receiptStatus.className = 'status-badge atencao';
            } else {
                receiptStatus.textContent = 'Aprovado para Uso';
                receiptStatus.className = 'status-badge aprovado';
            }

            receiptId.textContent = `#CK-${randomNum}`;

            // Obtém data e hora corrente do sistema
            const options = { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            };
            const dateStr = new Date().toLocaleDateString('pt-BR', options);
            receiptDate.textContent = dateStr;

            // Preenche Frota no recibo
            receiptVehicle.textContent = state.frota;

            // Exibe a tela de sucesso
            successStep.classList.add('active');
            successStep.style.display = 'block';
            updateProgressBar();

        } catch (error) {
            console.error("Erro ao salvar no Firestore: ", error);
            alert("Erro ao enviar dados para o banco de dados. Por favor, verifique sua conexão de rede e tente novamente.");
            
            // Restaura o estado do botão para permitir nova tentativa
            btnNext.disabled = false;
            btnNext.innerHTML = `
                Finalizar Checklist
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
        }
    }

    // ==========================================================================
    // EVENTOS DE ESCUTA DOS BOTÕES DE NAVEGAÇÃO
    // ==========================================================================
    btnNext.addEventListener('click', async () => {
        if (validateCurrentStep()) {
            if (currentStep < totalSteps) {
                goToStep(currentStep + 1);
            } else if (currentStep === totalSteps) {
                // Último passo (Resumo) finalizado com sucesso
                await processFinalSubmission();
            }
        }
    });

    btnBack.addEventListener('click', () => {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        }
    });

    // ==========================================================================
    // REINICIALIZAR FORMULÁRIO (NOVO CHECKLIST)
    // ==========================================================================
    btnRestart.addEventListener('click', () => {
        // Limpa estado
        state.matricula = '';
        state.nome = '';
        state.data = '';
        state.turno = '';
        state.frota = '';
        state.answers = {};
        state.declarationConfirmed = false;
        state.nextShiftNotes = '';

        // Reseta Inputs no HTML
        document.getElementById('matricula').value = '';
        document.getElementById('nome').value = '';
        const inputData = document.getElementById('data-inspecao');
        if (inputData) {
            inputData.value = new Date().toISOString().split('T')[0];
            state.data = inputData.value;
        }
        document.getElementById('turno').selectedIndex = 0;
        document.getElementById('frota').selectedIndex = 0;
        if (frotaSearch) frotaSearch.value = '';
        state.modelo = '';
        document.getElementById('confirm-declaration').checked = false;
        nextShiftObs.value = '';

        // Oculta alertas de turno anterior
        prevShiftNotesContainer.style.display = 'none';
        prevShiftNotesText.textContent = '-';
        prevShiftNotesMeta.textContent = '-';

        // Oculta tela de sucesso e exibe formulário principal
        successStep.style.display = 'none';
        nextShiftStep.style.display = 'none';
        summaryStep.style.display = 'none';
        
        form.style.display = 'block';
        navControls.style.display = 'flex';

        // Reconstrói e reinicia do passo 1
        initializeChecklist();
    });

    // ==========================================================================
    // EXPORTAR RELATÓRIO / IMPRESSÃO FORMATADA (PDF)
    // ==========================================================================
    btnDownloadReport.addEventListener('click', () => {
        // Cria uma tela de impressão customizada temporária, garantindo um design corporativo premium
        const printWindow = window.open('', '_blank');
        
        // Verifica se há alguma falha
        const hasFailures = Object.values(state.answers).some(ans => ans.value === 'Não');
        const statusLabel = hasFailures ? 'REQUER MANUTENÇÃO' : 'APROVADO PARA USO';
        const statusColor = hasFailures ? '#ff1744' : '#00e676';
        
        // Constrói linhas das perguntas
        let questionsRowsHtml = '';
        checklistQuestions.forEach((q, idx) => {
            const ans = state.answers[q.id] || { value: 'Não respondido', details: '' };
            const detailsText = ans.details ? `<div style="font-size: 11px; color: #555; margin-top: 3px; font-style: italic;">Observações: "${ans.details}"</div>` : '';
            
            questionsRowsHtml += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #333;">${String(idx+1).padStart(2, '0')}</td>
                    <td style="padding: 10px; font-size: 12px;">
                        <div><strong>${q.category}</strong>: ${q.title}</div>
                        ${detailsText}
                    </td>
                    <td style="padding: 10px; font-size: 12px; font-weight: bold; text-align: center; color: ${ans.value === 'Sim' ? '#2e7d32' : '#c62828'};">
                        ${ans.value}
                    </td>
                </tr>
            `;
        });

        // HTML Completo do relatório a ser impresso
        const reportHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Inspeção - ${state.frota}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; margin: 30px; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #111; padding-bottom: 15px; margin-bottom: 25px; }
                    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
                    .header .logo { font-size: 18px; color: #0288d1; font-weight: bold; }
                    .metadata-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                    .metadata-table td { padding: 8px; border: 1px solid #eee; font-size: 13px; }
                    .metadata-table td.label { font-weight: bold; background-color: #f7f9fa; width: 25%; }
                    .status-box { text-align: center; padding: 15px; border-radius: 8px; border: 2px solid ${statusColor}; background-color: ${statusColor}10; margin-bottom: 25px; }
                    .status-box h2 { margin: 0; font-size: 16px; color: ${statusColor}; text-transform: uppercase; letter-spacing: 2px; }
                    .table-checklist { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    .table-checklist th { background-color: #111; color: white; padding: 10px; font-size: 12px; text-transform: uppercase; text-align: left; }
                    .table-checklist td { border-bottom: 1px solid #eee; }
                    .footer-signature { margin-top: 50px; display: flex; justify-content: space-between; gap: 40px; }
                    .sig-line { border-top: 1px solid #666; width: 45%; text-align: center; padding-top: 8px; font-size: 11px; color: #555; margin-top: 40px; }
                    @media print {
                        body { margin: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div style="text-align: right; margin-bottom: 15px;">
                    <button onclick="window.print();" style="padding: 8px 16px; background-color: #111; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Imprimir Relatório</button>
                </div>
                
                <div class="header">
                    <div>
                        <div class="logo">CHECKLIST CENTRAL</div>
                        <h1>RELATÓRIO DE INSPEÇÃO DE EQUIPAMENTO</h1>
                    </div>
                    <div style="text-align: right; font-size: 12px; color: #666;">
                        <strong>ID:</strong> ${receiptId.textContent}<br>
                        <strong>Data:</strong> ${receiptDate.textContent}
                    </div>
                </div>

                <div class="status-box">
                    <h2>STATUS DO VEÍCULO: ${statusLabel}</h2>
                </div>

                <table class="metadata-table">
                    <tr>
                        <td class="label">Operador:</td>
                        <td>${state.nome}</td>
                        <td class="label">Matrícula:</td>
                        <td>${state.matricula}</td>
                    </tr>
                    <tr>
                        <td class="label">Equipamento/Frota:</td>
                        <td>${state.frota}</td>
                        <td class="label">Turno:</td>
                        <td>${state.turno}</td>
                    </tr>
                </table>

                <h3 style="font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 5px; margin-bottom: 15px;">Itens Verificados</h3>
                
                <table class="table-checklist">
                    <thead>
                        <tr>
                            <th style="width: 50px;">Item</th>
                            <th>Descrição da Inspeção</th>
                            <th style="width: 100px; text-align: center;">Resultado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${questionsRowsHtml}
                    </tbody>
                </table>

                <div style="font-size: 11px; color: #555; background: #f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #e0e0e0;">
                    <strong>Declaração do Operador:</strong> "Declaro que realizei a inspeção visual e física deste veículo e as informações acima são verdadeiras." - <em>Confirmado eletronicamente via sistema Checklist Central.</em>
                </div>

                <div class="footer-signature">
                    <div class="sig-line">
                        ${state.nome}<br>
                        Assinatura do Operador
                    </div>
                    <div class="sig-line">
                        Assinatura da Supervisão / Manutenção
                    </div>
                </div>

                <script>
                    // Abre caixa de diálogo de impressão automaticamente após carregar
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 300);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(reportHtml);
        printWindow.document.close();
    });

    // Escuta a seleção de frota para buscar as notas do turno anterior
    if (selectFrota) {
        selectFrota.addEventListener('change', async (e) => {
            const selectedVehicle = e.target.value;
            const selectedOption = selectFrota.options[selectFrota.selectedIndex];
            state.modelo = selectedOption ? (selectedOption.getAttribute('data-modelo') || 'Inspeção Diária') : 'Inspeção Diária';

            if (!selectedVehicle) {
                prevShiftNotesContainer.style.display = 'none';
                return;
            }

            // Oculta e reseta o container enquanto busca
            prevShiftNotesContainer.style.display = 'none';
            prevShiftNotesText.textContent = '-';
            prevShiftNotesMeta.textContent = '-';

            try {
                // Consulta no Firestore pelo último checklist da frota selecionada
                // Para evitar a necessidade de criar índices compostos no console do Firebase,
                // filtramos por frota e depois ordenamos localmente pelo timestamp em JS.
                const q = query(
                    collection(db, "checklists"), 
                    where("frota", "==", selectedVehicle)
                );
                
                const querySnapshot = await getDocs(q);
                const documents = [];
                
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.nextShiftNotes && data.nextShiftNotes.trim() !== '') {
                        documents.push({
                            notes: data.nextShiftNotes,
                            nome: data.nome || 'Operador',
                            matricula: data.matricula || '-',
                            turno: data.turno || '-',
                            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(0)
                        });
                    }
                });

                if (documents.length > 0) {
                    // Ordena pelo timestamp decrescente (mais recente primeiro)
                    documents.sort((a, b) => b.timestamp - a.timestamp);
                    
                    const latestDoc = documents[0];
                    
                    // Preenche os dados no HTML e exibe
                    prevShiftNotesText.textContent = `"${latestDoc.notes}"`;
                    
                    // Formata a data para exibição amigável
                    const dateOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
                    const formattedDate = latestDoc.timestamp.toLocaleDateString('pt-BR', dateOptions);
                    
                    prevShiftNotesMeta.textContent = `Operador: ${latestDoc.nome} (Mat. ${latestDoc.matricula}) | Turno: ${latestDoc.turno} (${formattedDate})`;
                    prevShiftNotesContainer.style.display = 'flex';
                }
            } catch (error) {
                console.error("Erro ao buscar notas do turno anterior:", error);
            }
        });
    }

    // Evento de clique para compartilhar no whatsapp
    if (btnShareWhatsapp) {
        btnShareWhatsapp.addEventListener('click', shareBulletinOnWhatsapp);
    }

    function populateBulletinTemplate() {
        // Date
        document.getElementById('bulletin-date').textContent = new Date().toLocaleDateString('pt-BR');
        
        // Fleet
        document.getElementById('bulletin-frota').textContent = state.frota;
        
        // Model
        document.getElementById('bulletin-modelo').textContent = state.modelo || 'Inspeção Diária';

        // Reset all driver and matrícula fields
        document.getElementById('bulletin-driver-a').textContent = '-';
        document.getElementById('bulletin-driver-b').textContent = '-';
        document.getElementById('bulletin-driver-c').textContent = '-';
        document.getElementById('bulletin-mat-a').textContent = '-';
        document.getElementById('bulletin-mat-b').textContent = '-';
        document.getElementById('bulletin-mat-c').textContent = '-';

        // Reset conditions and notes
        document.getElementById('bulletin-cond-a').textContent = '( ) SIM  ( ) NÃO';
        document.getElementById('bulletin-cond-b').textContent = '( ) SIM  ( ) NÃO';
        document.getElementById('bulletin-cond-c').textContent = '( ) SIM  ( ) NÃO';
        document.getElementById('bulletin-note-a').textContent = '-';
        document.getElementById('bulletin-note-b').textContent = '-';
        document.getElementById('bulletin-note-c').textContent = '-';

        // Active Turn Fill
        const isTurnoA = state.turno === 'Turno A';
        const isTurnoB = state.turno === 'Turno B';
        const isTurnoC = state.turno === 'Turno C';

        if (isTurnoA) {
            document.getElementById('bulletin-driver-a').textContent = state.nome;
            document.getElementById('bulletin-mat-a').textContent = state.matricula;
            document.getElementById('bulletin-note-a').textContent = state.nextShiftNotes || 'Veículo em bom estado, sem ocorrências.';
        } else if (isTurnoB) {
            document.getElementById('bulletin-driver-b').textContent = state.nome;
            document.getElementById('bulletin-mat-b').textContent = state.matricula;
            document.getElementById('bulletin-note-b').textContent = state.nextShiftNotes || 'Veículo em bom estado, sem ocorrências.';
        } else if (isTurnoC) {
            document.getElementById('bulletin-driver-c').textContent = state.nome;
            document.getElementById('bulletin-mat-c').textContent = state.matricula;
            document.getElementById('bulletin-note-c').textContent = state.nextShiftNotes || 'Veículo em bom estado, sem ocorrências.';
        }

        // Equipment in working conditions SIM/NÃO
        const hasFailures = Object.values(state.answers).some(ans => ans.value === 'Não');
        const condText = hasFailures ? '( ) SIM  ( X ) NÃO' : '( X ) SIM  ( ) NÃO';

        if (isTurnoA) document.getElementById('bulletin-cond-a').textContent = condText;
        else if (isTurnoB) document.getElementById('bulletin-cond-b').textContent = condText;
        else if (isTurnoC) document.getElementById('bulletin-cond-c').textContent = condText;

        // Operator Signature
        document.getElementById('bulletin-sig-operator').textContent = state.nome;

        // Inspection Rows Table
        const rowsContainer = document.getElementById('bulletin-inspection-rows');
        rowsContainer.innerHTML = '';

        checklistQuestions.forEach(q => {
            const answerObj = state.answers[q.id] || { value: 'Sim', details: '' };
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #000';

            const yesMark = answerObj.value === 'Sim' ? 'X' : '';
            const noMark = answerObj.value === 'Não' ? 'X' : '';

            row.innerHTML = `
                <td style="border: 1px solid #000; padding: 5px; font-weight: bold; text-transform: uppercase;">${q.title}</td>
                
                <!-- Turno A columns -->
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 11px;">${isTurnoA ? yesMark : ''}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 11px;">${isTurnoA ? noMark : ''}</td>
                
                <!-- Turno B columns -->
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 11px;">${isTurnoB ? yesMark : ''}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 11px;">${isTurnoB ? noMark : ''}</td>
                
                <!-- Turno C columns -->
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 11px;">${isTurnoC ? yesMark : ''}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 11px;">${isTurnoC ? noMark : ''}</td>
                
                <!-- Observation column -->
                <td style="border: 1px solid #000; padding: 5px; font-size: 9px; font-style: italic; word-break: break-word; max-width: 150px;">${answerObj.details || ''}</td>
            `;

            rowsContainer.appendChild(row);
        });
    }

    async function shareBulletinOnWhatsapp() {
        // Primeiro popula o template do boletim
        populateBulletinTemplate();

        const captureElement = document.getElementById('bulletin-capture-template');
        captureElement.style.display = 'block'; // Torna temporariamente visível para o html2canvas renderizar

        // Mostra loading no botão de compartilhar
        const originalBtnContent = btnShareWhatsapp.innerHTML;
        btnShareWhatsapp.disabled = true;
        btnShareWhatsapp.innerHTML = `
            Gerando Boletim...
            <svg class="btn-icon spinner" style="animation: spin 1s linear infinite;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
        `;

        try {
            // Renderiza com html2canvas
            const canvas = await html2canvas(captureElement, {
                useCORS: true,
                scale: 2 // Aumenta a qualidade da imagem capturada
            });
            
            captureElement.style.display = 'none'; // Oculta novamente

            // Converte o canvas para Blob de imagem PNG
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    throw new Error("Erro ao converter canvas para blob.");
                }

                const file = new File([blob], `boletim_${state.frota.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
                
                // Texto amigável para enviar junto
                const hasFailures = Object.values(state.answers).some(ans => ans.value === 'Não');
                const statusEmoji = hasFailures ? '⚠️ ATENÇÃO / MANUTENÇÃO' : '✅ APROVADO PARA USO';
                
                const shareText = `*Checklist Diário Obrigatório - Checklist Central*\n` +
                                  `• *Veículo:* ${state.frota}\n` +
                                  `• *Operador:* ${state.nome} (Mat. ${state.matricula})\n` +
                                  `• *Turno:* ${state.turno}\n` +
                                  `• *Status:* ${statusEmoji}\n` +
                                  `• *Obs:* ${state.nextShiftNotes || 'Sem observações.'}`;

                // Tenta usar a Web Share API (compartilhamento nativo no celular)
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Boletim de Inspeção Diária',
                            text: shareText
                        });
                        console.log("Compartilhamento realizado com sucesso.");
                    } catch (shareError) {
                        console.log("Erro ou cancelamento no compartilhamento nativo:", shareError);
                        // Fallback em caso de erro no Share (ex: cancelou)
                        downloadAndOpenWhatsapp(blob, shareText);
                    }
                } else {
                    // Fallback para computadores / navegadores que não suportam Web Share API
                    downloadAndOpenWhatsapp(blob, shareText);
                }

                // Restaura o botão de compartilhar
                btnShareWhatsapp.disabled = false;
                btnShareWhatsapp.innerHTML = originalBtnContent;

            }, 'image/png');

        } catch (error) {
            console.error("Erro na geração do boletim:", error);
            captureElement.style.display = 'none';
            alert("Erro ao gerar imagem do boletim. O relatório de texto será enviado.");
            
            // Fallback de texto puro
            const shareText = `*Checklist Diário Obrigatório - Checklist Central*\n` +
                              `• *Veículo:* ${state.frota}\n` +
                              `• *Operador:* ${state.nome} (Mat. ${state.matricula})\n` +
                              `• *Turno:* ${state.turno}\n` +
                              `• *Obs:* ${state.nextShiftNotes || 'Sem observações.'}`;
                              
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
            
            btnShareWhatsapp.disabled = false;
            btnShareWhatsapp.innerHTML = originalBtnContent;
        }
    }

    function downloadAndOpenWhatsapp(blob, shareText) {
        // Faz o download da imagem automaticamente para o usuário
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boletim_${state.frota.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("O boletim de imagem foi baixado no seu dispositivo. Agora, o WhatsApp será aberto para você selecionar o contato e colar/anexar a imagem!");

        // Abre o WhatsApp com a mensagem formatada em texto
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        window.open(whatsappUrl, '_blank');
    }

    // ==========================================================================
    // CONTROLES DO DROPDOWN BUSCA DE FROTA
    // ==========================================================================
    function selectVehicleFromDropdown(name, model) {
        if (!frotaSearch || !selectFrota) return;

        frotaSearch.value = name;
        selectFrota.value = name;
        state.frota = name;
        state.modelo = model;

        // Dispara evento change no select real para disparar busca de notas de turno
        const event = new Event('change', { bubbles: true });
        selectFrota.dispatchEvent(event);

        closeFrotaDropdown();
    }

    function filterFrotaDropdown() {
        if (!frotaSearch || !dropdownList) return;
        const queryText = frotaSearch.value.toLowerCase().trim();
        const items = dropdownList.querySelectorAll('.custom-dropdown-item');
        let hasMatches = false;

        items.forEach(item => {
            const val = item.getAttribute('data-value').toLowerCase();
            const mod = item.getAttribute('data-modelo').toLowerCase();
            if (val.includes(queryText) || mod.includes(queryText)) {
                item.style.display = 'flex';
                hasMatches = true;
            } else {
                item.style.display = 'none';
            }
        });

        // Exibe mensagem de vazio
        const noMatchDiv = dropdownList.querySelector('.no-matches-found');
        if (!hasMatches) {
            if (!noMatchDiv) {
                const empty = document.createElement('div');
                empty.className = 'no-matches-found';
                empty.style.cssText = 'padding: 12px; color: var(--text-muted); text-align: center; font-size: 0.85rem;';
                empty.textContent = 'Nenhum veículo encontrado';
                dropdownList.appendChild(empty);
            }
        } else {
            if (noMatchDiv) {
                noMatchDiv.remove();
            }
        }
    }

    function openFrotaDropdown() {
        if (!dropdownList || !dropdownTrigger) return;
        dropdownList.style.display = 'block';
        dropdownTrigger.classList.add('active');
        filterFrotaDropdown();
    }

    function closeFrotaDropdown() {
        if (!dropdownList || !dropdownTrigger) return;
        dropdownList.style.display = 'none';
        dropdownTrigger.classList.remove('active');
    }

    function setupFrotaDropdownEvents() {
        if (!frotaSearch || !dropdownTrigger) return;

        // Ao focar ou clicar no input, abre
        frotaSearch.addEventListener('focus', openFrotaDropdown);
        frotaSearch.addEventListener('click', openFrotaDropdown);

        // Ao digitar, filtra
        frotaSearch.addEventListener('input', () => {
            openFrotaDropdown();
            filterFrotaDropdown();
            
            // Reseta o select real caso digite e quebre a correspondência direta
            const match = Array.from(selectFrota.options).some(opt => opt.value === frotaSearch.value);
            if (!match) {
                selectFrota.value = '';
                state.frota = '';
            }
        });

        // Botão de trigger
        dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownList.style.display === 'block') {
                closeFrotaDropdown();
            } else {
                frotaSearch.focus();
            }
        });

        // Fechar se clicar fora do container
        document.addEventListener('click', (e) => {
            const container = document.getElementById('frota-dropdown-container');
            if (container && !container.contains(e.target)) {
                closeFrotaDropdown();
                
                // Se fechou e o texto digitado não é um veículo válido da lista, limpa o campo
                const match = Array.from(selectFrota.options).find(opt => opt.value === frotaSearch.value);
                if (!match && frotaSearch.value !== '') {
                    frotaSearch.value = '';
                    selectFrota.value = '';
                    state.frota = '';
                    // Dispara change para limpar observações antigas se houver
                    const event = new Event('change', { bubbles: true });
                    selectFrota.dispatchEvent(event);
                }
            }
        });
    }

    // Chama o setup
    setupFrotaDropdownEvents();

    // Inicializa o checklist
    initializeChecklist();
});
