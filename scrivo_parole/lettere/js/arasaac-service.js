/**
 * Servizio integrazione ARASAAC API
 * API Docs: https://api.arasaac.org/developers.html
 */

class ArasaacService {
    constructor() {
        this.baseUrl = 'https://api.arasaac.org/api';
        this.staticUrl = 'https://static.arasaac.org/pictograms';
        this.locale = 'it'; // Default italiano
        this.searchCache = new Map(); // Cache ricerche
        this.debounceTimer = null;
    }

    /**
     * Cerca pittogrammi per keyword
     * @param {string} query - Parola chiave da cercare
     * @param {number} limit - Numero massimo risultati (default 24)
     * @returns {Promise<Array>} Array di pittogrammi
     */
    async searchPictograms(query, limit = 24) {
        query = query.trim();

        if (!query) {
            return [];
        }

        // Controlla cache
        const cacheKey = `${this.locale}:${query}:${limit}`;
        if (this.searchCache.has(cacheKey)) {
            return this.searchCache.get(cacheKey);
        }

        try {
            const encodedQuery = encodeURIComponent(query);
            const url = `${this.baseUrl}/pictograms/${this.locale}/search/${encodedQuery}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                return [];
            }

            // Formatta risultati
            const pictograms = data.slice(0, limit).map(item => {
                const id = typeof item._id === 'number' ? item._id : parseInt(item._id);

                if (!id || isNaN(id)) {
                    return null;
                }

                return {
                    id: id,
                    keywords: item.keywords || [],
                    thumbnail: this.getPictogramUrl(id, 300),
                    url: this.getPictogramUrl(id, 500)
                };
            }).filter(item => item !== null);

            // Salva in cache (max 100 ricerche)
            if (this.searchCache.size > 100) {
                const firstKey = this.searchCache.keys().next().value;
                this.searchCache.delete(firstKey);
            }
            this.searchCache.set(cacheKey, pictograms);

            return pictograms;

        } catch (error) {
            console.error('Errore ricerca ARASAAC:', error);
            return [];
        }
    }

    /**
     * Ricerca con debounce (per input in tempo reale)
     * @param {string} query - Query di ricerca
     * @param {Function} callback - Funzione chiamata con risultati
     * @param {number} delay - Ritardo in ms (default 350)
     */
    searchWithDebounce(query, callback, delay = 350) {
        clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(async () => {
            const results = await this.searchPictograms(query);
            callback(results);
        }, delay);
    }

    /**
     * Ottieni URL pittogramma
     * @param {number} id - ID pittogramma
     * @param {number} size - Dimensione (300, 500, 2500)
     * @returns {string} URL immagine PNG
     */
    getPictogramUrl(id, size = 500) {
        // Dimensioni valide: 300, 500, 2500
        const validSizes = [300, 500, 2500];
        if (!validSizes.includes(size)) {
            size = 500;
        }

        return `${this.staticUrl}/${id}/${id}_${size}.png`;
    }

    /**
     * Ottieni dettagli pittogramma
     * @param {number} id - ID pittogramma
     * @returns {Promise<Object>} Dettagli pittogramma
     */
    async getPictogramDetails(id) {
        try {
            const url = `${this.baseUrl}/pictograms/${this.locale}/${id}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();

            return {
                id: data._id,
                keywords: data.keywords || [],
                tags: data.tags || [],
                categories: data.categories || [],
                created: data.created,
                lastUpdated: data.lastUpdated
            };

        } catch (error) {
            console.error('Errore dettagli pittogramma:', error);
            return null;
        }
    }

    /**
     * Cambia locale
     * @param {string} locale - Codice lingua (it, en, es, fr, etc.)
     */
    setLocale(locale) {
        this.locale = locale;
        this.searchCache.clear(); // Pulisce cache al cambio lingua
    }

    /**
     * Pulisce cache ricerche
     */
    clearCache() {
        this.searchCache.clear();
    }
}

// Istanza globale
const arasaacService = new ArasaacService();










