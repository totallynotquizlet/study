document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const dom = {
        headerTitle: document.getElementById('header-title'),
        
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
        sessionCards: [],
        itemsLeft: 0,
        
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
        // 1. Get Deck from Shared Storage
        state.deck = window.TNQ.getDeck();

        if (!state.deck) {
            // Should be handled by storage.js redirect, but safety check:
            console.error("No deck loaded");
            return;
        }

        // 2. Set Header Title
        if (state.deck.title) {
            dom.headerTitle.textContent = state.deck.title;
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
        
        // Set max to total cards
        dom.slider.max = totalCards;
        
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
        const count = parseInt(dom.slider.value, 10);
        
        // 1. Prepare Session Deck
        // Shuffle full deck first to get random subset
        const shuffledDeck = [...state.deck.cards];
        shuffleArray(shuffledDeck);
        
        // Slice based on slider
        state.sessionCards = shuffledDeck.slice(0, count);
        state.itemsLeft = state.sessionCards.length;

        // 2. Render Board
        renderBoard();

        // 3. Start Timer
        state.startTime = Date.now();
        dom.timer.textContent = '0.0s';
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(updateTimer, 100);

        // 4. Show View
        showView('game');
    }

    function renderBoard() {
        // Prepare arrays
        let termItems = [];
        let defItems = [];

        state.sessionCards.forEach(card => {
            // We use card.id (assigned by storage.js or generate transiently)
            // If storage.js generated IDs are consistent, great. 
            // If not, we can generate a transient ID here or use the object reference logic.
            // Using dataset attributes is safer with strings.
            const id = card.id || Math.random().toString(36).substr(2, 9);
            // Ensure card has ID for tracking
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
        
        // Find the card object to update progress
        const card = state.sessionCards.find(c => c.id === termId);

        if (isMatch) {
            // SUCCESS
            term.classList.remove('selected');
            def.classList.remove('selected');
            term.classList.add('correct');
            def.classList.add('correct');

            if (card) window.TNQ.updateCardResult(card, true);

            state.itemsLeft--;
            state.selectedTerm = null;
            state.selectedDef = null;
            state.isChecking = false;

            if (state.itemsLeft === 0) {
                handleRoundComplete();
            }

        } else {
            // FAILURE
            term.classList.remove('selected');
            def.classList.remove('selected');
            term.classList.add('incorrect');
            def.classList.add('incorrect');

            if (card) window.TNQ.updateCardResult(card, false);

            setTimeout(() => {
                term.classList.remove('incorrect');
                def.classList.remove('incorrect');
                state.isChecking = false;
                state.selectedTerm = null;
                state.selectedDef = null;
            }, state.incorrectDelay);
        }
    }

    function handleRoundComplete() {
        clearInterval(state.timerInterval);
        
        const finalTime = (Date.now() - state.startTime) / 1000;
        
        // Check Best Time
        if (finalTime < state.bestTime) {
            state.bestTime = finalTime;
            saveBestTime();
            updateBestTimeDisplay();
            showToast(`New Best Time: ${finalTime.toFixed(1)}s!`);
        }

        // Wait a moment then show complete screen
        setTimeout(() => {
            showView('complete');
        }, 1000);
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