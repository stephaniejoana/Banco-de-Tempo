


// ================= 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO SUPABASE E ESTADO GLOBAL =================

const SUPABASE_URL = 'https://ceaqvwylgnhcajzxcjqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QsgrGC9not0FVNUbz8l3lw_QzAqM--j';

let supabaseClient = null;
let myCourses = [];
let vagasDatabase = [];
let userSession = null;
let isSubmittingVaga = false;

const categoriesList = ["Tecnologia", "Idiomas", "Educação", "Artes", "Música", "Culinária", "Organização", "Manutenção"];

const backupVagas = [
    { id: 1, title: "Mentoria de Programação Python", type: "Oferece", category: "Tecnologia", modality: "Remoto", hours: 1, description: "Ajudo com sintaxe, lógica de programação e scripts em Python.", user: { name: "Stephanie Santos", city: "Aracaju - SE", avatar: "SS" } },
    { id: 2, title: "Aulas de Conversação em Inglês", type: "Oferece", category: "Idiomas", modality: "Remoto", hours: 1, description: "Prática de conversação do dia a dia para nível intermediário.", user: { name: "Lucas Gabriel", city: "São Paulo - SP", avatar: "LG" } },
    { id: 3, title: "Preciso de ajuda com Design no Canva", type: "Procura", category: "Artes", modality: "Remoto", hours: 2, description: "Procuro alguém para me ensinar truques de edição e postagens para redes sociais.", user: { name: "Mariana Costa", city: "Salvador - BA", avatar: "MC" } }
];

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    try {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            return supabaseClient;
        }
    } catch (err) {
        console.warn("Aviso ao inicializar cliente do Supabase:", err);
    }
    return null;
}

// ================= 2. BUSCAR CURSOS DO BANCO DE DADOS =================

async function fetchCoursesFromDB() {
    const spinner = document.getElementById('loading-spinner');
    const grid = document.getElementById('courses-list-grid');

    if (spinner) spinner.classList.remove('hidden');

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não carregado.");

        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError || !session || !session.user) {
            console.warn("Nenhum utilizador logado.");
            if (grid) grid.innerHTML = "<p style='text-align:center; padding: 20px;'>Faça login para ver os seus cursos.</p>";
            return; 
        }

        const meuUsuarioId = session.user.id;

  
        const { data, error } = await supabaseClient
            .from('courses')
            .select('*')
            .eq('user_id', meuUsuarioId) 
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 3. Verifica se tem cursos 
        if (!data || data.length === 0) {
            if (grid) {
                grid.classList.remove('hidden');
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; margin: 20px 0;">
                        <div style="font-size: 3rem; margin-bottom: 10px;">📖</div>
                        <h3 style="font-size: 1.2rem; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Nenhum curso cadastrado ainda</h3>
                        <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 20px;">Você ainda não publicou nenhum curso no Banco de Tempo.</p>
                        <button onclick="openModal('modal-novo-curso')" style="background: #0284c7; color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                            + Criar Meu Primeiro Curso
                        </button>
                    </div>
                `;
            }
            return;
        }

        myCourses = data;
        renderCoursesDashboard();

    } catch (err) {
        console.error("Erro ao buscar cursos do painel:", err);
        if (typeof showToast === 'function') showToast("Erro ao carregar seus cursos.", "error");
    } finally {
        if (spinner) spinner.classList.add('hidden');
        if (grid) grid.classList.remove('hidden');
    }
}

// ================= 3. SALVAR OU ATUALIZAR CURSO NO BANCO DE DADOS =================
async function handleSaveCourse(e) {
    if (e) e.preventDefault();

    const btnSave = document.getElementById('btn-save-submit');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    }

    const editingId = document.getElementById('editing-course-id')?.value;
    const title = document.getElementById('input-title')?.value;
    const category = document.getElementById('input-category')?.value;
    const hours = parseInt(document.getElementById('input-hours')?.value || "1", 10);
    const summary = document.getElementById('input-summary')?.value;

    try {
        if (!supabaseClient) throw new Error("Cliente Supabase não carregado.");

        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError || !session || !session.user) {
            throw new Error("Você precisa estar logado para salvar um curso.");
        }

        const coursePayload = { 
            title, 
            category, 
            hours, 
            summary,
            user_id: session.user.id 
        };

        if (editingId) {
            const { error } = await supabaseClient
                .from('courses')
                .update(coursePayload)
                .eq('id', editingId)
                .eq('user_id', session.user.id);

            if (error) throw error;
            if (typeof showToast === 'function') showToast("Curso atualizado com sucesso!", "success");
        } else {
            const { error } = await supabaseClient
                .from('courses')
                .insert([coursePayload]);

            if (error) throw error;
            if (typeof showToast === 'function') showToast("Curso publicado com sucesso!", "success");
        }

        if (typeof closeModal === 'function') closeModal('modal-novo-curso');
        fetchCoursesFromDB();

    } catch (err) {
        console.error("Erro ao salvar curso:", err);
        if (typeof showToast === 'function') showToast(err.message || "Erro ao salvar curso.", "error");
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Curso`;
        }
    }
}


