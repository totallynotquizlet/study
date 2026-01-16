document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const dom = {
        headerTitle: document.getElementById('header-title'),
        settingsButton: document.getElementById('settings-button'),
        
        // Views
        disabledView: document.getElementById('match-mode-disabled'),
        startScreen: document.getElementById('match-start-screen'),
        gameView: document.getElementById('match-mode-game'),
        completeView: document.getElementById('match-complete-view'),

        // Slider Controls
        slider: document.getElementById('match-count-slider'),
        sliderDisplay: document.getElementById('match-count-display'),
        startBtn: document.getElementById('match-start-button'),

        // Game Area
        gameArea: document.getElementById('match-game-area'),
        termsList: document.getElementById('match-terms-list'),
        defsList: document.getElementById('match-defs-list'),
        
        // Stats
        timer: document.getElementById('match-timer'),
        bestTimeDisplay: document.getElementById('match-best-time'),
        restartBtn: document.getElementById('match-restart-button'),
        
        // Toast
        toastNotification: document.getElementById('toast-notification')
    };

    // --- State ---
    const state = {
        deck: null,
        sessionCards: [], // The full shuffled deck for the session
        batchSize: 10,    // Cards per round
        itemsLeftInRound: 0,
        
        // Selection
        selectedTerm: null,
        selectedDef: null,
        isChecking: false,
        
        // Timing
        startTime: 0,
        timerInterval: null,
        bestTime: Infinity,
        
        // Constants
        storageKeyBestTime: 'flashcardAppMatchBestTime',
        incorrectDelay: 1000
    };

    // --- Initialization ---

    function init() {
        // Fix for modal blocking issue: Ensure they are hidden on load
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => m.classList.remove('visible'));

        // 1. Get Deck from Shared Storage
        state.deck = window.TNQ.getDeck();

        if (!state.deck) {
            console.error("No deck loaded");
            return;
        }

        // 2. Set Header Title & UI Visibility
        if (state.deck.title) {
            dom.headerTitle.textContent = state.deck.title;
        }
        
        // Show/Hide Settings button based on card count (Matches shared logic)
        if (state.deck.cards.length > 0) {
            dom.settingsButton.classList.remove('hidden');
        } else {
            dom.settingsButton.classList.add('hidden');
        }

        // 3. Load Best Time
        loadBestTime();
        updateBestTimeDisplay();

        // 4. Initial View Routing
        if (state.deck.cards.length < 2) {
            showView('disabled');
        } else {
            setupSlider();
            showView('start');
        }

        // 5. Event Listeners
        dom.startBtn.addEventListener('click', startMatch);
        dom.restartBtn.addEventListener('click', () => {
            showView('start');
            setupSlider(); // Reset slider for next round
        });
        dom.gameArea.addEventListener('click', handleCardClick);
        dom.slider.addEventListener('input', handleSliderInput);
    }

    // --- Slider Logic ---

    function setupSlider() {
        const totalCards = state.deck.cards.length;
        
        // Set max to total cards, min to 2
        dom.slider.max = totalCards;
        dom.slider.min = 2;
        
        // Default logic: Try to set to 10, or total if less than 10
        const defaultVal = Math.min(10, totalCards);
        dom.slider.value = defaultVal;
        
        // Update display
        dom.sliderDisplay.textContent = defaultVal;
    }

    function handleSliderInput(e) {
        dom.sliderDisplay.textContent = e.target.value;
    }

    // --- Game Logic ---

    function startMatch() {
        // 1. Initialize Session
        // We clone the ENTIRE deck and shuffle it. 
        // Rounds will deplete this array.
        state.sessionCards = [...state.deck.cards];
        shuffleArray(state.sessionCards);
        
        // 2. Set Batch Size from Slider
        state.batchSize = parseInt(dom.slider.value, 10);
        
        // 3. Start First Round
        startRound();
    }
    
    function startRound() {
        // 1. Check if we have cards left
        if (state.sessionCards.length === 0) {
            handleComplete();
            return;
        }

        // 2. Extract Batch
        // Determine how many to take (Batch Size or remainder)
        const count = Math.min(state.batchSize, state.sessionCards.length);
        
        // These are the cards for THIS round. 
        const roundCards = state.sessionCards.slice(0, count);
        state.itemsLeftInRound = count;

        // 3. Render Board
        renderBoard(roundCards);

        // 4. Start Timer
        state.startTime = Date.now();
        dom.timer.textContent = '0.0s';
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(updateTimer, 100);

        // 5. Show View
        showView('game');
    }

    function renderBoard(cards) {
        // Prepare arrays
        let termItems = [];
        let defItems = [];

        cards.forEach(card => {
            // Ensure card has ID for tracking
            const id = card.id || Math.random().toString(36).substr(2, 9);
            card.id = id; 

            termItems.push(createCardElement(card.term, id, 'term'));
            defItems.push(createCardElement(card.definition, id, 'def'));
        });

        // Shuffle independently
        shuffleArray(termItems);
        shuffleArray(defItems);

        // Inject
        dom.termsList.innerHTML = termItems.join('');
        dom.defsList.innerHTML = defItems.join('');
        
        // Reset selections
        state.selectedTerm = null;
        state.selectedDef = null;
        state.isChecking = false;
    }

    function createCardElement(text, id, type) {
        return `<div class="match-item" data-id="${id}" data-type="${type}">${text}</div>`;
    }

    function updateTimer() {
        const elapsed = (Date.now() - state.startTime) / 1000;
        dom.timer.textContent = `${elapsed.toFixed(1)}s`;
    }

    // --- Interaction ---

    function handleCardClick(e) {
        if (state.isChecking) return;

        const item = e.target.closest('.match-item');
        // Ignore if not an item or already matched
        if (!item || item.classList.contains('correct')) return;

        const type = item.dataset.type;

        // Selection Logic
        if (type === 'term') {
            if (state.selectedTerm) state.selectedTerm.classList.remove('selected');
            state.selectedTerm = item;
            item.classList.add('selected');
        } else {
            if (state.selectedDef) state.selectedDef.classList.remove('selected');
            state.selectedDef = item;
            item.classList.add('selected');
        }

        // Check for match
        if (state.selectedTerm && state.selectedDef) {
            checkMatch();
        }
    }

    function checkMatch() {
        state.isChecking = true;

        const term = state.selectedTerm;
        const def = state.selectedDef;
        const termId = term.dataset.id;
        const defId = def.dataset.id;
        
        const isMatch = termId === defId;
        
        // Find the card object (in the full session list)
        const cardIndex = state.sessionCards.findIndex(c => c.id === termId);
        const card = cardIndex !== -1 ? state.sessionCards[cardIndex] : null;

        if (isMatch) {
            // SUCCESS
            term.classList.remove('selected');
            def.classList.remove('selected');
            term.classList.add('correct');
            def.classList.add('correct');

            if (card) {
                window.TNQ.updateCardResult(card, true);
                // Remove from session cards so it doesn't appear in next round
                state.sessionCards.splice(cardIndex, 1);
            }

            state.itemsLeftInRound--;
            state.selectedTerm = null;
            state.selectedDef = null;
            state.isChecking = false;

            if (state.itemsLeftInRound === 0) {
                handleRoundClear();
            }

        } else {
            // FAILURE
            term.classList.remove('selected');
            def.classList.remove('selected');
            term.classList.add('incorrect');
            def.classList.add('incorrect');

            if (card) {
                window.TNQ.updateCardResult(card, false);
            }

            setTimeout(() => {
                term.classList.remove('incorrect');
                def.classList.remove('incorrect');
                state.isChecking = false;
                state.selectedTerm = null;
                state.selectedDef = null;
            }, state.incorrectDelay);
        }
    }

    function handleRoundClear() {
        clearInterval(state.timerInterval);
        const roundTime = (Date.now() - state.startTime) / 1000;

        // Check Best Time (Per Round)
        if (roundTime < state.bestTime) {
            state.bestTime = roundTime;
            saveBestTime();
            updateBestTimeDisplay();
            showToast(`New Best Time: ${roundTime.toFixed(1)}s!`);
        }

        // Check if more cards remain in the session
        if (state.sessionCards.length >= 2) { // Need at least 2 for a match
            // Auto-start next round after delay
            setTimeout(() => {
                startRound();
            }, 1000);
        } else {
            // Session Complete
            setTimeout(() => {
                handleComplete();
            }, 1000);
        }
    }

    function handleComplete() {
        showView('complete');
    }

    // --- Helpers & Utilities ---

    function showView(viewName) {
        dom.disabledView.classList.add('hidden');
        dom.startScreen.classList.add('hidden');
        dom.gameView.classList.add('hidden');
        dom.completeView.classList.add('hidden');

        if (viewName === 'disabled') dom.disabledView.classList.remove('hidden');
        if (viewName === 'start') dom.startScreen.classList.remove('hidden');
        if (viewName === 'game') dom.gameView.classList.remove('hidden');
        if (viewName === 'complete') dom.completeView.classList.remove('hidden');
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function loadBestTime() {
        const stored = localStorage.getItem(state.storageKeyBestTime);
        if (stored) {
            const val = parseFloat(stored);
            if (!isNaN(val)) state.bestTime = val;
        }
    }

    function saveBestTime() {
        if (state.bestTime !== Infinity) {
            localStorage.setItem(state.storageKeyBestTime, state.bestTime.toString());
        }
    }

    function updateBestTimeDisplay() {
        if (state.bestTime === Infinity) {
            dom.bestTimeDisplay.textContent = 'Best: --.-s';
        } else {
            dom.bestTimeDisplay.textContent = `Best: ${state.bestTime.toFixed(1)}s`;
        }
    }

    function showToast(message) {
        dom.toastNotification.textContent = message;
        dom.toastNotification.classList.add('show');
        setTimeout(() => {
            dom.toastNotification.classList.remove('show');
        }, 3000);
    }

    // Start
    init();
});