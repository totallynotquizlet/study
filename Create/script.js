document.addEventListener('DOMContentLoaded', () => {

    // --- STATE ---
    const app = {
        createMode: 'paste', // 'manual' or 'paste'
        toastTimeout: null,
        // Default deck structure
        currentDeck: {
            title: '',
            cards: [],
            settings: {
                shuffle: false,
                termFirst: true
            }
        }
    };

    // --- DOM ELEMENTS ---
    const dom = {
        deckTitleInput: document.getElementById('deck-title-input'),
        toggleManualButton: document.getElementById('toggle-manual-button'),
        togglePasteButton: document.getElementById('toggle-paste-button'),
        clearCreateButton: document.getElementById('clear-create-button'),
        manualInputSection: document.getElementById('manual-input-section'),
        pasteInputSection: document.getElementById('paste-input-section'),
        cardEditorList: document.getElementById('card-editor-list'),
        addCardButton: document.getElementById('add-card-button'),
        deckInputArea: document.getElementById('deck-input-area'), 
        parseDeckButton: document.getElementById('parse-deck-button'),
        toastNotification: document.getElementById('toast-notification') || createToastElement(),
    };

    // --- INITIALIZATION ---
    function init() {
        addEventListeners();
        
        // Initialize Manual Mode with 3 empty rows (just in case user switches)
        createNewCardRow();
        createNewCardRow();
        createNewCardRow();
    }

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        // Mode Toggles
        dom.toggleManualButton.addEventListener('click', () => setCreateMode('manual'));
        dom.togglePasteButton.addEventListener('click', () => setCreateMode('paste'));

        // Action Buttons
        dom.parseDeckButton.addEventListener('click', handleCreateDeck);
        dom.addCardButton.addEventListener('click', () => createNewCardRow());
        dom.clearCreateButton.addEventListener('click', handleClear);

        // Manual Editor Delegation (Delete & Resize)
        dom.cardEditorList.addEventListener('click', (e) => {
            if (e.target.closest('.delete-card-button')) {
                e.target.closest('.card-editor-row').remove();
                updateCardRowNumbers();
            }
        });

        dom.cardEditorList.addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA') {
                autoResizeTextarea(e.target);
            }
        });

        // Keyboard Navigation for Manual Mode
        dom.cardEditorList.addEventListener('keydown', handleEditorKeydown);
    }

    // --- CORE LOGIC: CREATE & REDIRECT ---

    /**
     * Gathers data, validates, encodes, and redirects to Flashcards.
     */
    function handleCreateDeck() {
        const title = dom.deckTitleInput.value.trim() || 'Untitled Deck';
        let newCards = [];
        let errorCount = 0;

        if (app.createMode === 'manual') {
            const rows = dom.cardEditorList.querySelectorAll('.card-editor-row');
            rows.forEach(row => {
                const term = row.querySelector('.term-input').value.trim();
                const definition = row.querySelector('.def-input').value.trim();
                
                if (term && definition) {
                    newCards.push({ term, definition });
                } else if (term || definition) {
                    // One field filled, one empty
                    errorCount++;
                }
            });
        } else {
            // Paste Mode
            const input = dom.deckInputArea.value.trim();
            if (input) {
                const lines = input.split('\n');
                for (const line of lines) {
                    const parts = line.split(',');
                    if (parts.length >= 2) {
                        const term = parts[0].trim();
                        // Join rest in case definition contains commas
                        const definition = parts.slice(1).join(',').trim(); 
                        
                        if (term && definition) {
                            newCards.push({ term, definition });
                        } else {
                            errorCount++;
                        }
                    } else if (line.trim() !== '') {
                        errorCount++;
                    }
                }
            }
        }

        // --- VALIDATION ---
        if (newCards.length === 0) {
            showToast("Please add at least one valid card (Term, Definition).", "error");
            return;
        }

        if (errorCount > 0) {
            showToast(`Skipped ${errorCount} incomplete lines/rows.`, "warning");
        }

        // --- CONSTRUCTION ---
        const newDeck = {
            title: title,
            cards: newCards,
            settings: app.currentDeck.settings // Default settings
        };

        // --- ENCODING & REDIRECT ---
        try {
            const jsonString = JSON.stringify(newDeck);
            const base64String = base64UrlEncode(jsonString);
            const newHash = `#${base64String}`;

            // Redirect to the Flashcards page with the new hash
            // This is the core "Multi-Page" transition
            window.location.href = `flashcards.html${newHash}`;

        } catch (error) {
            console.error("Encoding error:", error);
            showToast("Error creating deck link.", "error");
        }
    }

    // --- UI LOGIC ---

    function setCreateMode(mode) {
        app.createMode = mode;
        if (mode === 'manual') {
            dom.manualInputSection.classList.remove('hidden');
            dom.pasteInputSection.classList.add('hidden');
            dom.toggleManualButton.classList.add('active');
            dom.togglePasteButton.classList.remove('active');
        } else {
            dom.manualInputSection.classList.add('hidden');
            dom.pasteInputSection.classList.remove('hidden');
            dom.toggleManualButton.classList.remove('active');
            dom.togglePasteButton.classList.add('active');
        }
    }

    function createNewCardRow() {
        const row = document.createElement('div');
        row.className = 'card-editor-row';
        const rowNumber = dom.cardEditorList.children.length + 1;

        row.innerHTML = `
            <span class="card-row-number">${rowNumber}</span>
            <div class="card-input-wrapper">
                <textarea class="term-input" rows="1" placeholder="Enter term"></textarea>
                <label class="card-input-label">TERM</label>
            </div>
            <div class="card-input-wrapper">
                <textarea class="def-input" rows="1" placeholder="Enter definition"></textarea>
                <label class="card-input-label">DEFINITION</label>
            </div>
            <button class="delete-card-button" title="Delete card">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        dom.cardEditorList.appendChild(row);
    }

    function updateCardRowNumbers() {
        const rows = dom.cardEditorList.querySelectorAll('.card-editor-row');
        rows.forEach((row, index) => {
            row.querySelector('.card-row-number').textContent = index + 1;
        });
    }

    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    function handleClear() {
        if (confirm("Are you sure you want to clear all inputs?")) {
            dom.deckTitleInput.value = '';
            dom.deckInputArea.value = '';
            dom.cardEditorList.innerHTML = '';
            createNewCardRow();
            createNewCardRow();
            createNewCardRow();
            showToast("Cleared.");
        }
    }

    function handleEditorKeydown(e) {
        // Simple Shift+Enter to add new card
        if (e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            createNewCardRow();
            const newRow = dom.cardEditorList.lastElementChild;
            newRow.querySelector('.term-input').focus();
        }
    }

    // --- UTILITIES ---

    function base64UrlEncode(str) {
        const utf8Bytes = new TextEncoder().encode(str);
        const binaryString = String.fromCharCode.apply(null, utf8Bytes);
        const base64String = btoa(binaryString);
        return base64String
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // Helper to create the toast container if I forgot it in HTML
    function createToastElement() {
        const div = document.createElement('div');
        div.id = 'toast-notification';
        div.className = 'fixed bottom-6 right-6 py-3 px-5 rounded-lg shadow-xl opacity-0 translate-y-4 transition-all duration-300 z-50 bg-gray-800 text-white border border-gray-700 font-semibold';
        document.body.appendChild(div);
        return div;
    }

    function showToast(message, type = 'info') {
        if (app.toastTimeout) clearTimeout(app.toastTimeout);
        
        dom.toastNotification.textContent = message;
        dom.toastNotification.style.opacity = '1';
        dom.toastNotification.style.transform = 'translateY(0)';
        
        // Simple color coding
        if (type === 'error') dom.toastNotification.style.borderColor = '#ef4444'; // Red
        else dom.toastNotification.style.borderColor = '#3a497c'; // Default

        app.toastTimeout = setTimeout(() => {
            dom.toastNotification.style.opacity = '0';
            dom.toastNotification.style.transform = 'translateY(20px)';
        }, 3000);
    }

    // Start
    init();
});