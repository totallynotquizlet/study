document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE ---
    const state = {
        deck: null,
        sessionCards: [],
        selectedTerm: null,
        selectedDef: null,
        timerInterval: null,
        startTime: 0,
        itemsLeft: 0,
        bestTime: Infinity,
        isChecking: false,
        selectedCardCount: 10
    };

    // --- CONSTANTS ---
    const STORAGE_KEY_BEST_TIME = 'flashcardAppMatchBestTime';
    const INCORRECT_DELAY = 1000;

    // --- DOM ELEMENTS ---
    const dom = {
        modeDisabled: document.getElementById('match-mode-disabled'),
        startScreen: document.getElementById('match-start-screen'),
        modeGame: document.getElementById('match-mode-game'),
        completeView: document.getElementById('match-complete-view'),
        timer: document.getElementById('match-timer'),
        bestTimeDisplay: document.getElementById('match-best-time'),
        gameArea: document.getElementById('match-game-area'),
        termsList: document.getElementById('match-terms-list'),
        defsList: document.getElementById('match-defs-list'),
        startButton: document.getElementById('match-start-button'),
        restartButton: document.getElementById('match-restart-button'),
        switchModeButton: document.getElementById('match-switch-mode-button'),
        countSlider: document.getElementById('match-count-slider'),
        countDisplay: document.getElementById('match-count-display'),
        toastNotification: document.getElementById('toast-notification')
    };

    // --- INITIALIZATION ---
    function init() {
        loadBestTime();
        loadDeck();
        attachEventListeners();
        determineView();
    }

    function loadDeck() {
        state.deck = window.TNQ.getDeck();
    }

    function loadBestTime() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_BEST_TIME);
            if (stored) {
                const parsed = parseFloat(stored);
                if (!isNaN(parsed)) {
                    state.bestTime = parsed;
                }
            }
        } catch (error) {
            console.error('Error loading best time:', error);
        }
    }

    function saveBestTime() {
        try {
            if (state.bestTime !== Infinity && !isNaN(state.bestTime)) {
                localStorage.setItem(STORAGE_KEY_BEST_TIME, state.bestTime.toString());
            }
        } catch (error) {
            console.error('Error saving best time:', error);
        }
    }

    function attachEventListeners() {
        dom.startButton.addEventListener('click', startRound);
        dom.restartButton.addEventListener('click', showStartScreen);
        dom.switchModeButton.addEventListener('click', () => {
            window.TNQ.navigateTo('type');
        });
        dom.gameArea.addEventListener('click', handleMatchClick);
        dom.countSlider.addEventListener('input', handleSliderChange);
    }

    function handleSliderChange(e) {
        const value = parseInt(e.target.value);
        state.selectedCardCount = value;
        dom.countDisplay.textContent = value;
    }

    // --- VIEW MANAGEMENT ---
    function determineView() {
        if (!state.deck || state.deck.cards.length < 2) {
            showDisabledView();
        } else {
            showStartScreen();
        }
    }

    function showDisabledView() {
        dom.modeDisabled.classList.remove('hidden');
        dom.startScreen.classList.add('hidden');
        dom.modeGame.classList.add('hidden');
        dom.completeView.classList.add('hidden');
    }

    function showStartScreen() {
        dom.modeDisabled.classList.add('hidden');
        dom.startScreen.classList.remove('hidden');
        dom.modeGame.classList.add('hidden');
        dom.completeView.classList.add('hidden');
        
        updateBestTimeDisplay();
        
        // Set slider max based on deck size
        const maxCards = Math.min(20, state.deck.cards.length);
        dom.countSlider.max = maxCards;
        
        // Adjust current selection if needed
        if (state.selectedCardCount > maxCards) {
            state.selectedCardCount = maxCards;
            dom.countSlider.value = maxCards;
            dom.countDisplay.textContent = maxCards;
        }
    }

    function showCompleteView() {
        dom.modeDisabled.classList.add('hidden');
        dom.startScreen.classList.add('hidden');
        dom.modeGame.classList.add('hidden');
        dom.completeView.classList.remove('hidden');
    }

    function updateBestTimeDisplay() {
        if (state.bestTime === Infinity) {
            dom.bestTimeDisplay.textContent = 'Best: --.-s';
        } else {
            dom.bestTimeDisplay.textContent = `Best: ${state.bestTime.toFixed(1)}s`;
        }
    }

    // --- GAME LOGIC ---
    function startRound() {
        dom.startScreen.classList.add('hidden');
        dom.modeGame.classList.remove('hidden');
        dom.completeView.classList.add('hidden');

        clearTimer();
        state.selectedTerm = null;
        state.selectedDef = null;
        state.isChecking = false;

        // Prepare session cards
        state.sessionCards = [...state.deck.cards];
        shuffleArray(state.sessionCards);
        
        // Take only the selected number of cards
        const roundCards = state.sessionCards.slice(0, state.selectedCardCount);
        state.itemsLeft = roundCards.length;

        if (state.itemsLeft < 2) {
            showCompleteView();
            return;
        }

        renderGameBoard(roundCards);

        // Start timer
        state.startTime = Date.now();
        dom.timer.textContent = '0.0s';
        state.timerInterval = setInterval(updateTimer, 100);
    }

    function renderGameBoard(cards) {
        const termItems = [];
        const defItems = [];

        for (const card of cards) {
            termItems.push(`<div class="match-item" data-id="${card.id}">${card.term}</div>`);
            defItems.push(`<div class="match-item" data-id="${card.id}">${card.definition}</div>`);
        }

        shuffleArray(termItems);
        shuffleArray(defItems);

        dom.termsList.innerHTML = termItems.join('');
        dom.defsList.innerHTML = defItems.join('');
    }

    function updateTimer() {
        const elapsed = (Date.now() - state.startTime) / 1000;
        dom.timer.textContent = `${elapsed.toFixed(1)}s`;
    }

    function clearTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function handleMatchClick(e) {
        const item = e.target.closest('.match-item');

        if (!item || item.classList.contains('correct') || state.isChecking) {
            return;
        }

        const list = item.parentElement;

        if (list.id === 'match-terms-list') {
            if (state.selectedTerm) {
                state.selectedTerm.classList.remove('selected');
            }
            state.selectedTerm = item;
            item.classList.add('selected');
        } else if (list.id === 'match-defs-list') {
            if (state.selectedDef) {
                state.selectedDef.classList.remove('selected');
            }
            state.selectedDef = item;
            item.classList.add('selected');
        }

        if (state.selectedTerm && state.selectedDef) {
            checkMatch();
        }
    }

    function checkMatch() {
        state.isChecking = true;
        const term = state.selectedTerm;
        const def = state.selectedDef;

        if (term.dataset.id === def.dataset.id) {
            // CORRECT
            term.classList.remove('selected');
            def.classList.remove('selected');
            term.classList.add('correct');
            def.classList.add('correct');

            state.itemsLeft--;

            if (state.itemsLeft === 0) {
                clearTimer();
                
                const finalTime = (Date.now() - state.startTime) / 1000;
                if (finalTime < state.bestTime) {
                    state.bestTime = finalTime;
                    saveBestTime();
                    updateBestTimeDisplay();
                    showToast(`New best time: ${finalTime.toFixed(1)}s!`);
                }

                setTimeout(() => {
                    showCompleteView();
                }, 1000);
            }

            state.isChecking = false;
        } else {
            // INCORRECT
            term.classList.remove('selected');
            def.classList.remove('selected');
            term.classList.add('incorrect');
            def.classList.add('incorrect');

            setTimeout(() => {
                term.classList.remove('incorrect');
                def.classList.remove('incorrect');
                state.isChecking = false;
            }, INCORRECT_DELAY);
        }

        state.selectedTerm = null;
        state.selectedDef = null;
    }

    // --- UTILITIES ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function showToast(message) {
        dom.toastNotification.textContent = message;
        dom.toastNotification.classList.add('show');
        setTimeout(() => {
            dom.toastNotification.classList.remove('show');
        }, 3000);
    }

    // --- START ---
    init();
});