// ================= 4. INICIALIZAÇÃO DA PÁGINA =================
document.addEventListener("DOMContentLoaded", () => {
    getSupabaseClient();
    renderCategoryFilters();
    setupEventListeners();
    loadVagasWithTimeout();
    checkUserSession();
});

// ================= 5. AUTENTICAÇÃO E SESSÃO =================
async function checkUserSession() {
    const client = getSupabaseClient();
    if (!client) {
        localStorage.removeItem('logged_user_email');
        updateLoggedOutUI();
        return;
    }

    try {
        const { data: { session } } = await client.auth.getSession();

        if (session && session.user) {
            userSession = session.user;
            localStorage.setItem('logged_user_email', session.user.email); 
            updateLoggedInUI(session.user);

            if (window.location.pathname.includes('login.html')) {
                window.location.href = '/projeto/index.html';
            }
        } else {
            userSession = null;
            localStorage.removeItem('logged_user_email'); 
            updateLoggedOutUI();
        }

        client.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                userSession = session.user;
                localStorage.setItem('logged_user_email', session.user.email); 
                updateLoggedInUI(session.user);
            } else {
                userSession = null;
                localStorage.removeItem('logged_user_email'); 
                updateLoggedOutUI();
            }
        });

    } catch (err) {
        console.warn("Erro ao verificar sessão:", err);
        localStorage.removeItem('logged_user_email');
        updateLoggedOutUI();
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();

    const email = document.getElementById("login-email")?.value;
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) {
        showToast("Preencha e-mail e senha.");
        return;
    }

    try {
        const client = getSupabaseClient();
        if (client) {
            const { data, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                showToast("Erro ao entrar: " + error.message);
                return;
            }

            if (data?.user) {
                userSession = data.user;
                localStorage.setItem('logged_user_email', data.user.email); 
                updateLoggedInUI(data.user);
                showToast("Bem-vindo(a) de volta!");

                if (window.location.pathname.includes('login.html')) {
                    window.location.href = '/projeto/index.html';
                } else {
                    closeModal("modal-login");
                }
            }
        } else {
            showToast("Serviço de autenticação indisponível no momento.");
        }
    } catch (err) {
        console.error("Erro no login:", err);
        showToast("Erro de conexão ao realizar login.");
    }
}

