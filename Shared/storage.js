/* storage.js
   Handles all data persistence, hash parsing, and validation.
   Acts as the "Gatekeeper" for state — if the hash is invalid, it redirects.
*/

const StorageUtils = (function() {
    
    // --- Constants ---
    const SAFE_REDIRECT_PATH = './index.html'; // Where to go if data is missing
    const DEFAULT_SETTINGS = {
        shuffle: false,
        termFirst: true
    };

    /**
     * URL-Safe Base64 Encoder
     * Converts a JSON object into a safe string for the URL hash.
     */
    function encode(data) {
        try {
            const jsonString = JSON.stringify(data);
            const utf8Bytes = new TextEncoder().encode(jsonString);
            const binaryString = String.fromCharCode.apply(null, utf8Bytes);
            return btoa(binaryString)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        } catch (e) {
            console.error("Storage: Encoding failed", e);
            return null;
        }
    }

    /**
     * URL-Safe Base64 Decoder
     * Converts the hash string back into a JSON object.
     */
    function decode(str) {
        try {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            const padding = str.length % 4;
            if (padding) str += '===='.slice(padding);
            
            const binaryString = atob(str);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            console.error("Storage: Decoding failed", e);
            return null;
        }
    }

    /**
     * Validates and Normalizes a Deck Object.
     * Ensures the deck has a title, an array of cards, and valid settings.
     */
    function validate(rawDeck) {
        if (!rawDeck || typeof rawDeck !== 'object') return null;

        // Support legacy array-only format
        if (Array.isArray(rawDeck)) {
            return {
                title: 'Untitled Deck',
                cards: rawDeck,
                settings: { ...DEFAULT_SETTINGS }
            };
        }

        // Validate cards array
        if (!Array.isArray(rawDeck.cards)) return null;

        // Ensure settings exist
        const settings = { ...DEFAULT_SETTINGS, ...(rawDeck.settings || {}) };

        return {
            title: rawDeck.title || 'Untitled Deck',
            cards: rawDeck.cards,
            settings: settings
        };
    }

    // --- Public API ---

    return {
        /**
         * Reads the current deck from window.location.hash.
         * Returns null if no hash or invalid data.
         */
        getDeck: function() {
            const hash = window.location.hash.substring(1);
            if (!hash) return null;

            const decoded = decode(hash);
            return validate(decoded);
        },

        /**
         * Enforces that a valid deck exists.
         * Usage: const deck = StorageUtils.requireDeck();
         * If invalid, it immediately redirects to the safe path.
         */
        requireDeck: function() {
            const deck = this.getDeck();
            
            if (!deck) {
                console.warn("Storage: No valid deck found. Redirecting...");
                // Prevent infinite redirect loops if we are already on the safe page
                if (!window.location.pathname.endsWith('index.html') && 
                    !window.location.pathname.endsWith('/')) {
                    window.location.replace(SAFE_REDIRECT_PATH);
                }
                return null; // Caller should stop execution
            }
            
            return deck;
        },

        /**
         * Updates the URL hash with the provided deck data.
         * Uses replaceState to avoid cluttering browser history.
         */
        saveDeck: function(deck) {
            const encoded = encode(deck);
            if (encoded) {
                const newHash = `#${encoded}`;
                history.replaceState(null, '', newHash);
                return true;
            }
            return false;
        },

        /**
         * Helper to get a clean, empty deck structure.
         */
        createEmptyDeck: function() {
            return {
                title: '',
                cards: [],
                settings: { ...DEFAULT_SETTINGS }
            };
        }
    };
})();