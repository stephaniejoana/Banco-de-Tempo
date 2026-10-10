// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://ceaqvwylgnhcajzxcjqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QsgrGC9not0FVNUbz8l3lw_QzAqM--j';

let supabaseClient = null;
let myCourses = [];

function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            return supabaseClient;
        }
    } catch (err) {
        console.warn("Erro ao iniciar Supabase:", err);
    }
    return null;
}

// 3. CARREGAR CURSOS DO BANCO DE DADOS (COM PRIVACIDADE DE USUÁRIO)
async function fetchCoursesFromDB() {
    const spinner = document.getElementById('loading-spinner');
    const grid = document.getElementById('courses-list-grid');

    if (spinner) spinner.classList.remove('hidden');

    try {
        const client = getSupabaseClient(); 
        if (!client) throw new Error("Cliente Supabase não carregado.");

        const { data: { session } } = await client.auth.getSession();
        
        if (!session || !session.user) {
            console.warn("Nenhum utilizador logado.");
            if (grid) grid.innerHTML = "<p style='text-align:center; padding: 20px;'>Faça login para ver os seus cursos.</p>";
            return; 
        }

        const { data, error } = await client
            .from('courses')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        myCourses = data || [];
        renderCoursesDashboard();  

        if (typeof checkUrlForEdit === 'function') {
            checkUrlForEdit();
        }

    } catch (err) {
        console.error("Erro ao buscar cursos do painel:", err);
    } finally {
        if (spinner) spinner.classList.add('hidden');
        if (grid) grid.classList.remove('hidden');
    }
}

