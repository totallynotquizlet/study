/**
 * Learn Mode Logic
 * Handles the quiz flow, answer validation, SRS updates, and session persistence.
 * Also handles the Settings Modal logic.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONSTANTS ---
    const CORRECT_ANSWER_DELAY = 1000;
    const SESSION_STORAGE_KEY = 'tnq-learn-session';

    // --- STATE ---
    const state = {
        deck: null,
        sessionCards: [], // Cards remaining in the current session
        currentCard: null,
        isSessionActive: false,
        correctAnswerTimeout: null,
        settingsBeforeEdit: null // To track changes in settings modal
    };

    // --- DOM ELEMENTS ---
    const dom = {
        headerTitle: document.getElementById('header-title'),
        progressBarContainer: document.getElementById('learn-progress-container'),
        progressBar: document.getElementById('learn-progress-bar'),
        settingsButton: document.getElementById('settings-button'),
        
        // Views
        disabledView: document.getElementById('learn-mode-disabled'),
        quizView: document.getElementById('learn-mode-quiz'),
        completeView: document.getElementById('learn-complete-view'),
        
        // Quiz Elements
        termDisplay: document.getElementById('learn-term'),
        optionsContainer: document.getElementById('learn-options'),
        
        // Controls
        restartSessionBtn: document.getElementById('learn-restart-session-button'),
        skipBtn: document.getElementById('learn-skip-button'),
        
        // Feedback
        feedbackContainer: document.getElementById('learn-feedback-container'),
        feedbackBox: document.getElementById('learn-feedback'),
        feedbackMessage: document.getElementById('learn-feedback-message'),
        continueBtn: document.getElementById('learn-continue-button'),
        
        // Complete View Controls
        restartCompleteBtn: document.getElementById('learn-restart-button'),
        switchModeBtn: document.getElementById('learn-switch-mode-button'),
        backToCreateBtn: document.getElementById('back-to-create-btn'),
        
        // Settings Modal
        settingsModalOverlay: document.getElementById('settings-modal-overlay'),
        settingsModalClose: document.getElementById('settings-modal-close'),
        settingsModalBackdrop: document.querySelector('#settings-modal-overlay .modal-backdrop'),
        settingDeckTitle: document.getElementById('setting-deck-title'),
        settingToggleShuffle: document.getElementById('setting-toggle-shuffle'),
        settingToggleStartWith: document.getElementById('setting-toggle-start-with'),
        copyDeckButton: document.getElementById('copy-deck-button'),

        toast: document.getElementById('toast-notification')
    };

    // --- INITIALIZATION ---

    function init() {
        // TNQ is exposed by shared/storage.js
        if (!window.TNQ) {
            console.error("TNQ Storage not loaded");
            return;
        }

        const deck = window.TNQ.getDeck();
        
        // Deck validation is handled by storage.js (redirects if empty), 
        // but we double check for UI state
        if (!deck) return;

        state.deck = deck;
        dom.headerTitle.textContent = deck.title || "Learn Mode";
        dom.settingsButton.classList.remove('hidden'); // Show settings button

        // Check if we have enough cards
        if (state.deck.cards.length < 4) {
            showDisabledState();
            return;
        }

        // Try to load existing session or start new
        if (!loadSession()) {
            startNewSession();
        }

        addEventListeners();
    }

    // --- SESSION MANAGEMENT ---

    function startNewSession() {
        // Create a copy of the deck for this session
        state.sessionCards = [...state.deck.cards];
        
        // Apply shuffle setting immediately for the new session
        if (state.deck.settings.shuffle) {
            shuffleArray(state.sessionCards);
        }
        
        // Reset local tracking properties
        state.sessionCards.forEach(card => card.skipCount = 0);
        
        state.isSessionActive = true;
        saveSession();
        renderQuestion();
    }

    function loadSession() {
        try {
            const saved = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!saved) return false;

            const parsed = JSON.parse(saved);
            
            // Validate that the session belongs to the current deck hash
            // (We assume URL hash hasn't changed, or we'd be in a different context)
            const currentHash = window.location.hash.substring(1);
            if (parsed.deckHash !== currentHash) return false;

            // Reconstruct session cards from IDs
            state.sessionCards = parsed.cardIds.map(id => {
                return state.deck.cards.find(c => c.id === id);
            }).filter(Boolean); // Remove nulls if cards were deleted

            if (state.sessionCards.length === 0 && !parsed.isComplete) {
                return false; // Invalid empty session
            }

            state.isSessionActive = true;
            renderQuestion();
            return true;
        } catch (e) {
            console.error("Failed to load session", e);
            return false;
        }
    }

    function saveSession() {
        try {
            const currentHash = window.location.hash.substring(1);
            const data = {
                deckHash: currentHash,
                cardIds: state.sessionCards.map(c => c.id),
                isComplete: state.sessionCards.length === 0
            };
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error("Failed to save session", e);
        }
    }

    // --- RENDERING ---

    function showDisabledState() {
        dom.disabledView.classList.remove('hidden');
        dom.quizView.classList.add('hidden');
        dom.completeView.classList.add('hidden');
        dom.progressBarContainer.classList.add('hidden');
    }

    function renderQuestion() {
        // Clear auto-advance timer
        if (state.correctAnswerTimeout) {
            clearTimeout(state.correctAnswerTimeout);
            state.correctAnswerTimeout = null;
        }

        updateProgressBar();

        // Check completion
        if (state.sessionCards.length === 0) {
            showCompleteState();
            return;
        }

        // Setup View
        dom.quizView.classList.remove('hidden');
        dom.completeView.classList.add('hidden');
        dom.disabledView.classList.add('hidden');
        dom.progressBarContainer.classList.remove('hidden');
        dom.feedbackContainer.classList.add('hidden');
        dom.skipBtn.classList.remove('hidden'); // Show skip

        // Get current card
        state.currentCard = state.sessionCards[0];
        
        // Determine Question/Answer based on settings
        const termFirst = state.deck.settings.termFirst;
        const questionText = termFirst ? state.currentCard.term : state.currentCard.definition;

        dom.termDisplay.textContent = questionText;

        // Generate Options
        const options = generateQuizOptions(state.currentCard);
        
        dom.optionsContainer.innerHTML = '';
        options.forEach((optText, index) => {
            const btn = document.createElement('button');
            btn.className = 'learn-option';
            btn.textContent = optText;
            btn.dataset.answer = optText;
            btn.addEventListener('click', handleAnswer);
            dom.optionsContainer.appendChild(btn);
        });
    }

    function showCompleteState() {
        dom.quizView.classList.add('hidden');
        dom.completeView.classList.remove('hidden');
        dom.progressBarContainer.classList.add('hidden');
        
        // Clear session storage so refresh starts new
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    function updateProgressBar() {
        const total = state.deck.cards.length;
        if (total === 0) return;
        const remaining = state.sessionCards.length;
        const completed = total - remaining;
        const percentage = (completed / total) * 100;
        dom.progressBar.style.width = `${percentage}%`;
    }

    // --- LOGIC: OPTIONS GENERATION ---

    function generateQuizOptions(correctCard) {
        const termFirst = state.deck.settings.termFirst;
        const correctText = termFirst ? correctCard.definition : correctCard.term;
        const compareText = correctText.toLowerCase();

        // Pool of potential distractors (all other cards)
        const pool = state.deck.cards.filter(c => c.id !== correctCard.id);

        // Calculate distances for "smart" distractors
        const withDist = pool.map(c => {
            const txt = termFirst ? c.definition : c.term;
            return {
                text: txt,
                dist: levenshteinDistance(compareText, txt.toLowerCase())
            };
        });

        // Sort by similarity (closest distance first)
        withDist.sort((a, b) => a.dist - b.dist);

        const options = [correctText];
        const used = new Set([correctText]);

        // Add closest unique distractors
        for (const item of withDist) {
            if (options.length >= 4) break;
            if (!used.has(item.text)) {
                options.push(item.text);
                used.add(item.text);
            }
        }

        // Fill with random if needed (for small decks or identical terms)
        if (options.length < 4) {
            const shuffledPool = [...pool];
            shuffleArray(shuffledPool);
            for (const c of shuffledPool) {
                if (options.length >= 4) break;
                const txt = termFirst ? c.definition : c.term;
                if (!used.has(txt)) {
                    options.push(txt);
                    used.add(txt);
                }
            }
        }

        shuffleArray(options);
        return options.slice(0, 4);
    }

    // --- LOGIC: ANSWER HANDLING ---

    function handleAnswer(e) {
        const selectedBtn = e.currentTarget;
        const selectedText = selectedBtn.dataset.answer;
        
        const termFirst = state.deck.settings.termFirst;
        const correctText = termFirst ? state.currentCard.definition : state.currentCard.term;
        
        const isCorrect = selectedText === correctText;

        // UI Updates
        const allBtns = dom.optionsContainer.querySelectorAll('button');
        allBtns.forEach(btn => {
            btn.disabled = true; // Disable all
            if (btn.dataset.answer === correctText) {
                btn.classList.add('correct');
            } else if (btn === selectedBtn && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        dom.skipBtn.classList.add('hidden'); // Hide skip during feedback

        // Logic Updates
        if (isCorrect) {
            // Remove from session
            state.sessionCards.shift();
            
            // Update Progress & UI
            TNQ.updateCardResult(state.currentCard, true);
            showFeedback(true, "Correct!");
            
            // Auto advance
            state.correctAnswerTimeout = setTimeout(() => {
                renderQuestion();
                saveSession();
            }, CORRECT_ANSWER_DELAY);

        } else {
            // Incorrect: Move to back (Standard queue behavior)
            const card = state.sessionCards.shift();
            state.sessionCards.push(card);
            
            TNQ.updateCardResult(state.currentCard, false);
            showFeedback(false, `Incorrect. The correct answer is: ${correctText}`);
            
            // Manual advance required
            dom.continueBtn.classList.remove('hidden');
        }

        saveSession();
    }

    function handleSkip() {
        if (!state.currentCard) return;

        const card = state.sessionCards.shift();
        card.skipCount = (card.skipCount || 0) + 1;

        if (card.skipCount >= 2) {
            showToast("Skipped twice. Removing from this round.");
            // Logic: It's already shifted off, just don't push it back.
        } else {
            state.sessionCards.push(card);
            showToast("Skipped. Moved to end.");
        }

        saveSession();
        renderQuestion();
    }

    function showFeedback(isCorrect, message) {
        dom.feedbackContainer.classList.remove('hidden');
        dom.feedbackBox.className = isCorrect ? 'correct' : 'incorrect'; // Reset classes
        // Re-add layout classes from CSS if needed, but the ID selector handles most styles
        // Ensure flex layout persists if classes overwrite
        dom.feedbackBox.style.display = 'flex'; 
        
        dom.feedbackMessage.textContent = message;

        if (isCorrect) {
            dom.continueBtn.classList.add('hidden');
        } else {
            dom.continueBtn.classList.remove('hidden');
        }
    }

    // --- SETTINGS MODAL LOGIC ---

    function showSettingsModal() {
        dom.settingDeckTitle.value = state.deck.title;
        updateSettingsToggle(dom.settingToggleShuffle, state.deck.settings.shuffle, "Shuffle");
        updateSettingsToggle(dom.settingToggleStartWith, state.deck.settings.termFirst, "Term", "Definition");
        
        // Snapshot settings
        state.settingsBeforeEdit = { ...state.deck.settings };
        dom.settingsModalOverlay.classList.add('visible');
    }

    function hideSettingsModal() {
        dom.settingsModalOverlay.classList.remove('visible');
        
        // Check if vital settings changed
        if (state.settingsBeforeEdit.termFirst !== state.deck.settings.termFirst || 
            state.settingsBeforeEdit.shuffle !== state.deck.settings.shuffle) {
            
            // Restart session with new settings
            startNewSession();
        }
    }

    function updateSettingsToggle(button, isActive, activeText, inactiveText = null) {
        if (isActive) {
            button.classList.add('active');
            button.textContent = inactiveText ? activeText : `${activeText}: ON`;
        } else {
            button.classList.remove('active');
            button.textContent = inactiveText ? inactiveText : `${activeText}: OFF`;
        }
    }

    function handleTitleSettingChange() {
        const newTitle = dom.settingDeckTitle.value;
        state.deck.title = newTitle;
        dom.headerTitle.textContent = newTitle;
        TNQ.saveDeckToHash(state.deck);
    }

    function handleShuffleSettingChange() {
        state.deck.settings.shuffle = !state.deck.settings.shuffle;
        updateSettingsToggle(dom.settingToggleShuffle, state.deck.settings.shuffle, "Shuffle");
        TNQ.saveDeckToHash(state.deck);
    }

    function handleStartWithSettingChange() {
        state.deck.settings.termFirst = !state.deck.settings.termFirst;
        updateSettingsToggle(dom.settingToggleStartWith, state.deck.settings.termFirst, "Term", "Definition");
        TNQ.saveDeckToHash(state.deck);
    }
    
    function copyDeckTerms() {
        const text = state.deck.cards.map(c => `${c.term},${c.definition}`).join('\n');
        navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!"));
    }

    // --- EVENT LISTENERS ---

    function addEventListeners() {
        dom.restartSessionBtn.addEventListener('click', startNewSession);
        dom.restartCompleteBtn.addEventListener('click', startNewSession);
        
        dom.skipBtn.addEventListener('click', handleSkip);
        
        dom.continueBtn.addEventListener('click', () => {
            if (state.correctAnswerTimeout) clearTimeout(state.correctAnswerTimeout);
            renderQuestion();
        });

        dom.switchModeBtn.addEventListener('click', () => {
             TNQ.navigateTo('match');
        });

        if (dom.backToCreateBtn) {
            dom.backToCreateBtn.addEventListener('click', () => {
                TNQ.navigateTo('create');
            });
        }

        // Settings Listeners
        dom.settingsButton.addEventListener('click', showSettingsModal);
        dom.settingsModalClose.addEventListener('click', hideSettingsModal);
        dom.settingsModalBackdrop.addEventListener('click', hideSettingsModal);
        
        dom.settingDeckTitle.addEventListener('input', handleTitleSettingChange);
        dom.settingToggleShuffle.addEventListener('click', handleShuffleSettingChange);
        dom.settingToggleStartWith.addEventListener('click', handleStartWithSettingChange);
        dom.copyDeckButton.addEventListener('click', copyDeckTerms);

        // Global Keybinds
        document.addEventListener('keydown', (e) => {
            // Space: Continue if feedback is visible
            if (e.code === 'Space' || e.key === ' ') {
                if (!dom.feedbackContainer.classList.contains('hidden') && !dom.continueBtn.classList.contains('hidden')) {
                    e.preventDefault();
                    dom.continueBtn.click();
                }
            }

            // Number keys 1-4 for options
            if (!dom.quizView.classList.contains('hidden') && dom.feedbackContainer.classList.contains('hidden')) {
                const options = dom.optionsContainer.querySelectorAll('button');
                if (options.length === 0 || options[0].disabled) return;

                let idx = -1;
                if (e.key === '1') idx = 0;
                else if (e.key === '2') idx = 1;
                else if (e.key === '3') idx = 2;
                else if (e.key === '4') idx = 3;

                if (idx !== -1 && options[idx]) {
                    e.preventDefault();
                    options[idx].click();
                }
            }
        });
    }

    // --- UTILITIES ---

    function showToast(msg) {
        dom.toast.textContent = msg;
        dom.toast.classList.add('show');
        setTimeout(() => {
            dom.toast.classList.remove('show');
        }, 3000);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j - 1][i] + 1,
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    // Run Init
    init();
});