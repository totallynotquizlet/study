/**
 * Type Mode Logic
 * Replicates the original Type mode behavior using Shared/storage.js
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Constants ---
    const TYPE_CLOSE_THRESHOLD = 2; // Max Levenshtein distance for "close"
    const CORRECT_ANSWER_DELAY = 1000;
    const CLOSE_ANSWER_DELAY = 3000;
    const SESSION_KEY = 'flashcardAppSessionState';

    // --- DOM Elements ---
    const dom = {
        // Main Views
        typeView: document.getElementById('type-view'),
        typeModeDisabled: document.getElementById('type-mode-disabled'),
        typeModeQuiz: document.getElementById('type-mode-quiz'),
        typeCompleteView: document.getElementById('type-complete-view'),

        // Progress
        progressBarContainer: document.getElementById('type-progress-container'),
        progressBar: document.getElementById('type-progress-bar'),

        // Question Area
        questionBox: document.getElementById('type-question-box'),
        questionTerm: document.getElementById('type-question-term'),
        
        // Input Area
        inputForm: document.getElementById('type-input-form'),
        inputArea: document.getElementById('type-input-area'),
        submitButton: document.getElementById('type-submit-button'),

        // Controls
        restartSessionButton: document.getElementById('type-restart-session-button'),
        skipButton: document.getElementById('type-skip-button'),

        // Feedback
        feedbackContainer: document.getElementById('type-feedback-container'),
        feedback: document.getElementById('type-feedback'),
        feedbackMessage: document.getElementById('type-feedback-message'),
        feedbackCorrectAnswer: document.getElementById('type-feedback-correct-answer'),
        overrideWrongButton: document.getElementById('type-override-wrong-button'),
        overrideCorrectButton: document.getElementById('type-override-correct-button'),
        continueButton: document.getElementById('type-continue-button'),

        // Completion
        restartButton: document.getElementById('type-restart-button'),
        switchModeButton: document.getElementById('type-switch-mode-button'),

        // Settings Modal Elements
        settingsButton: document.getElementById('settings-button'),
        settingsModalOverlay: document.getElementById('settings-modal-overlay'),
        settingsModalClose: document.getElementById('settings-modal-close'),
        settingDeckTitle: document.getElementById('setting-deck-title'),
        settingToggleShuffle: document.getElementById('setting-toggle-shuffle'),
        settingToggleStartWith: document.getElementById('setting-toggle-start-with'),
        copyDeckButton: document.getElementById('copy-deck-button'),
        headerTitle: document.getElementById('header-title'),
        
        // Toast
        toastNotification: document.getElementById('toast-notification'),
    };

    // --- State ---
    const state = {
        sessionCards: [], // Cards left in the current round
        currentCard: null,
        lastCard: null, // For undo/override
        correctAnswerTimeout: null,
        isAnimating: false,
        toastTimeout: null
    };

    // --- Initialization ---

    function init() {
        const deck = TNQ.getDeck();

        if (!deck || deck.cards.length === 0) {
            // Should theoretically be handled by storage.js redirect, but just in case
            showDisabledState();
            return;
        }

        // Initialize Settings Modal UI
        dom.headerTitle.textContent = deck.title;
        dom.settingDeckTitle.value = deck.title;
        updateSettingsToggle(dom.settingToggleShuffle, deck.settings.shuffle, "Shuffle");
        updateSettingsToggle(dom.settingToggleStartWith, deck.settings.termFirst, "Term", "Definition");
        dom.settingsButton.classList.remove('hidden');

        // Check for card count
        if (deck.cards.length < 1) {
            showDisabledState();
        } else {
            // Try to load saved session
            if (!loadSession()) {
                startSession();
            } else {
                renderQuestion();
            }
        }

        bindEvents();
    }

    // --- Core Logic ---

    function startSession() {
        const deck = TNQ.getDeck();
        if (!deck || deck.cards.length < 1) return;

        // Reset UI
        dom.typeModeDisabled.classList.add('hidden');
        dom.typeCompleteView.classList.add('hidden');
        dom.typeModeQuiz.classList.remove('hidden');
        dom.progressBarContainer.classList.remove('hidden');
        dom.feedbackContainer.classList.add('hidden');

        // Prepare cards
        state.sessionCards = [...deck.cards];
        state.sessionCards.forEach(c => c.skipCount = 0);

        if (deck.settings.shuffle) {
            shuffleArray(state.sessionCards);
        }

        updateProgressBar();
        renderQuestion();
        saveSession();
    }

    function renderQuestion() {
        // Clear timeouts
        if (state.correctAnswerTimeout) {
            clearTimeout(state.correctAnswerTimeout);
            state.correctAnswerTimeout = null;
        }

        updateProgressBar();

        // Check for completion
        if (state.sessionCards.length === 0) {
            showCompleteState();
            saveSession(); // Save empty state
            return;
        }

        // Setup UI for Question
        dom.typeModeQuiz.classList.remove('hidden');
        dom.typeCompleteView.classList.add('hidden');
        dom.continueButton.classList.add('hidden'); // Hide until answer
        
        // Get Card
        const deck = TNQ.getDeck();
        state.currentCard = state.sessionCards[0];

        // Determine Text (Term First?)
        const questionText = deck.settings.termFirst 
            ? state.currentCard.term 
            : state.currentCard.definition;
        
        dom.questionTerm.textContent = questionText;

        // Reset Inputs
        dom.inputArea.value = '';
        dom.inputArea.disabled = false;
        dom.submitButton.disabled = false;
        dom.inputArea.focus();

        // Reset Feedback
        dom.feedbackContainer.classList.add('hidden');
        dom.feedback.classList.remove('correct', 'incorrect', 'close');
        dom.feedbackMessage.textContent = '';
        dom.feedbackCorrectAnswer.textContent = '';
        dom.overrideWrongButton.classList.add('hidden');
        dom.overrideCorrectButton.classList.add('hidden');

        // Show Skip
        dom.skipButton.classList.remove('hidden');
    }

    function handleAnswer(e) {
        if (e) e.preventDefault();
        if (dom.inputArea.disabled) return;

        const deck = TNQ.getDeck();
        const userAnswer = dom.inputArea.value.trim();
        if (!userAnswer) return;

        // Clear existing timer
        if (state.correctAnswerTimeout) {
            clearTimeout(state.correctAnswerTimeout);
            state.correctAnswerTimeout = null;
        }

        const correctAnswer = deck.settings.termFirst
            ? state.currentCard.definition
            : state.currentCard.term;

        const distance = levenshteinDistance(userAnswer.toLowerCase(), correctAnswer.toLowerCase());

        // Lock UI
        dom.inputArea.disabled = true;
        dom.submitButton.disabled = true;
        dom.skipButton.classList.add('hidden'); // Hide skip
        dom.feedbackContainer.classList.remove('hidden');
        dom.feedback.classList.remove('correct', 'incorrect', 'close');
        dom.overrideWrongButton.classList.add('hidden');
        dom.overrideCorrectButton.classList.add('hidden');

        if (distance === 0) {
            // --- Perfect ---
            dom.feedback.classList.add('correct');
            dom.feedbackMessage.textContent = "Correct!";
            
            TNQ.updateCardResult(state.currentCard, true);
            state.sessionCards.shift(); // Remove from queue

            state.correctAnswerTimeout = setTimeout(renderQuestion, CORRECT_ANSWER_DELAY);
        } else if (distance <= TYPE_CLOSE_THRESHOLD) {
            // --- Close ---
            dom.feedback.classList.add('close');
            dom.feedbackMessage.textContent = "Close!";
            dom.feedbackCorrectAnswer.textContent = `Correct answer: ${correctAnswer}`;
            dom.overrideWrongButton.classList.remove('hidden');

            TNQ.updateCardResult(state.currentCard, true); // Count as correct
            state.lastCard = state.sessionCards.shift(); // Remove & cache

            state.correctAnswerTimeout = setTimeout(renderQuestion, CLOSE_ANSWER_DELAY);
        } else {
            // --- Incorrect ---
            dom.feedback.classList.add('incorrect');
            dom.feedbackMessage.textContent = "Incorrect.";
            dom.feedbackCorrectAnswer.textContent = `Correct answer: ${correctAnswer}`;
            dom.overrideCorrectButton.classList.remove('hidden');

            TNQ.updateCardResult(state.currentCard, false);
            
            // Move to end
            state.lastCard = state.sessionCards.shift();
            state.sessionCards.push(state.lastCard);
            
            // No auto-advance
            dom.continueButton.classList.remove('hidden');
        }

        TNQ.saveProgress();
        saveSession();
    }

    function handleSkip() {
        if (!state.currentCard) return;

        const card = state.currentCard;
        card.skipCount = (card.skipCount || 0) + 1;

        // Remove from front
        state.sessionCards.shift();

        if (card.skipCount >= 2) {
            showToast("Skipped twice. Removing from this round.");
        } else {
            state.sessionCards.push(card);
            showToast("Skipped. Moved to end.");
        }

        saveSession();
        renderQuestion();
    }

    // --- Overrides ---

    function handleOverrideWrong() {
        if (!state.lastCard) return;

        // Add back to end
        state.sessionCards.push(state.lastCard);
        
        // Update score
        TNQ.updateCardResult(state.lastCard, false);
        TNQ.saveProgress();
        
        state.lastCard = null;
        dom.overrideWrongButton.classList.add('hidden');
        
        saveSession();
        showToast("Got it. We'll ask that one again.");
    }

    function handleOverrideCorrect() {
        if (!state.lastCard) return;

        // Update score
        TNQ.updateCardResult(state.lastCard, true);
        TNQ.saveProgress();

        // Remove from list (it was pushed to end in handleAnswer)
        const idx = state.sessionCards.indexOf(state.lastCard);
        if (idx > -1) {
            state.sessionCards.splice(idx, 1);
        }

        state.lastCard = null;
        dom.overrideCorrectButton.classList.add('hidden');

        saveSession();
        showToast("Great! Marking that as correct.");
        
        // If that was the last card, we might be done now
        if (state.sessionCards.length === 0) {
            showCompleteState();
        }
    }

    // --- UI Helpers ---

    function showDisabledState() {
        dom.typeModeDisabled.classList.remove('hidden');
        dom.typeModeQuiz.classList.add('hidden');
        dom.typeCompleteView.classList.add('hidden');
        dom.progressBarContainer.classList.add('hidden');
    }

    function showCompleteState() {
        dom.typeModeQuiz.classList.add('hidden');
        dom.typeCompleteView.classList.remove('hidden');
        dom.progressBarContainer.classList.add('hidden');
    }

    function updateProgressBar() {
        const deck = TNQ.getDeck();
        if (!deck || deck.cards.length === 0) return;
        
        const total = deck.cards.length;
        const remaining = state.sessionCards.length;
        const completed = total - remaining;
        const percentage = (completed / total) * 100;
        
        dom.progressBar.style.width = `${percentage}%`;
    }

    function showToast(message) {
        if (state.toastTimeout) clearTimeout(state.toastTimeout);
        dom.toastNotification.textContent = message;
        dom.toastNotification.classList.add('show');
        state.toastTimeout = setTimeout(() => {
            dom.toastNotification.classList.remove('show');
        }, 3000);
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

    // --- Modal Logic ---

    function showSettingsModal() {
        dom.settingsModalOverlay.classList.add('visible');
    }

    function hideSettingsModal() {
        dom.settingsModalOverlay.classList.remove('visible');
    }

    // --- Session Persistence ---

    function saveSession() {
        const deck = TNQ.getDeck();
        if (!deck) return;
        
        const sessionState = {
            deckHash: window.location.hash, // Use current hash as ID
            cardIds: state.sessionCards.map(c => c.id)
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionState));
    }

    function loadSession() {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) return false;

        try {
            const sessionState = JSON.parse(stored);
            // Verify it matches current deck
            if (sessionState.deckHash !== window.location.hash) return false;

            const deck = TNQ.getDeck();
            
            // Reconstruct card objects from IDs
            const cards = sessionState.cardIds.map(id => 
                deck.cards.find(c => c.id === id)
            ).filter(Boolean); // Remove nulls if deck changed

            if (cards.length === 0 && deck.cards.length > 0) return false; // Invalid state

            state.sessionCards = cards;
            return true;

        } catch (e) {
            console.error("Error loading session", e);
            return false;
        }
    }

    // --- Settings & Utils ---

    function handleSettingsChange(type) {
        const deck = TNQ.getDeck();
        
        if (type === 'shuffle') {
            deck.settings.shuffle = !deck.settings.shuffle;
            updateSettingsToggle(dom.settingToggleShuffle, deck.settings.shuffle, "Shuffle");
        } else if (type === 'startWith') {
            deck.settings.termFirst = !deck.settings.termFirst;
            updateSettingsToggle(dom.settingToggleStartWith, deck.settings.termFirst, "Term", "Definition");
        }

        TNQ.saveDeckToHash(deck);
        
        // Reset session on setting change
        startSession(); 
    }

    function copyDeckTerms() {
        const deck = TNQ.getDeck();
        if (!deck || deck.cards.length === 0) {
            showToast("Cannot copy an empty deck!");
            return;
        }
        
        const text = deck.cards.map(c => 
            `${c.term.replace(/\n/g, ' ')},${c.definition.replace(/\n/g, ' ')}`
        ).join('\n');

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showToast("Deck copied to clipboard!"));
        } else {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast("Deck copied to clipboard!");
        }
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

        for (let i = 0; i <= a.length; i++) {
            matrix[0][i] = i;
        }
        for (let j = 0; j <= b.length; j++) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j - 1][i] + 1,     // Deletion
                    matrix[j][i - 1] + 1,     // Insertion
                    matrix[j - 1][i - 1] + cost // Substitution
                );
            }
        }

        return matrix[b.length][a.length];
    }

    // --- Event Binding ---

    function bindEvents() {
        // Form
        if (dom.inputForm) dom.inputForm.addEventListener('submit', handleAnswer);
        if (dom.submitButton) dom.submitButton.addEventListener('click', handleAnswer);
        
        // Controls
        if (dom.skipButton) dom.skipButton.addEventListener('click', handleSkip);
        if (dom.restartSessionButton) dom.restartSessionButton.addEventListener('click', startSession);
        
        // Feedback
        if (dom.overrideWrongButton) dom.overrideWrongButton.addEventListener('click', handleOverrideWrong);
        if (dom.overrideCorrectButton) dom.overrideCorrectButton.addEventListener('click', handleOverrideCorrect);
        
        if (dom.continueButton) {
            dom.continueButton.addEventListener('click', () => {
                if (state.correctAnswerTimeout) clearTimeout(state.correctAnswerTimeout);
                renderQuestion();
            });
        }

        // Completion
        if (dom.restartButton) dom.restartButton.addEventListener('click', startSession);
        if (dom.switchModeButton) dom.switchModeButton.addEventListener('click', () => TNQ.navigateTo('flashcards'));

        // Settings - Modal
        if (dom.settingsButton) dom.settingsButton.addEventListener('click', showSettingsModal);
        if (dom.settingsModalClose) dom.settingsModalClose.addEventListener('click', hideSettingsModal);
        // Backdrop click
        if (dom.settingsModalOverlay) {
            dom.settingsModalOverlay.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-backdrop')) {
                    hideSettingsModal();
                }
            });
        }

        // Settings - Functionality
        if (dom.settingToggleShuffle) dom.settingToggleShuffle.addEventListener('click', () => handleSettingsChange('shuffle'));
        if (dom.settingToggleStartWith) dom.settingToggleStartWith.addEventListener('click', () => handleSettingsChange('startWith'));
        if (dom.copyDeckButton) dom.copyDeckButton.addEventListener('click', copyDeckTerms);
        if (dom.settingDeckTitle) {
            dom.settingDeckTitle.addEventListener('input', (e) => {
                const deck = TNQ.getDeck();
                deck.title = e.target.value;
                dom.headerTitle.textContent = deck.title;
                TNQ.saveDeckToHash(deck);
            });
        }

        // Global Keys
        document.addEventListener('keydown', (e) => {
            // Don't interfere with typing in input
            if (e.target === dom.inputArea) {
                // Let form handle enter
                return;
            }

            // Space to advance
            if ((e.code === 'Space' || e.key === ' ') && !dom.continueButton.classList.contains('hidden')) {
                e.preventDefault();
                if (state.correctAnswerTimeout) clearTimeout(state.correctAnswerTimeout);
                renderQuestion();
            }
        });
    }

    // Start
    init();
});