async function handleRegister(e) {
    if (e) e.preventDefault();

    const submitBtn = document.querySelector("#form-register button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;

    const name = document.getElementById("reg-name")?.value;
    const email = document.getElementById("reg-email")?.value;
    const password = document.getElementById("reg-password")?.value;

    if (!name || !email || !password) {
        showToast("Preencha todos os campos para se cadastrar.");
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    try {
        const client = getSupabaseClient();
        if (client) {
            const { data, error } = await client.auth.signUp({
                email: email,
                password: password,
                options: { data: { full_name: name } }
            });

            if (error) {
                showToast("Erro ao cadastrar: " + error.message);
                return;
            }

            if (data?.user) {
                userSession = data.user;
                localStorage.setItem('logged_user_email', data.user.email); 
                updateLoggedInUI(data.user);
                showToast(`Conta criada com sucesso! Bem-vindo(a), ${escapeHTML(name)}!`);

                if (window.location.pathname.includes('login.html')) {
                    window.location.href = '/projeto/index.html';
                } else {
                    closeModal("modal-login");
                }
            }
        } else {
            showToast("Serviço de cadastro indisponível no momento.");
        }
    } catch (err) {
        console.error("Erro no cadastro:", err);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleLogout() {
    const client = getSupabaseClient();
    if (client) {
        await client.auth.signOut();
    }
    userSession = null;
    localStorage.removeItem('logged_user_email'); 
    updateLoggedOutUI();
    showToast("Você saiu da sua conta.");
}

async function handleGoogleLogin() {
    const client = getSupabaseClient();
    if (!client) {
        showToast("Integração com Google temporariamente indisponível.");
        return;
    }

    try {
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/projeto/index.html'
            }
        });

        if (error) {
            showToast("Erro ao entrar com Google: " + error.message);
        }
    } catch (err) {
        console.error("Erro no login com Google:", err);
    }
}

function updateLoggedInUI(user) {
    const navUserArea = document.querySelector(".nav-user-area");
    const userName = escapeHTML(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário');

    if (navUserArea) {
        navUserArea.innerHTML = `
            <div class="credit-badge" title="Seu Saldo Atual" onclick="scrollToSection('meu-banco')">
                <span class="badge-icon">⏱️</span>
                <span class="badge-val" id="user-credits-display">4h Créditos</span>
            </div>
            <button class="btn btn-secondary" onclick="openModal('modal-nova-vaga')">+ Publicar Vaga</button>
            <div style="display: flex; align-items: center; gap: 10px; background: #f1f5f9; padding: 4px 12px; border-radius: 20px;">
                <span style="font-weight: 700; color: #0284c7; font-size: 0.9rem;">👤 ${userName}</span>
                <button onclick="handleLogout()" style="background: transparent; border: none; color: #ef4444; font-weight: bold; cursor: pointer; font-size: 0.85rem; padding: 2px 6px;">
                    Sair 🚪
                </button>
            </div>
        `;
    }

    renderUserDashboard(user);
}

function updateLoggedOutUI() {
    const navUserArea = document.querySelector(".nav-user-area");
    if (navUserArea) {
        navUserArea.innerHTML = `
            <div class="credit-badge" title="Faça login para ver seu saldo" onclick="openModal('modal-login')">
                <span class="badge-icon">⏱️</span>
                <span class="badge-val">0h Créditos</span>
            </div>
            <button class="btn btn-secondary" onclick="openModal('modal-nova-vaga')">+ Publicar Vaga</button>
            <button class="btn btn-primary btn-open-login" onclick="openModal('modal-login')">Entrar / Perfil</button>
        `;
    }

    renderUserDashboard(null);
}

function switchAuthTab(tab) {
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const tabLoginBtn = document.getElementById("tab-login-btn");
    const tabRegBtn = document.getElementById("tab-register-btn");

    if (tab === 'login') {
        if (formLogin) formLogin.style.display = "block";
        if (formRegister) formRegister.style.display = "none";
        if (tabLoginBtn) { 
            tabLoginBtn.style.color = "#0284c7"; 
            tabLoginBtn.style.borderBottom = "2px solid #0284c7"; 
        }
        if (tabRegBtn) { 
            tabRegBtn.style.color = "#64748b"; 
            tabRegBtn.style.borderBottom = "none"; 
        }
    } else {
        if (formLogin) formLogin.style.display = "none";
        if (formRegister) formRegister.style.display = "block";
        if (tabRegBtn) { 
            tabRegBtn.style.color = "#16a34a"; 
            tabRegBtn.style.borderBottom = "2px solid #16a34a"; 
        }
        if (tabLoginBtn) { 
            tabLoginBtn.style.color = "#64748b"; 
            tabLoginBtn.style.borderBottom = "none"; 
        }
    }
}

// ================= 6. CARREGAR VAGAS =================
async function loadVagasWithTimeout() {
    const resultsCounter = document.getElementById("results-counter");
    if (resultsCounter) resultsCounter.textContent = "Carregando oportunidades e cursos...";

    let loaded = false;
    const client = getSupabaseClient();

    if (client) {
        let timerId = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timerId = setTimeout(() => reject(new Error("Timeout do Supabase")), 4000);
            });
            
            const fetchPromise = Promise.all([
                client.from('opportunities').select('*').order('created_at', { ascending: false }),
                client.from('courses').select('*').order('created_at', { ascending: false })
            ]);

            const [oppResponse, courseResponse] = await Promise.race([fetchPromise, timeoutPromise]);

            const opportunitiesData = (oppResponse && oppResponse.data) ? oppResponse.data.map(item => ({
                id: item.id,
                title: item.title,
                type: item.type || "Procura",
                category: item.category || "Geral",
                modality: item.modality || "Remoto",
                hours: item.hours || 1,
                description: item.description || "",
                user: { 
                    name: item.author_name || "Membro da Comunidade", 
                    city: item.author_city || "Brasil", 
                    avatar: (item.author_name || "MC").substring(0, 2).toUpperCase() 
                }
            })) : [];

            const coursesData = (courseResponse && courseResponse.data) ? courseResponse.data.map(course => ({
                id: course.id,
                title: course.title,
                type: "Oferece",
                category: course.category || "Tecnologia",
                modality: "Remoto",
                hours: course.hours || 1,
                description: course.summary || "Curso publicado no Banco de Tempo.",
                user: { 
                    name: "Instrutor(a)", 
                    city: "Aracaju - SE", 
                    avatar: "IN" 
                }
            })) : [];

            vagasDatabase = [...coursesData, ...opportunitiesData];
            if (vagasDatabase.length > 0) loaded = true;

        } catch (err) {
            console.warn("⚠️ Falha ao carregar oportunidades/cursos do Supabase:", err.message);
        } finally {
            if (timerId) clearTimeout(timerId);
        }
    }

    if (!loaded) {
        vagasDatabase = [...backupVagas];
    }

    renderVagas();
}