function renderCoursesDashboard() {
    const grid = document.getElementById('courses-list-grid');
    if (!grid) return;

    if (myCourses.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 16px;">
                <div style="font-size: 3rem; margin-bottom: 10px;">📖</div>
                <h3 style="font-weight: 700; color: #0f172a; font-size: 1.1rem; margin-bottom: 6px;">Nenhum curso cadastrado ainda</h3>
                <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 16px;">Você ainda não criou nenhum curso. Clique abaixo para publicar o seu primeiro!</p>
                <button onclick="openFormNewCourse()" style="background: #0284c7; color: #ffffff; font-weight: 700; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer;">
                    + Criar Primeiro Curso
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = myCourses.map(course => `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="bg-sky-100 text-sky-800 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">${escapeHtml(course.category || 'Geral')}</span>
                    <span class="text-xs font-semibold text-slate-500"><i class="fa-regular fa-clock text-sky-600 mr-1"></i>${course.hours || 1}h</span>
                </div>
                <h3 class="font-bold text-slate-900 text-base mb-2 line-clamp-2">${escapeHtml(course.title)}</h3>
                <p class="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">${escapeHtml(course.summary || 'Sem resumo.')}</p>
            </div>

            <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button onclick="renderPreview('${course.id}')" class="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition text-center">
                    <i class="fa-solid fa-eye mr-1"></i> Prévia
                </button>
                <button onclick="openFormEditCourse('${course.id}')" class="p-2 text-sky-600 hover:bg-sky-50 rounded-xl transition" title="Editar">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="deleteCourseFromDB('${course.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-xl transition" title="Excluir">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// SALVAR OU ATUALIZAR CURSO NO BANCO DE DADOS
async function handleSaveCourse(e) {
    if (e) e.preventDefault();

    const btnSave = document.getElementById('btn-save-submit');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando no Banco...`;
    }

    const editingId = document.getElementById('editing-course-id')?.value;
    const title = document.getElementById('input-title')?.value;
    const category = document.getElementById('input-category')?.value;
    const hours = parseInt(document.getElementById('input-hours')?.value || "1", 10);
    const summary = document.getElementById('input-summary')?.value;

    const topicElements = document.querySelectorAll('.topic-card-item');
    const topics = Array.from(topicElements).map(el => ({
        title: el.querySelector('.topic-title-input')?.value || '',
        content: el.querySelector('.topic-content-input')?.value || ''
    }));

    const quizElements = document.querySelectorAll('.quiz-question-item');
    const quiz = Array.from(quizElements).map(el => {
        const questionText = el.querySelector('.quiz-question-text')?.value || '';
        const options = [
            el.querySelector('.quiz-option-text-0')?.value || '',
            el.querySelector('.quiz-option-text-1')?.value || '',
            el.querySelector('.quiz-option-text-2')?.value || '',
            el.querySelector('.quiz-option-text-3')?.value || ''
        ];
        const checkedRadio = el.querySelector('.quiz-correct-radio:checked');
        const correctIndex = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;

        return { question: questionText, options, correctIndex };
    });

    try {
        const client = getSupabaseClient();
        if (!client) throw new Error("Cliente Supabase indisponível.");

        const { data: { session }, error: sessionError } = await client.auth.getSession();
        
        if (sessionError || !session || !session.user) {
            throw new Error("Você precisa estar logado para salvar um curso.");
        }

        const coursePayload = { 
            title, 
            category, 
            hours, 
            summary, 
            topics, 
            quiz,
            user_id: session.user.id 
        };

        if (editingId) {
            const { error } = await client
                .from('courses')
                .update(coursePayload)
                .eq('id', editingId)
                .eq('user_id', session.user.id);

            if (error) throw error;
            showToast("Curso atualizado com sucesso!", "success");
        } else {
            const { error } = await client
                .from('courses')
                .insert([coursePayload]);

            if (error) throw error;
            showToast("Curso publicado no banco com sucesso!", "success");
        }

        if (typeof fetchCoursesFromDB === 'function') {
            await fetchCoursesFromDB(); 
        }
        
        showView('view-dashboard');

    } catch (err) {
        console.error("Erro ao salvar curso:", err);
        showToast(err.message || "Erro ao salvar no banco de dados.", "error");
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar no Banco de Dados`;
        }
    }
}

//. EXCLUIR CURSO
async function deleteCourseFromDB(courseId) {
    if (!confirm("Deseja excluir este curso permanentemente?")) return;

    try {
        const client = getSupabaseClient();
        const { data: { session } } = await client.auth.getSession();
        
        const { error } = await client
            .from('courses')
            .delete()
            .eq('id', courseId)
            .eq('user_id', session.user.id);

        if (error) throw error;

        showToast("Curso excluído!", "success");
        fetchCoursesFromDB();
    } catch (err) {
        console.error("Erro ao excluir curso:", err);
        showToast("Erro ao excluir o curso.", "error");
    }
}

//  GERENCIAMENTO DE INTERFACE E CAMPOS DINÂMICOS
function showView(viewId) {
    const vDash = document.getElementById('view-dashboard');
    const vForm = document.getElementById('view-form');
    const vPrev = document.getElementById('view-preview');

    if (vDash) vDash.classList.add('hidden');
    if (vForm) vForm.classList.add('hidden');
    if (vPrev) vPrev.classList.add('hidden');

    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewId === 'view-dashboard') {
        fetchCoursesFromDB();
    }
}

function openFormNewCourse() {
    const form = document.getElementById('course-form');
    if (form) form.reset();

    const idElem = document.getElementById('editing-course-id');
    if (idElem) idElem.value = '';

    const heading = document.getElementById('form-title-heading');
    if (heading) heading.textContent = 'Cadastrar Novo Curso';

    const tContainer = document.getElementById('topics-container');
    if (tContainer) tContainer.innerHTML = '';

    const qContainer = document.getElementById('quiz-questions-container');
    if (qContainer) qContainer.innerHTML = '';

    addTopicField();
    showView('view-form');
}

function openFormEditCourse(courseId) {
    const course = myCourses.find(c => c.id == courseId);
    if (!course) return;

    document.getElementById('editing-course-id').value = course.id;
    document.getElementById('form-title-heading').textContent = 'Editar Curso';
    document.getElementById('input-title').value = course.title || '';
    document.getElementById('input-category').value = course.category || '';
    document.getElementById('input-hours').value = course.hours || 1;
    document.getElementById('input-summary').value = course.summary || '';

    const tContainer = document.getElementById('topics-container');
    if (tContainer) {
        tContainer.innerHTML = '';
        if (course.topics && course.topics.length > 0) {
            course.topics.forEach(t => addTopicField(t.title, t.content));
        } else {
            addTopicField();
        }
    }

    const qContainer = document.getElementById('quiz-questions-container');
    if (qContainer) {
        qContainer.innerHTML = '';
        if (course.quiz && course.quiz.length > 0) {
            course.quiz.forEach(q => addQuestionField(q.question, q.options, q.correctIndex));
        }
    }

    showView('view-form');
}

function addTopicField(title = '', content = '') {
    const container = document.getElementById('topics-container');
    if (!container) return;

    const index = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'topic-card-item bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative';
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase">Tópico ${index}</span>
            <button type="button" onclick="this.closest('.topic-card-item').remove()" class="text-xs text-red-500 hover:text-red-700 font-bold">
                <i class="fa-solid fa-trash-can mr-1"></i> Remover Tópico
            </button>
        </div>
        <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Título do Tópico *</label>
            <input type="text" class="topic-title-input w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-sky-500 bg-white" placeholder="Ex: Tópico 1: Conceitos Iniciais" value="${escapeHtml(title)}" required>
        </div>
        <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Conteúdo Explicativo do Assunto *</label>
            <textarea class="topic-content-input w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-sky-500 bg-white" rows="4" placeholder="Escreva aqui todo o assunto explicativo..." required>${escapeHtml(content)}</textarea>
        </div>
    `;
    container.appendChild(div);
}

function addQuestionField(questionText = '', optionsArr = ['', '', '', ''], correctIdx = 0) {
    const container = document.getElementById('quiz-questions-container');
    if (!container) return;

    const qIndex = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'quiz-question-item bg-purple-50/50 p-4 rounded-xl border border-purple-200 space-y-3';
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-purple-800 uppercase">Questão ${qIndex}</span>
            <button type="button" onclick="this.closest('.quiz-question-item').remove()" class="text-xs text-red-500 hover:text-red-700 font-bold">
                <i class="fa-solid fa-trash-can mr-1"></i> Remover Pergunta
            </button>
        </div>
        <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Pergunta da Prova *</label>
            <input type="text" class="quiz-question-text w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white" placeholder="Digite a pergunta..." value="${escapeHtml(questionText)}" required>
        </div>
        <div class="space-y-2">
            <label class="block text-xs font-bold text-slate-700 uppercase">Opções de Resposta (Marque a correta):</label>
            ${[0, 1, 2, 3].map(optIdx => `
                <div class="flex items-center gap-2">
                    <input type="radio" name="correct-opt-${qIndex}-${Date.now()}" value="${optIdx}" ${optIdx == correctIdx ? 'checked' : ''} class="quiz-correct-radio text-purple-600">
                    <input type="text" class="quiz-option-text-${optIdx} w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white" placeholder="Alternativa ${optIdx + 1}" value="${escapeHtml(optionsArr[optIdx] || '')}" required>
                </div>
            `).join('')}
        </div>
    `;
    container.appendChild(div);
}

function renderPreview(courseId) {
    const course = myCourses.find(c => c.id == courseId);
    if (!course) return;

    document.getElementById('preview-category').textContent = course.category || 'Geral';
    document.getElementById('preview-hours').textContent = course.hours || '1';
    document.getElementById('preview-title').textContent = course.title;
    document.getElementById('preview-summary').textContent = course.summary;

    document.getElementById('btn-edit-from-preview').onclick = () => openFormEditCourse(course.id);

    const topicsRender = document.getElementById('preview-topics-render');
    if (course.topics && course.topics.length > 0) {
        topicsRender.innerHTML = course.topics.play ? course.topics.map((t, idx) => `
            <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 class="text-base font-bold text-slate-900 mb-2">${idx + 1}. ${escapeHtml(t.title)}</h3>
                <div class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(t.content)}</div>
            </div>
        `).join('') : course.topics.map((t, idx) => `
            <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 class="text-base font-bold text-slate-900 mb-2">${idx + 1}. ${escapeHtml(t.title)}</h3>
                <div class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(t.content)}</div>
            </div>
        `).join('');
    } else {
        topicsRender.innerHTML = `<p class="text-xs text-slate-400 italic">Nenhum tópico cadastrado.</p>`;
    }

    showView('view-preview');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-sky-600';
    toast.className = `fixed bottom-5 right-5 z-50 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg transition-all duration-300 flex items-center gap-2 ${bgColor}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    toast.classList.remove('translate-y-20', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function checkUrlForEdit() {
    const urlParams = new URLSearchParams(window.location.search);
    const cursoId = urlParams.get('cursoId');

    if (cursoId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setTimeout(() => {
            openFormEditCourse(cursoId);
            showToast("Edite o assunto e adicione os tópicos para este pedido!", "success");
        }, 300);
    }
}

// . EXPORTAÇÃO DE FUNÇÕES PARA OS EVENTOS DA PÁGINA (window)
window.showView = showView;
window.openFormNewCourse = openFormNewCourse;
window.openFormEditCourse = openFormEditCourse;
window.addTopicField = addTopicField;
window.addQuestionField = addQuestionField;
window.handleSaveCourse = handleSaveCourse;
window.deleteCourseFromDB = deleteCourseFromDB;
window.renderPreview = renderPreview;
window.checkUrlForEdit = checkUrlForEdit;