/**
 * /shared/storage.js
 * Handles:
 * 1. Parsing and validation of URL hash data (Study Set).
 * 2. Persistence of progress (SRS scores) to localStorage.
 * 3. Navigation helper to preserve state between modes.
 * 4. Redirects users from study modes if no data exists.
 */

(function(window) {
    'use strict';

    // --- CONSTANTS ---
    const LOCAL_STORAGE_PROGRESS_KEY = 'flashcardAppProgress';
    const SRS_INTERVALS = {
        1: 5 * 60 * 1000,         // 5 minutes
        2: 30 * 60 * 1000,        // 30 minutes
        3: 24 * 60 * 60 * 1000,   // 1 day
        4: 3 * 24 * 60 * 60 * 1000, // 3 days
        5: 7 * 24 * 60 * 60 * 1000  // 7 days
    };
    const INCORRECT_INTERVAL = 60 * 1000; // 1 minute

    // --- STATE ---
    const state = {
        currentDeck: null,
        progressData: new Map(),
    };

    // --- UTILITIES ---

    /**
     * Encodes a string into a URL-safe Base64 format.
     */
    function base64UrlEncode(str) {
        const utf8Bytes = new TextEncoder().encode(str);
        const binaryString = String.fromCharCode.apply(null, utf8Bytes);
        const base64String = btoa(binaryString);
        return base64String
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Decodes a URL-safe Base64 string.
     */
    function base64UrlDecode(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        const padding = str.length % 4;
        if (padding) {
            str += '===='.slice(padding);
        }
        const binaryString = atob(str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }

    /**
     * Helper: Returns a default empty deck structure.
     */
    function getDefaultDeck() {
        return {
            title: 'Untitled Deck',
            cards: [],
            settings: {
                shuffle: false,
                termFirst: true
            }
        };
    }

    /**
     * Loads progress from localStorage into the state map.
     */
    function loadProgress() {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
            if (stored) {
                // Support both Map-as-JSON-array and legacy Object formats
                if (stored.startsWith('[[')) {
                    state.progressData = new Map(JSON.parse(stored));
                } else {
                    state.progressData = new Map(Object.entries(JSON.parse(stored)));
                }
            }
        } catch (e) {
            console.warn("TNQ: Error loading progress.", e);
            state.progressData = new Map();
        }
    }

    /**
     * Merges localStorage progress (scores, due dates) into the deck's cards.
     */
    function mergeProgressIntoDeck(deck) {
        if (!deck || !deck.cards) return;

        deck.cards = deck.cards.map((card, index) => {
            const key = `${card.term}|${card.definition}`;
            const stored = state.progressData.get(key);
            
            const defaultState = {
                id: `${Date.now()}-${index}`, // Generate transient ID
                term: card.term,
                definition: card.definition,
                score: 0,
                lastReviewed: 0,
                nextReview: 0
            };

            return { ...defaultState, ...(stored || {}) };
        });
    }

    // --- CORE API ---

    /**
     * Main initialization. Reads hash, loads deck, redirects if needed.
     */
    function init() {
        loadProgress();

        const hash = window.location.hash.substring(1);
        const isCreateMode = window.location.pathname.includes('/create') || window.location.pathname.endsWith('/index.html') || window.location.pathname === '/';
        
        // We detect "Create Mode" broadly. If the user is on a specific study page
        // (flashcards, learn, type, match) and there is NO hash, we must redirect.
        const isStudyPage = window.location.pathname.match(/\/(flashcards|learn|type|match)\//);

        if (!hash) {
            if (isStudyPage) {
                // No data found on a study page -> Redirect to Create
                console.warn("TNQ: No deck data found. Redirecting to Create.");
                // Assuming /create/ exists, or we bounce to root
                // For GitHub pages structure, let's assume root is safe or ../create/
                window.location.href = '../create/'; 
                return;
            }
            // If on create/root, just load default
            state.currentDeck = getDefaultDeck();
            return;
        }

        try {
            const jsonString = base64UrlDecode(hash);
            const parsed = JSON.parse(jsonString);

            // Validate structure
            let deck = parsed;
            if (Array.isArray(parsed)) {
                // Legacy format support
                deck = { 
                    title: 'Untitled Deck', 
                    cards: parsed, 
                    settings: { shuffle: false, termFirst: true } 
                };
            }
            
            // Ensure settings exist
            deck.settings = { 
                shuffle: false, 
                termFirst: true, 
                ...(deck.settings || {}) 
            };
            
            if (!deck.cards) deck.cards = [];

            // Merge progress data
            mergeProgressIntoDeck(deck);
            
            state.currentDeck = deck;

        } catch (e) {
            console.error("TNQ: Corrupt deck data.", e);
            alert("Error loading deck. The link may be corrupted.");
            // Strip the bad hash to prevent loop
            history.replaceState(null, '', window.location.pathname);
            state.currentDeck = getDefaultDeck();
        }
    }

    // --- PUBLIC METHODS ---

    const TNQ = {
        /**
         * Returns the current validated deck object.
         */
        getDeck: () => state.currentDeck,

        /**
         * Saves the deck state (cards, settings) to the URL hash.
         * Note: This does NOT save progress scores (those are localStorage).
         * @param {object} deck - The deck object to serialize.
         */
        saveDeckToHash: (deck) => {
            if (!deck) return;
            try {
                // Strip runtime properties (id, score, nextReview) before serializing
                const cleanCards = deck.cards.map(c => ({
                    term: c.term,
                    definition: c.definition
                }));
                
                const payload = {
                    title: deck.title,
                    cards: cleanCards,
                    settings: deck.settings
                };

                const json = JSON.stringify(payload);
                const hash = base64UrlEncode(json);
                
                // Update internal state
                state.currentDeck = deck; 
                
                // Update URL silently
                history.replaceState(null, '', `#${hash}`);
                
                return hash;
            } catch (e) {
                console.error("TNQ: Error saving to hash", e);
            }
        },

        /**
         * Saves the current progress (SRS scores) to localStorage.
         * Should be called after a study session or card update.
         */
        saveProgress: () => {
            if (!state.currentDeck) return;
            
            // Update map from current deck state
            state.currentDeck.cards.forEach(card => {
                const key = `${card.term}|${card.definition}`;
                state.progressData.set(key, {
                    score: card.score,
                    lastReviewed: card.lastReviewed,
                    nextReview: card.nextReview
                });
            });

            // Convert Map to object for storage
            const obj = Object.fromEntries(state.progressData);
            localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(obj));
        },

        /**
         * Helper to calculate SRS updates for a card.
         * Updates the card object in place AND triggers a save.
         * @param {object} card - The card object.
         * @param {boolean} isCorrect - User answer result.
         */
        updateCardResult: (card, isCorrect) => {
            const now = Date.now();
            card.lastReviewed = now;

            if (isCorrect) {
                card.score = Math.min((card.score || 0) + 1, 5);
                card.nextReview = now + (SRS_INTERVALS[card.score] || SRS_INTERVALS[5]);
            } else {
                card.score = 0;
                card.nextReview = now + INCORRECT_INTERVAL;
            }
            
            // Persist immediately
            TNQ.saveProgress();
        },

        /**
         * Navigates to a different study mode while preserving the hash.
         * @param {string} mode - 'create', 'flashcards', 'learn', 'type', 'match'
         */
        navigateTo: (mode) => {
            const hash = window.location.hash;
            
            // Handle root/create paths
            let targetPath;
            if (mode === 'create') {
                targetPath = '../create/'; // Assuming sibling folders
            } else {
                targetPath = `../${mode}/`;
            }

            // If we are currently at root, paths might need adjustment.
            // A robust way for GitHub Pages (subfolder deployment) is checking relative depth.
            // For now, assuming standard ../[mode]/ structure works if we are inside a mode folder.
            
            // If we are at root, we don't need '../'
            if (!window.location.pathname.includes('/')) {
                 // rare case for exact root
                 targetPath = `${mode}/`;
            }

            window.location.href = `${targetPath}${hash}`;
        }
    };

    // Initialize immediately on load
    init();

    // Expose to window
    window.TNQ = TNQ;

})(window);