// =================7. RENDERIZAÇÃO DE INTERFACE =================

function renderVagas() {
    const container = document.getElementById("vagas-container");
    if (!container) return;

    const currentUserEmail = localStorage.getItem('logged_user_email') || 'visitante';
    const storageKey = `completed_courses_${currentUserEmail}`;
    const completedList = JSON.parse(localStorage.getItem(storageKey) || '[]');

    const searchText = (document.getElementById("input-search")?.value || "").toLowerCase().trim();
    const modality = (document.getElementById("select-modalidade")?.value || "todas").toLowerCase();
    const selectedType = document.querySelector('input[name="filter-type"]:checked')?.value || "todos";
    const checkedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);

    const filtered = vagasDatabase.filter(item => {
        const matchSearch = item.title.toLowerCase().includes(searchText) || item.description.toLowerCase().includes(searchText);
        const matchModality = modality === "todas" || item.modality.toLowerCase() === modality;
        const matchType = selectedType === "todos" || item.type === selectedType;
        const matchCategory = checkedCategories.length === 0 || checkedCategories.includes(item.category);

        return matchSearch && matchModality && matchType && matchCategory;
    });

    const counterElem = document.getElementById("results-counter");
    if (counterElem) {
        counterElem.textContent = `Exibindo ${filtered.length} oportunidades encontradas`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b; background: white; border-radius: 8px;">Nenhuma oportunidade encontrada com os filtros selecionados.</div>`;
        return;
    }

    container.innerHTML = filtered.map(vaga => {
        const isDone = completedList.includes(String(vaga.id));

        return `
            <div class="vaga-card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 15px;">
                <div>
                    <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: ${vaga.type === 'Oferece' ? '#dbeafe' : '#fef3c7'}; color: ${vaga.type === 'Oferece' ? '#1e40af' : '#92400e'};">
                                ${vaga.type === 'Oferece' ? 'Ensinar' : 'Aprender'}
                            </span>
                            <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; background: #f1f5f9; color: #475569;">
                                ${escapeHTML(vaga.modality)}
                            </span>
                            <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; background: #f1f5f9; color: #475569;">
                                ${escapeHTML(vaga.category)}
                            </span>
                        </div>

                        ${isDone ? `<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 700; background: #dcfce7; color: #15803d;">✓ Concluído</span>` : ''}
                    </div>

                    <h3 style="margin: 8px 0; font-size: 1.15rem; font-weight: 700; color: #0f172a;">${escapeHTML(vaga.title)}</h3>
                    <p style="color: #475569; font-size: 0.9rem; margin-bottom: 16px; line-height: 1.5;">${escapeHTML(vaga.description)}</p>
                </div>

                <div style="border-top: 1px solid #f1f5f9; padding-top: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                            ${escapeHTML(vaga.user?.avatar || 'MC')}
                        </div>
                        <div style="font-size: 0.85rem;">
                            <h5 style="margin: 0; font-weight: 600; color: #1e293b;">${escapeHTML(vaga.user?.name || 'Membro')}</h5>
                            <p style="margin: 0; color: #64748b;">${escapeHTML(vaga.user?.city || 'Brasil')} ⏱️ ${vaga.hours}h de troca</p>
                        </div>
                    </div>
                    <button onclick="openVagaModal('${escapeHTML(vaga.id)}')" style="width: 100%; padding: 10px; border: 1px solid ${isDone ? '#16a34a' : '#0284c7'}; background: ${isDone ? '#f0fdf4' : '#f0f9ff'}; color: ${isDone ? '#15803d' : '#0284c7'}; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                        ${isDone ? '✓ Ver Detalhes (Concluído)' : 'Ver Detalhes & Quero Participar'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategoryFilters() {
    const container = document.getElementById("category-filters-container");
    if (!container) return;
    container.innerHTML = categoriesList.map(cat => `
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 0.9rem; color: #334155;">
            <input type="checkbox" class="category-checkbox" value="${escapeHTML(cat)}"> ${escapeHTML(cat)}
        </label>
    `).join('');
}

function renderUserDashboard(user) {
    const historyBody = document.getElementById("table-history-body");
    const dashBalance = document.getElementById("dash-balance");

    if (!user) {
        if (dashBalance) dashBalance.textContent = "0h";
        if (historyBody) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">
                        Faça <a href="#" onclick="openModal('modal-login')" style="color: #0284c7; font-weight: bold;">login</a> para ver seu extrato de horas e suas publicações.
                    </td>
                </tr>
            `;
        }
        return;
    }

    const userName = escapeHTML(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário');

    if (dashBalance) dashBalance.textContent = "4h";

    if (historyBody) {
        historyBody.innerHTML = `
            <tr>
                <td>${new Date().toLocaleDateString('pt-BR')}</td>
                <td>Cadastro na Plataforma</td>
                <td>${userName}</td>
                <td><span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Bônus</span></td>
                <td>+4h</td>
                <td><span style="color: #16a34a; font-weight: 600;">Concluído</span></td>
            </tr>
        `;
    }
}

// ================= 8. EVENT LISTENERS =================

function setupEventListeners() {
    document.getElementById("btn-execute-search")?.addEventListener("click", renderVagas);
    document.getElementById("input-search")?.addEventListener("keyup", renderVagas);
    document.getElementById("select-modalidade")?.addEventListener("change", renderVagas);
    document.querySelectorAll('input[name="filter-type"]').forEach(r => r.addEventListener("change", renderVagas));
    document.getElementById("category-filters-container")?.addEventListener("change", renderVagas);

    document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
        const inp = document.getElementById("input-search"); if (inp) inp.value = "";
        const sel = document.getElementById("select-modalidade"); if (sel) sel.value = "todas";
        const radio = document.querySelector('input[name="filter-type"]'); if (radio) radio.checked = true;
        document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
        renderVagas();
    });

    document.getElementById("form-nova-vaga")?.addEventListener("submit", handleCreateVaga);
    document.getElementById("form-login")?.addEventListener("submit", handleLogin);
    document.getElementById("form-register")?.addEventListener("submit", handleRegister);

    document.getElementById("tab-login-btn")?.addEventListener("click", () => switchAuthTab('login'));
    document.getElementById("tab-register-btn")?.addEventListener("click", () => switchAuthTab('register'));

    document.querySelectorAll(".btn-open-login").forEach(btn => {
        btn.addEventListener("click", () => openModal("modal-login"));
    });
    document.getElementById("btn-open-nova-vaga")?.addEventListener("click", () => openModal("modal-nova-vaga"));

    document.getElementById("btn-google-login")?.addEventListener("click", handleGoogleLogin);

    document.querySelectorAll(".btn-close-modal, .modal-close").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal");
            if (modal) closeModal(modal.id);
        });
    });
}

// ================= 9. CRIAR VAGA =================
async function handleCreateVaga(e) {
    if (e) e.preventDefault();

    if (!userSession) {
        showToast("Você precisa estar logado para publicar uma vaga!");
        openModal("modal-login");
        return;
    }

    const type = document.getElementById("new-type")?.value;

    if (type === "Oferece") {
        closeModal("modal-nova-vaga");
        window.location.href = "/pages/area_instrutor.html";
        return;
    }

    if (isSubmittingVaga) return;

    const title = document.getElementById("new-title")?.value?.trim();
    const category = document.getElementById("new-category")?.value;
    const modality = document.getElementById("new-modality")?.value;
    const hoursInput = parseInt(document.getElementById("new-hours")?.value || "1", 10);
    const hours = isNaN(hoursInput) ? 1 : hoursInput;
    const description = document.getElementById("new-desc")?.value?.trim();

    if (!title || !description) {
        showToast("Preencha o título e a descrição da oportunidade.");
        return;
    }

    isSubmittingVaga = true;
    const submitBtn = document.querySelector("#form-nova-vaga button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;

    const authorName = userSession.user_metadata?.full_name || userSession.email?.split('@')[0] || "Membro";

    try {
        const client = getSupabaseClient();
        if (client) {
            const { error } = await client
                .from('opportunities')
                .insert([{
                    title, 
                    type: "Procura", 
                    category: category || "Tecnologia",
                    modality: modality || "Remoto", 
                    hours, 
                    description,
                    author_name: authorName, 
                    author_city: "Aracaju - SE",
                    user_id: userSession.id
                }])
                .select();

            if (error) {
                showToast("Erro ao salvar no banco: " + error.message);
                return;
            }
        }

        showToast("Oportunidade de aprendizado publicada com sucesso!");
        closeModal("modal-nova-vaga");
        document.getElementById("form-nova-vaga")?.reset();
        await loadVagasWithTimeout();

    } catch (err) {
        console.error("Erro inesperado ao criar vaga:", err);
    } finally {
        isSubmittingVaga = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}
// ================= 10. MODAIS & UTILITÁRIOS =================

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("active");
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("active");
    }
}

// ================= MODAL INTELIGENTE =================
function openVagaModal(id) {
    const vaga = vagasDatabase.find(v => v.id == id);
    if (!vaga) return;

    const content = document.getElementById("modal-vaga-content");
    if (!content) return;

    const currentUserEmail = localStorage.getItem('logged_user_email') || 'visitante';

    const storageKey = `completed_courses_${currentUserEmail}`;

    const completedList = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const isDone = completedList.includes(String(vaga.id));

    const isEnsinar = vaga.type === 'Oferece' || vaga.type === 'Ensinar';

    if (isEnsinar) {
        content.innerHTML = `
            <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; background: #dbeafe; color: #1e40af;">
                    📖 Curso Disponível
                </span>
                <span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; background: #f1f5f9; color: #475569;">
                    ${escapeHTML(vaga.modality || 'Remoto')}
                </span>
                <!-- TAG DE CONCLUÍDO DENTRO DO MODAL (APENAS PARA QUEM CONCLUIU) -->
                ${isDone ? `<span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; background: #dcfce7; color: #15803d;">✓ Concluído</span>` : ''}
            </div>

            <h2 style="margin: 0 0 8px 0; font-size: 1.35rem; color: #0f172a; font-weight: 700;">${escapeHTML(vaga.title)}</h2>
            <p style="color: #475569; margin-bottom: 16px; line-height: 1.5; font-size: 0.95rem;">${escapeHTML(vaga.description)}</p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 10px; margin-bottom: 20px; font-size: 0.85rem;">
                <p style="margin: 4px 0;"><strong>Instrutor(a):</strong> ${escapeHTML(vaga.user?.name || 'Comunidade')}</p>
                <p style="margin: 4px 0;"><strong>Carga Horária:</strong> ⏱️ ${vaga.hours || 1} Hora(s)</p>
            </div>

            <p style="font-weight: bold; font-size: 0.9rem; color: ${isDone ? '#15803d' : '#0f172a'}; margin-bottom: 12px; text-align: center;">
                ${isDone ? ' Você já concluiu este curso!' : 'Pronto para começar a aprender?'}
            </p>

            <button onclick="window.location.href='/pages/area_aluno.html'" style="width: 100%; padding: 12px; background: ${isDone ? '#16a34a' : '#0284c7'}; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;">
                ${isDone ? ' Refazer Curso (Já Concluído)' : ' Ir para a Área do Aluno (Estudar)'}
            </button>
        `;

    } else {
        content.innerHTML = `
            <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; background: #fef3c7; color: #92400e;">
                    🙋‍♂️ Pedido de Aprendizado
                </span>
                <span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; background: #f1f5f9; color: #475569;">
                    ${escapeHTML(vaga.modality || 'Remoto')}
                </span>
            </div>

            <h2 style="margin: 0 0 8px 0; font-size: 1.35rem; color: #0f172a; font-weight: 700;">${escapeHTML(vaga.title)}</h2>
            <p style="color: #475569; margin-bottom: 16px; line-height: 1.5; font-size: 0.95rem;">${escapeHTML(vaga.description)}</p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 10px; margin-bottom: 16px; font-size: 0.85rem;">
                <p style="margin: 4px 0;"><strong>Solicitado por:</strong> ${escapeHTML(vaga.user?.name || 'Aluno')}</p>
                <p style="margin: 4px 0;"><strong>Crédito Oferecido:</strong> ⏱️ ${vaga.hours || 1} Hora(s)</p>
            </div>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 10px; margin-bottom: 20px;">
                <p style="font-weight: bold; font-size: 0.9rem; color: #166534; margin: 0 0 6px 0;">Você domina este assunto?</p>
                <p style="font-size: 0.85rem; color: #15803d; margin: 0;">Ao aceitar este pedido, você será redirecionado para a Área do Instrutor para criar as aulas para este aluno.</p>
            </div>

            <button onclick="acceptToTeach('${vaga.id}')" style="width: 100%; padding: 12px; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;">
            Eu Sei Fazer! (Assumir este Curso)
            </button>
        `;
    }

    openModal("modal-vaga-detalhe");
}
// ================= AÇÕES DOS BOTÕES DO MODAL =================
function accessCourseContent(courseId) {
    closeModal("modal-vaga-detalhes");
    showToast("Carregando o conteúdo didático do curso...");
}

function notifyMeOnCourse(vagaId) {
    if (!userSession) {
        showToast("Você precisa estar logado para receber notificações!");
        closeModal("modal-vaga-detalhes");
        openModal("modal-login");
        return;
    }
    showToast(" Pronto! Você será notificado assim que um instrutor criar este curso.");
    closeModal("modal-vaga-detalhes");
}

function scrollToSection(id) {
    const elem = document.getElementById(id);
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
}

function applyForVaga(vagaId) {
    const user = supabase ? supabase.auth.getUser() : null;

    if (typeof showToast === 'function') {
        showToast('Interesse registrado com sucesso! Redirecionando...');
    } else {
        alert('Interesse registrado com sucesso!');
    }

    if (typeof closeModal === 'function') {
        closeModal('modal-vaga-detalhe');
    }

    setTimeout(() => {
        window.location.href = '/pages/area_aluno.html';
    }, 1500);
}

// ================= ASSUMIR UM PEDIDO E TRANSFORMAR EM CURSO =================
async function acceptToTeach(id) {
    const client = getSupabaseClient();
    
    if (!client) {
        showToast("Erro: A conexão com o Supabase falhou.");
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        showToast("Você precisa fazer login para assumir um curso!");
        return;
    }
    const meuUsuarioId = session.user.id;

    showToast("Movendo o pedido para a sua Área de Instrutor...");
    
    try {
        const { data: pedidoAnterior, error: erroBusca } = await client
            .from('opportunities')
            .select('*')
            .eq('id', id)
            .single();

        if (erroBusca) throw new Error("Não foi possível encontrar o pedido.");

        const { data: novoCurso, error: erroCriar } = await client
            .from('courses')
            .insert([{
                title: pedidoAnterior.title,
                category: pedidoAnterior.category || "Tecnologia",
                hours: pedidoAnterior.hours,
                summary: pedidoAnterior.description,
                type: 'Oferece',
                user_id: meuUsuarioId 
            }])
            .select()
            .single();

        if (erroCriar) throw erroCriar;

        const targetId = (!isNaN(id) && !isNaN(parseFloat(id))) ? Number(id) : id;
        await client.from('opportunities').delete().eq('id', targetId);

        showToast(" Sucesso! O curso é seu agora.");
        
        setTimeout(() => {
            if (typeof closeModal === 'function') closeModal("modal-vaga-detalhe");
            window.location.href = `/pages/area_instrutor.html?cursoId=${novoCurso.id}`;
        }, 1500);
        
    } catch (err) {
        console.error("Erro completo:", err);
        showToast(`Erro: ${err.message || "Falha ao processar o curso"}`);
    }
}
// ================= SISTEMA DE NOTIFICAÇÕES (TOAST) =================
function showToast(message) {
    const toast = document.getElementById("toast-notification");
    
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.style.display = "block";
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)"; 
    toast.style.transition = "all 0.3s ease";

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%, 20px)";
        
        setTimeout(() => {
            toast.style.display = "none";
        }, 300);
    }, 3000);
}

// ================= 11. EXPORTAÇÃO GLOBAL PARA EVENTOS INLINE DO HTML (onclick, onsubmit) =================

window.getSupabaseClient = getSupabaseClient;
window.fetchCoursesFromDB = fetchCoursesFromDB;
window.handleSaveCourse = handleSaveCourse;
window.checkUserSession = checkUserSession;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.handleGoogleLogin = handleGoogleLogin;
window.updateLoggedInUI = updateLoggedInUI;
window.updateLoggedOutUI = updateLoggedOutUI;
window.switchAuthTab = switchAuthTab;
window.loadVagasWithTimeout = loadVagasWithTimeout;
window.renderVagas = renderVagas;
window.renderCategoryFilters = renderCategoryFilters;
window.renderUserDashboard = renderUserDashboard;
window.setupEventListeners = setupEventListeners;
window.handleCreateVaga = handleCreateVaga;
window.openModal = openModal;
window.closeModal = closeModal;
window.openVagaModal = openVagaModal;
window.applyForVaga = applyForVaga;
window.showToast = showToast;
window.scrollToSection = scrollToSection;
window.accessCourseContent = accessCourseContent;
window.notifyMeOnCourse = notifyMeOnCourse;