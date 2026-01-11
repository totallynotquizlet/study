document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE ---
    const app = {
        deck: null,         // The full deck object from TNQ.getDeck()
        studyDeck: [],      // The array of cards currently being viewed (possibly shuffled)
        currentCardIndex: 0,
        isAnimating: false,
        
        // Touch state
        touchStartX: 0,
        touchStartY: 0,
        touchEndX: 0,
        touchEndY: 0,

        // Settings tracking
        settingsBeforeEdit: null,
        toastTimeout: null
    };

    // --- DOM ELEMENTS ---
    const dom = {
        headerTitle: document.getElementById('header-title'),
        
        // Flashcard Elements
        flashcardContainer: document.getElementById('flashcard-container'),
        flashcardFront: document.getElementById('flashcard-front').querySelector('p'),
        flashcardBack: document.getElementById('flashcard-back').querySelector('p'),
        prevCardButton: document.getElementById('prev-card-button'),
        nextCardButton: document.getElementById('next-card-button'),
        cardCounter: document.getElementById('card-counter'),
        restartButton: document.getElementById('flashcard-restart-button'),

        // Settings Modal Elements
        settingsButton: document.getElementById('settings-button'),
        settingsModalOverlay: document.getElementById('settings-modal-overlay'),
        settingsModalClose: document.getElementById('settings-modal-close'),
        settingsModalBackdrop: document.querySelector('#settings-modal-overlay .modal-backdrop'),
        settingDeckTitle: document.getElementById('setting-deck-title'),
        settingToggleShuffle: document.getElementById('setting-toggle-shuffle'),
        settingToggleStartWith: document.getElementById('setting-toggle-start-with'),
        copyDeckButton: document.getElementById('copy-deck-button'),
        shareDeckButton: document.getElementById('share-deck-button'),

        toastNotification: document.getElementById('toast-notification'),
    };

    // --- INITIALIZATION ---
    function init() {
        // Load Deck via Shared Storage
        const deck = TNQ.getDeck();
        
        // Safety check: Storage handles redirects, but if we are here, we expect a deck.
        if (!deck || !deck.cards || deck.cards.length === 0) {
            // If empty, redirect to create (fallback safety)
            window.location.href = '../create/';
            return;
        }

        app.deck = deck;
        dom.headerTitle.textContent = deck.title;
        dom.settingDeckTitle.value = deck.title;
        dom.shareDeckButton.classList.remove('hidden');

        generateStudyDeck();
        renderCard();
        addEventListeners();
        
        // Ensure browser tab title matches
        if (deck.title) document.title = `${deck.title} | Totally Not Quizlet`;
    }

    /**
     * Prepares the studyDeck array based on current settings (Shuffle).
     */
    function generateStudyDeck() {
        // Clone the cards
        app.studyDeck = [...app.deck.cards];
        
        if (app.deck.settings.shuffle) {
            shuffleArray(app.studyDeck);
        }
        
        // Reset index safely
        app.currentCardIndex = 0;
    }

    /**
     * Renders the current card to the DOM.
     */
    function renderCard() {
        if (app.studyDeck.length === 0) return;

        const card = app.studyDeck[app.currentCardIndex];
        const termFirst = app.deck.settings.termFirst;

        // Populate faces based on settings
        dom.flashcardFront.textContent = termFirst ? card.term : card.definition;
        dom.flashcardBack.textContent = termFirst ? card.definition : card.term;

        // Update counter
        dom.cardCounter.textContent = `${app.currentCardIndex + 1} / ${app.studyDeck.length}`;
    }

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        // Card Interactions
        dom.flashcardContainer.addEventListener('click', handleCardClick);
        dom.prevCardButton.addEventListener('click', showPrevCard);
        dom.nextCardButton.addEventListener('click', showNextCard);
        dom.restartButton.addEventListener('click', resetStudy);

        // Swipe
        dom.flashcardContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        dom.flashcardContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
        dom.flashcardContainer.addEventListener('touchend', handleTouchEnd);

        // Keyboard
        document.addEventListener('keydown', handleGlobalKeydown);

        // Settings Modal
        dom.settingsButton.addEventListener('click', showSettingsModal);
        dom.settingsModalClose.addEventListener('click', hideSettingsModal);
        dom.settingsModalBackdrop.addEventListener('click', hideSettingsModal);
        
        dom.settingDeckTitle.addEventListener('input', handleTitleChange);
        dom.settingToggleShuffle.addEventListener('click', toggleShuffle);
        dom.settingToggleStartWith.addEventListener('click', toggleStartWith);
        dom.copyDeckButton.addEventListener('click', copyDeckTerms);
        dom.shareDeckButton.addEventListener('click', shareDeck);
    }

    // --- FLASHCARD NAVIGATION ---

    function handleCardClick(e) {
        // 1. Check for TTS button click first
        const ttsButton = e.target.closest('.tts-button');
        if (ttsButton) {
            e.stopPropagation(); // Stop flip
            const cardFace = e.target.closest('.card-face');
            if (cardFace) {
                const text = cardFace.querySelector('p').textContent;
                speakText(text);
            }
            return;
        }

        // 2. Normal Flip
        if (!app.isAnimating) {
            dom.flashcardContainer.classList.toggle('is-flipped');
        }
    }

    function showNextCard() {
        if (app.studyDeck.length === 0 || app.isAnimating) return;
        app.isAnimating = true;

        const animDuration = 100;

        dom.flashcardContainer.classList.add('slide-out-left');

        setTimeout(() => {
            app.currentCardIndex = (app.currentCardIndex + 1) % app.studyDeck.length;
            renderCard();
            
            // Reset flip state without animation for instant snap-back if flipped
            dom.flashcardContainer.classList.remove('is-flipped');
            
            dom.flashcardContainer.classList.remove('slide-out-left');
            dom.flashcardContainer.classList.add('slide-in-right');

            setTimeout(() => {
                dom.flashcardContainer.classList.remove('slide-in-right');
                app.isAnimating = false;
            }, animDuration);
        }, animDuration);
    }

    function showPrevCard() {
        if (app.studyDeck.length === 0 || app.isAnimating) return;
        app.isAnimating = true;

        const animDuration = 100;

        dom.flashcardContainer.classList.add('slide-out-right');

        setTimeout(() => {
            // Standard modulo arithmetic for wrapping backwards
            app.currentCardIndex = (app.currentCardIndex - 1 + app.studyDeck.length) % app.studyDeck.length;
            renderCard();
            
            dom.flashcardContainer.classList.remove('is-flipped');
            
            dom.flashcardContainer.classList.remove('slide-out-right');
            dom.flashcardContainer.classList.add('slide-in-left');

            setTimeout(() => {
                dom.flashcardContainer.classList.remove('slide-in-left');
                app.isAnimating = false;
            }, animDuration);
        }, animDuration);
    }

    function resetStudy() {
        app.currentCardIndex = 0;
        dom.flashcardContainer.classList.remove('is-flipped');
        renderCard();
    }

    function handleGlobalKeydown(e) {
        // Ignore if user is typing in an input (e.g. Settings Modal)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            if (!app.isAnimating) {
                dom.flashcardContainer.classList.toggle('is-flipped');
            }
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            showPrevCard();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            showNextCard();
        }
    }

    // --- SWIPE LOGIC ---
    function handleTouchStart(e) {
        app.touchStartX = e.changedTouches[0].screenX;
        app.touchStartY = e.changedTouches[0].screenY;
        app.touchEndX = 0; 
        app.touchEndY = 0;
    }
    function handleTouchMove(e) {
        app.touchEndX = e.changedTouches[0].screenX;
        app.touchEndY = e.changedTouches[0].screenY;
    }
    function handleTouchEnd(e) {
        if (app.touchEndX === 0) return; // It was a tap

        const dx = app.touchEndX - app.touchStartX;
        const dy = app.touchEndY - app.touchStartY;
        const threshold = 75;

        // Check horizontal dominance
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
            if (dx > 0) showPrevCard();
            else showNextCard();
            e.preventDefault();
        }
        app.touchStartX = 0; app.touchStartY = 0;
    }

    // --- SETTINGS LOGIC ---

    function showSettingsModal() {
        // Sync UI with current state
        dom.settingDeckTitle.value = app.deck.title;
        updateToggleUI(dom.settingToggleShuffle, app.deck.settings.shuffle, "Shuffle");
        updateToggleUI(dom.settingToggleStartWith, app.deck.settings.termFirst, "Term", "Definition");
        
        // Track state to detect changes when closing
        app.settingsBeforeEdit = JSON.parse(JSON.stringify(app.deck.settings));
        
        dom.settingsModalOverlay.classList.add('visible');
    }

    function hideSettingsModal() {
        dom.settingsModalOverlay.classList.remove('visible');
        app.settingsBeforeEdit = null;
    }

    function handleTitleChange(e) {
        app.deck.title = e.target.value;
        dom.headerTitle.textContent = app.deck.title;
        document.title = `${app.deck.title} | Totally Not Quizlet`;
        TNQ.saveDeckToHash(app.deck);
    }

    function toggleShuffle() {
        app.deck.settings.shuffle = !app.deck.settings.shuffle;
        updateToggleUI(dom.settingToggleShuffle, app.deck.settings.shuffle, "Shuffle");
        TNQ.saveDeckToHash(app.deck);
        
        // Apply change immediately
        generateStudyDeck();
        renderCard();
        dom.flashcardContainer.classList.remove('is-flipped');
    }

    function toggleStartWith() {
        app.deck.settings.termFirst = !app.deck.settings.termFirst;
        updateToggleUI(dom.settingToggleStartWith, app.deck.settings.termFirst, "Term", "Definition");
        TNQ.saveDeckToHash(app.deck);
        
        // Apply change immediately
        renderCard();
    }

    function updateToggleUI(button, isActive, activeText, inactiveText = null) {
        if (isActive) {
            button.classList.add('active');
            button.textContent = inactiveText ? activeText : `${activeText}: ON`;
        } else {
            button.classList.remove('active');
            button.textContent = inactiveText ? inactiveText : `${activeText}: OFF`;
        }
    }

    function copyDeckTerms() {
        try {
            const text = app.deck.cards.map(c => 
                `${c.term.replace(/\n/g, ' ')},${c.definition.replace(/\n/g, ' ')}`
            ).join('\n');

            navigator.clipboard.writeText(text).then(() => showToast("Deck terms copied!"));
        } catch (e) {
            showToast("Error copying terms.");
        }
    }

    function shareDeck() {
        // Storage handles the hash generation, we just grab current URL
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => showToast("Link copied to clipboard!"));
    }

    // --- UTILITIES ---

    function showToast(msg) {
        if (app.toastTimeout) clearTimeout(app.toastTimeout);
        dom.toastNotification.textContent = msg;
        dom.toastNotification.classList.add('show');
        app.toastTimeout = setTimeout(() => {
            dom.toastNotification.classList.remove('show');
        }, 3000);
    }

    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        } else {
            showToast("TTS not supported.");
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Run
    init();
});