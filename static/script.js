document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analyzeTextBtn = document.getElementById('analyze-text-btn');
    const pasteArea = document.getElementById('paste-area');
    const pdfInputArea = document.getElementById('pdf-input-area');
    const textInputArea = document.getElementById('text-input-area');
    const modePdf = document.getElementById('mode-pdf');
    const modeText = document.getElementById('mode-text');
    
    const navItems = document.querySelectorAll('.nav-item');
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        quiz: document.getElementById('quiz-view'),
        chat: document.getElementById('chat-view'),
        extract: document.getElementById('extract-view')
    };
    
    const summaryContent = document.getElementById('summary-content');
    const statsRow = document.getElementById('stats-content');
    const insightsList = document.getElementById('insights-list');
    const termsCloud = document.getElementById('terms-cloud');
    const historyList = document.getElementById('history-list');
    const headerTitle = document.getElementById('header-title');
    const dateDisplay = document.getElementById('current-date');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Quiz Selectors
    const quizCount = document.getElementById('quiz-count');
    const quizCountVal = document.getElementById('quiz-count-val');
    const generateQuizBtn = document.getElementById('generate-quiz-btn');
    const quizEditor = document.getElementById('quiz-editor');
    const questionsList = document.getElementById('questions-list');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    const quizPlayer = document.getElementById('quiz-player');
    const activeQuestionCard = document.getElementById('active-question-card');
    const questionIndexDisplay = document.getElementById('question-index');
    const submitAnsBtn = document.getElementById('submit-ans-btn');
    const quizResults = document.getElementById('quiz-results');
    const finalScore = document.getElementById('final-score');

    // Chat Selectors
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const chatThread = document.getElementById('chat-thread');

    let currentDocId = null;
    let quizData = [];
    let currentQuestionIdx = 0;
    let userAnswers = [];

    // Date init
    const autoUpdateDate = () => {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    };
    autoUpdateDate();

    // Tab Management
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            Object.values(views).forEach(v => v.classList.add('hidden'));
            views[tab].classList.remove('hidden');
        });
    });

    // History & Document Management
    async function fetchHistory() {
        const res = await fetch('/history');
        const data = await res.json();
        historyList.innerHTML = '';
        if (data.length === 0) {
            historyList.innerHTML = '<div class="no-history">No recent documents</div>';
            return;
        }
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="filename" title="${item.filename}">${item.type === 'text' ? '📝' : '📄'} ${item.filename}</div>
                <div class="delete-btn" data-id="${item.id}">×</div>
            `;
            div.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn')) loadDocument(item.id);
            });
            div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Delete this from history?')) {
                    await fetch(`/delete/${item.id}`, { method: 'DELETE' });
                    fetchHistory();
                }
            });
            historyList.appendChild(div);
        });
    }

    async function loadDocument(id) {
        showLoading('Retrieving Knowledge Node...');
        try {
            const res = await fetch(`/document/${id}`);
            const data = await res.json();
            currentDocId = id;
            renderFullResponse(data);
            // Reset views for the new document
            quizEditor.classList.add('hidden');
            quizPlayer.classList.add('hidden');
            chatThread.innerHTML = `<div class="chat-bubble ai">Context updated for: ${data.filename}. Ask me anything!</div>`;
        } catch (err) {
            if(err.message.includes('401')) { authOverlay.classList.remove('hidden'); } else alert('Error loading document.');
        } finally {
            hideLoading();
        }
    }

    // Analysis Logic
    modePdf.addEventListener('click', () => {
        modePdf.classList.add('active'); modeText.classList.remove('active');
        pdfInputArea.classList.remove('hidden'); textInputArea.classList.add('hidden');
    });

    modeText.addEventListener('click', () => {
        modeText.classList.add('active'); modePdf.classList.remove('active');
        textInputArea.classList.remove('hidden'); pdfInputArea.classList.add('hidden');
    });

    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#pdf-input-area') && !e.target.classList.contains('btn-analyze')) fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (file.type !== 'application/pdf') { alert('Please upload a PDF.'); return; }
        document.querySelector('#pdf-input-area p').textContent = `Ready: ${file.name}`;
    }

    analyzeBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) { alert('Select a PDF first.'); return; }
        showLoading('Mapping Document Architecture...');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();
            const analyzeRes = await fetch('/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: uploadData.filename, type: 'pdf' })
            });
            const data = await analyzeRes.json();
            currentDocId = data.id;
            renderFullResponse(data);
            fetchHistory();
        } catch (err) { alert(err.message); } finally { hideLoading(); }
    });

    analyzeTextBtn.addEventListener('click', async () => {
        const text = pasteArea.value.trim();
        if (text.length < 50) { alert('Paste more content.'); return; }
        showLoading('Processing Linguistic Patterns...');
        try {
            const analyzeRes = await fetch('/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, type: 'text' })
            });
            const data = await analyzeRes.json();
            currentDocId = data.id;
            renderFullResponse(data);
            fetchHistory();
        } catch (err) { alert(err.message); } finally { hideLoading(); }
    });

    function renderFullResponse(data) {
        headerTitle.textContent = data.filename || 'Intelligence Dashboard';
        summaryContent.classList.remove('placeholder');
        summaryContent.innerHTML = data.summary;
        statsRow.classList.remove('hidden');
        document.getElementById('stat-pages').textContent = data.stats.pages;
        document.getElementById('stat-words').textContent = data.stats.words;
        document.getElementById('stat-time').textContent = data.stats.time + 'm';
        termsCloud.innerHTML = '';
        data.keywords.forEach(term => {
            const span = document.createElement('span'); span.className = 'term-tag';
            span.textContent = term; termsCloud.appendChild(span);
        });
        insightsList.innerHTML = '';
        data.page_insights.forEach(item => {
            const div = document.createElement('div'); div.className = 'insight-item';
            let content = item.insight;
            data.keywords.forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                content = content.replace(regex, `<span class="highlight">$&</span>`);
            });
            div.innerHTML = `<div class="page-num">PAGE ${item.page}</div><div class="content">${content}</div>`;
            insightsList.appendChild(div);
        });
    }

    // Quiz Logic
    quizCount.addEventListener('input', () => quizCountVal.textContent = quizCount.value);

    generateQuizBtn.addEventListener('click', async () => {
        if (!currentDocId) { alert('Select a document first.'); return; }
        showLoading('Synthesizing Assessment Questions...');
        try {
            const res = await fetch('/generate-quiz', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_id: currentDocId, count: parseInt(quizCount.value) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate quiz");
            quizData = data.questions;
            renderQuizEditor();
        } catch (err) {
            const msg = err.message.toLowerCase();
            if (msg.includes('api key') || msg.includes('configured')) {
                alert('Invalid or missing API Key. Please update your settings.');
                settingsModal.classList.remove('hidden');
            } else {
                alert('Error generating quiz: ' + err.message);
            }
        } finally { hideLoading(); }
    });

    function renderQuizEditor() {
        quizEditor.classList.remove('hidden');
        quizPlayer.classList.add('hidden');
        questionsList.innerHTML = '';
        quizData.forEach((q, idx) => {
            const qCard = document.createElement('div');
            qCard.className = 'editable-card';
            qCard.innerHTML = `
                <input type="text" class="edit-q-text" value="${q.question}" placeholder="Question text">
                <div class="edit-options">
                    ${q.options.map((opt, oIdx) => `
                        <div class="option-edit">
                            <input type="radio" name="correct-${idx}" ${oIdx === q.answer ? 'checked' : ''} value="${oIdx}">
                            <input type="text" class="edit-opt-text" value="${opt}">
                        </div>
                    `).join('')}
                </div>
            `;
            questionsList.appendChild(qCard);
        });
    }

    startQuizBtn.addEventListener('click', () => {
        // Collect edits
        const cards = document.querySelectorAll('.editable-card');
        quizData = Array.from(cards).map((card, idx) => {
            const qText = card.querySelector('.edit-q-text').value;
            const optTexts = Array.from(card.querySelectorAll('.edit-opt-text')).map(input => input.value);
            const correctIdx = parseInt(card.querySelector('input[type="radio"]:checked').value);
            return { question: qText, options: optTexts, answer: correctIdx };
        });

        currentQuestionIdx = 0;
        userAnswers = Array(quizData.length).fill(null);
        showQuestion(0);
        quizEditor.classList.add('hidden');
        quizPlayer.classList.remove('hidden');
    });

    function showQuestion(idx) {
        const q = quizData[idx];
        questionIndexDisplay.textContent = `Question ${idx + 1} of ${quizData.length}`;
        activeQuestionCard.innerHTML = `
            <h3>${q.question}</h3>
            <div class="options-group">
                ${q.options.map((opt, i) => `
                    <button class="option-btn ${userAnswers[idx] === i ? 'selected' : ''}" data-idx="${i}">${opt}</button>
                `).join('')}
            </div>
        `;
        
        activeQuestionCard.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeQuestionCard.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                userAnswers[idx] = parseInt(btn.dataset.idx);
            });
        });

        submitAnsBtn.textContent = (idx === quizData.length - 1) ? "Finalize Quiz" : "Next Question";
    }

    submitAnsBtn.addEventListener('click', () => {
        if (userAnswers[currentQuestionIdx] === null) { alert('Please select an answer.'); return; }
        
        if (currentQuestionIdx < quizData.length - 1) {
            currentQuestionIdx++;
            showQuestion(currentQuestionIdx);
        } else {
            showResults();
        }
    });

    function showResults() {
        let correct = 0;
        userAnswers.forEach((ans, idx) => {
            if (ans === quizData[idx].answer) correct++;
        });
        const score = Math.round((correct / quizData.length) * 100);
        finalScore.textContent = score;
        quizResults.classList.remove('hidden');
    }

    // Chat Logic
    async function sendMessage() {
        const msg = chatInput.value.trim();
        if (!msg || !currentDocId) return;

        appendMessage('user', msg);
        chatInput.value = '';
        
        try {
            const res = await fetch('/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_id: currentDocId, message: msg })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to process chat");
            appendMessage('ai', data.response);
        } catch (err) {
            const msg = err.message.toLowerCase();
            if (msg.includes('api key') || msg.includes('configured')) {
                appendMessage('ai', 'My connection to the neural node failed. Please check your API Key in settings.');
                settingsModal.classList.remove('hidden');
            } else {
                appendMessage('ai', 'Error: ' + err.message);
            }
        }
    }

    function appendMessage(role, text) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;
        bubble.textContent = text;
        chatThread.appendChild(bubble);
        chatThread.scrollTop = chatThread.scrollHeight;
    }

    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) sendMessage();
    });

    function showLoading(text) {
        document.getElementById('loading-text').textContent = text;
        loadingOverlay.classList.remove('hidden');
    }
    function hideLoading() { loadingOverlay.classList.add('hidden'); }

    // Settings Modal Logic
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveApiBtn = document.getElementById('save-api-btn');
    const apiKeyInput = document.getElementById('api-key-input');

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    saveApiBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) { alert('Please enter an API Key.'); return; }

        saveApiBtn.disabled = true;
        saveApiBtn.textContent = 'Activating...';

        try {
            const res = await fetch('/save-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key })
            });
            const data = await res.json();

            if (res.ok) {
                alert(data.message);
                settingsModal.classList.add('hidden');
                // Re-check status if needed, or just allow features
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            saveApiBtn.disabled = false;
            saveApiBtn.textContent = 'Save & Activate';
        }
    });

    // Check AI Status on startup
    
    // Auth Selectors
    const authOverlay = document.getElementById('auth-overlay');
    const authForm = document.getElementById('auth-form');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    const authError = document.getElementById('auth-error');
    const authTitle = document.getElementById('auth-title');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const logoutBtn = document.getElementById('logout-btn');
    const activeUsernameText = document.getElementById('active-username');
    const userAvatar = document.getElementById('user-avatar');
    const userProfileBtn = document.getElementById('user-profile-btn');
    const userDropdown = document.getElementById('user-dropdown');
    let isLoginMode = true;

    if (userProfileBtn) {
        userProfileBtn.addEventListener('click', () => {
            userDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!userProfileBtn.contains(e.target)) {
                userDropdown.classList.add('hidden');
            }
        });
    }

    authToggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            authTitle.textContent = 'Login';
            authSubmitBtn.textContent = 'Login';
            authToggleText.textContent = "Don't have an account?";
            authToggleLink.textContent = 'Register';
        } else {
            authTitle.textContent = 'Register';
            authSubmitBtn.textContent = 'Register';
            authToggleText.textContent = "Already have an account?";
            authToggleLink.textContent = 'Login';
        }
        authError.textContent = '';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = authUsername.value.trim();
        const password = authPassword.value.trim();
        if (!username || !password) return;

        showLoading('Authenticating Neural Profile...');
        try {
            const endpoint = isLoginMode ? '/login' : '/register';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (!res.ok) {
                authError.textContent = data.error;
            } else {
                authOverlay.classList.add('hidden');
                if(activeUsernameText) activeUsernameText.textContent = username;
                if(userAvatar) userAvatar.textContent = username.charAt(0).toUpperCase();
                authUsername.value = '';
                authPassword.value = '';
                fetchHistory(); // load history and refresh workspace
            }
        } catch (err) {
            authError.textContent = "Server communication failed.";
        } finally {
            hideLoading();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/logout', { method: 'POST' });
        authOverlay.classList.remove('hidden');
        if(userDropdown) userDropdown.classList.add('hidden');
        historyList.innerHTML = '<div class="no-history">No recent documents</div>';
        currentDocId = null;
        headerTitle.textContent = "Select a Document to Start";
        summaryContent.innerHTML = "Waiting for selection...";
        summaryContent.classList.add('placeholder');
        statsRow.classList.add('hidden');
        termsCloud.innerHTML = '';
        insightsList.innerHTML = '<div class="big-placeholder"><h3>Select a Knowledge Source</h3><p>Choose an item from the Sidebar History</p></div>';
        chatThread.innerHTML = '<div class="chat-bubble ai">Context cleared. Please log in again.</div>';
    });

    async function checkAuthState() {
        try {
            const res = await fetch('/auth-status');
            const data = await res.json();
            if (data.logged_in) {
                authOverlay.classList.add('hidden');
                if(activeUsernameText) activeUsernameText.textContent = data.username;
                if(userAvatar) userAvatar.textContent = data.username.charAt(0).toUpperCase();
                fetchHistory();
            } else {
                authOverlay.classList.remove('hidden');
            }
        } catch (e) {
            authOverlay.classList.remove('hidden');
        }
    }
    checkAuthState();

    async function checkAiStatus() {
        try {
            const res = await fetch('/ai-status');
            const data = await res.json();
            if (!data.connected) {
                console.log("AI not connected. Please set API Key in settings.");
            }
        } catch (e) { console.error("Status check failed", e); }
    }
    checkAiStatus();

    // PDF Extraction Logic
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async () => {
            if (!currentDocId) {
                alert('Please select or upload a document first to extract insights.');
                return;
            }
            
            showLoading('Generating Document Report...');
            
            try {
                const res = await fetch(`/document/${currentDocId}`);
                if (!res.ok) throw new Error("Failed to fetch document details");
                const doc = await res.json();
                
                const container = document.createElement('div');
                container.style.padding = '2rem';
                container.style.color = '#1e1e1e';
                container.style.fontFamily = 'Arial, sans-serif';
                container.style.lineHeight = '1.6';
                
                let html = `
                    <div style="border-bottom: 2px solid #ef4444; padding-bottom: 1rem; margin-bottom: 2rem;">
                        <h1 style="color: #ef4444; margin: 0;">Knowledge Report</h1>
                        <h3 style="color: #666; margin-top: 0.5rem; font-weight: normal;">Document: ${doc.filename}</h3>
                    </div>
                    
                    <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; margin-top: 1.5rem;">Summary</h2>
                    <p style="font-size: 1rem; color: #444;">${doc.summary}</p>
                    
                    <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; margin-top: 1.5rem;">Global Key Terms</h2>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1rem;">
                        ${doc.keywords.map(k => `<span style="background: #fee2e2; color: #ef4444; padding: 4px 10px; border-radius: 4px; font-size: 0.9rem; border: 1px solid #fecaca; display: inline-block;">${k}</span>`).join('')}
                    </div>
                    
                    <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; margin-top: 2rem;">Page-Wise Insights</h2>
                `;
                
                doc.page_insights.forEach(insight => {
                    html += `
                        <div style="margin-top: 1rem; background: #f9fafb; padding: 1rem; border-left: 4px solid #ef4444; border-radius: 4px;">
                            <strong style="color: #ef4444; font-size: 0.9rem; text-transform: uppercase;">Page ${insight.page}</strong>
                            <div style="margin-top: 0.5rem; color: #444;">${insight.insight}</div>
                        </div>
                    `;
                });
                
                container.innerHTML = html;
                
                const opt = {
                    margin: 0.5,
                    filename: `Report_${doc.filename || 'Document'}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                await html2pdf().set(opt).from(container).save();
            } catch (err) {
                alert('Error generating PDF: ' + err.message);
            } finally {
                hideLoading();
            }
        });
    }
});
