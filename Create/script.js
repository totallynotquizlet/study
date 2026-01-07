document.addEventListener('DOMContentLoaded', () => {

    // --- STATE ---
    const app = {
        createMode: 'manual', // 'manual' or 'paste'
        draggedItem: null,
        isDirty: false
    };

    // --- DOM ELEMENTS ---
    const dom = {
        // Inputs
        deckTitleInput: document.getElementById('deck-title-input'),
        
        // Toggles
        toggleManualButton: document.getElementById('toggle-manual-button'),
        togglePasteButton: document.getElementById('toggle-paste-button'),
        
        // Sections
        manualInputSection: document.getElementById('manual-input-section'),
        pasteInputSection: document.getElementById('paste-input-section'),
        
        // Manual Editor
        cardEditorList: document.getElementById('card-editor-list'),
        addCardButton: document.getElementById('add-card-button'),
        
        // Paste Editor
        deckInputArea: document.getElementById('deck-input-area'),
        
        // Actions
        parseDeckButton: document.getElementById('parse-deck-button'),
        clearCreateButton: document.getElementById('clear-create-button'),
        
        // Clear Modal
        clearConfirmModalOverlay: document.getElementById('clear-confirm-modal-overlay'),
        clearConfirmButton: document.getElementById('clear-confirm-button'),
        clearCancelButton: document.getElementById('clear-cancel-button'),
        
        // Unsaved Modal (reusing logic if user tries to leave via specific buttons if needed, 
        // generally standard browser beforeunload is used for page navigation)
        toastNotification: document.getElementById('toast-notification')
    };

    // --- INITIALIZATION ---
    function init() {
        // Start with 3 empty rows
        createNewCardRow();
        createNewCardRow();
        createNewCardRow();
        
        addEventListeners();
    }

    // --- CORE FUNCTIONS ---

    /**
     * Creates a new card row in the manual editor.
     */
    function createNewCardRow(term = '', definition = '') {
        const row = document.createElement('div');
        row.className = 'card-editor-row';
        row.setAttribute('draggable', 'true');

        // Determine next row number
        const rowNumber = dom.cardEditorList.children.length + 1;

        row.innerHTML = `
            <div class="drag-handle" title="Drag to reorder">
                <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M7 2a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1V3a1 1 0 00-1-1H7zM7 6a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1V7a1 1 0 00-1-1H7zM7 10a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H7zM7 14a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H7zM11 2a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1V3a1 1 0 00-1-1h-1zM11 6a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1V7a1 1 0 00-1-1h-1zM11 10a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1h-1zM11 14a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1h-1z"></path></svg>
            </div>
            <span class="card-row-number">${rowNumber}</span>
            <div class="card-input-wrapper">
                <textarea class="term-input" rows="1" placeholder="Enter term">${term}</textarea>
                <label class="create-label">TERM</label>
            </div>
            <div class="card-input-wrapper">
                <textarea class="def-input" rows="1" placeholder="Enter definition">${definition}</textarea>
                <label class="create-label">DEFINITION</label>
            </div>
            <button class="delete-card-button" title="Delete card">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        dom.cardEditorList.appendChild(row);
        
        // Auto-resize the new textareas
        const textareas = row.querySelectorAll('textarea');
        textareas.forEach(autoResizeTextarea);
    }

    /**
     * Updates the numbers for all card rows.
     */
    function updateCardRowNumbers() {
        const rows = dom.cardEditorList.querySelectorAll('.card-editor-row');
        rows.forEach((row, index) => {
            row.querySelector('.card-row-number').textContent = index + 1;
        });
    }

    /**
     * Auto-resizes a textarea to fit its content.
     */
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
    }

    /**
     * Sets the create mode (manual or paste).
     */
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

    /**
     * Parses the deck, encodes it, and redirects to Flashcards.
     */
    function parseAndRedirect() {
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
                    errorCount++;
                }
            });
        } else {
            // Paste mode logic
            const input = dom.deckInputArea.value.trim();
            if (input) {
                const lines = input.split('\n');
                for (const line of lines) {
                    const parts = line.split(',');
                    if (parts.length >= 2) {
                        const term = parts[0].trim();
                        // Join remaining parts as definition (allows commas in def)
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

        if (newCards.length === 0) {
            showToast("Please add at least one valid card (Term and Definition).");
            return;
        }

        // Construct the deck object
        const newDeck = {
            title: title,
            cards: newCards,
            settings: {
                shuffle: false,
                termFirst: true
            }
        };

        try {
            const jsonString = JSON.stringify(newDeck);
            const base64String = base64UrlEncode(jsonString);
            
            // Mark as clean so beforeunload doesn't trigger
            app.isDirty = false;
            
            // Redirect to Flashcards mode with the new hash
            window.location.href = `../Flashcards/#${base64String}`;

        } catch (error) {
            console.error("Error creating deck hash:", error);
            showToast("An error occurred. Please check your text inputs.");
        }
    }

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        // Mode Toggles
        dom.toggleManualButton.addEventListener('click', () => setCreateMode('manual'));
        dom.togglePasteButton.addEventListener('click', () => setCreateMode('paste'));
        
        // Add Card
        dom.addCardButton.addEventListener('click', () => {
            createNewCardRow();
            app.isDirty = true;
        });

        // Create Deck (Submit)
        dom.parseDeckButton.addEventListener('click', parseAndRedirect);

        // Input Changes (Mark Dirty)
        dom.deckTitleInput.addEventListener('input', () => { app.isDirty = true; });
        dom.deckInputArea.addEventListener('input', () => { app.isDirty = true; });

        // Card Editor Delegation
        dom.cardEditorList.addEventListener('click', (e) => {
            // Delete Button
            if (e.target.closest('.delete-card-button')) {
                const row = e.target.closest('.card-editor-row');
                row.remove();
                updateCardRowNumbers();
                app.isDirty = true;
            }
        });

        dom.cardEditorList.addEventListener('input', (e) => {
            // Auto-resize Textareas
            if (e.target.tagName === 'TEXTAREA') {
                autoResizeTextarea(e.target);
                app.isDirty = true;
            }
        });

        // Keyboard Navigation (Tab, Shift+Enter)
        dom.cardEditorList.addEventListener('keydown', handleEditorKeydown);

        // Drag and Drop
        dom.cardEditorList.addEventListener('dragstart', handleDragStart);
        dom.cardEditorList.addEventListener('dragover', handleDragOver);
        dom.cardEditorList.addEventListener('drop', handleDrop);
        dom.cardEditorList.addEventListener('dragend', handleDragEnd);

        // Clear All Modal
        dom.clearCreateButton.addEventListener('click', showClearConfirmModal);
        dom.clearCancelButton.addEventListener('click', hideClearConfirmModal);
        dom.clearConfirmButton.addEventListener('click', handleClearAll);

        // Warn on page exit if dirty
        window.addEventListener('beforeunload', (e) => {
            if (app.isDirty) {
                e.preventDefault();
                e.returnValue = ''; // Chrome requires this to be set
            }
        });
    }

    // --- HANDLERS ---

    function handleEditorKeydown(e) {
        const target = e.target;
        if (target.tagName !== 'TEXTAREA') return;

        const currentRow = target.closest('.card-editor-row');
        if (!currentRow) return;

        const isTermInput = target.classList.contains('term-input');
        const isDefInput = target.classList.contains('def-input');

        // Shift + Enter: Add new card below
        if (e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            app.isDirty = true;
            createNewCardRow();
            const newRow = dom.cardEditorList.lastChild;
            currentRow.after(newRow); // Move to correct position
            updateCardRowNumbers();
            newRow.querySelector('.term-input').focus();
        }
        // Tab navigation logic (basic)
        else if (e.key === 'Tab' && !e.shiftKey && isTermInput) {
            e.preventDefault();
            currentRow.querySelector('.def-input').focus();
        }
    }

    // --- DRAG AND DROP ---
    function handleDragStart(e) {
        if (!e.target.classList.contains('card-editor-row')) return;
        app.draggedItem = e.target;
        e.dataTransfer.setData('text/plain', null);
        setTimeout(() => app.draggedItem.classList.add('dragging'), 0);
    }

    function handleDragOver(e) {
        e.preventDefault();
        const container = dom.cardEditorList;
        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
            container.appendChild(app.draggedItem);
        } else {
            container.insertBefore(app.draggedItem, afterElement);
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        updateCardRowNumbers();
        app.isDirty = true;
    }

    function handleDragEnd() {
        if (app.draggedItem) app.draggedItem.classList.remove('dragging');
        app.draggedItem = null;
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.card-editor-row:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- CLEAR MODAL UTILS ---
    function showClearConfirmModal() {
        dom.clearConfirmModalOverlay.classList.add('visible');
    }
    function hideClearConfirmModal() {
        dom.clearConfirmModalOverlay.classList.remove('visible');
    }
    function handleClearAll() {
        dom.deckTitleInput.value = '';
        dom.cardEditorList.innerHTML = '';
        dom.deckInputArea.value = '';
        createNewCardRow();
        createNewCardRow();
        createNewCardRow();
        app.isDirty = false;
        hideClearConfirmModal();
        showToast("Inputs cleared.");
    }

    // --- UTILITIES ---

    function showToast(message) {
        dom.toastNotification.textContent = message;
        dom.toastNotification.classList.add('show');
        setTimeout(() => {
            dom.toastNotification.classList.remove('show');
        }, 3000);
    }

    function base64UrlEncode(str) {
        const utf8Bytes = new TextEncoder().encode(str);
        const binaryString = String.fromCharCode.apply(null, utf8Bytes);
        const base64String = btoa(binaryString);
        return base64String
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // Start
    init();
});