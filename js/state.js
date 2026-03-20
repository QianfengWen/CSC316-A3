/**
 * state.js — Central state manager and event bus.
 * All panels subscribe to state changes and re-render when relevant state updates.
 */
const State = (() => {
    const state = {
        data: null,               // Full dataset (franchises + annotations)
        filteredData: null,       // Franchises after applying filters
        brushRange: null,         // [yearStart, yearEnd] or null
        selectedFranchise: null,  // franchise id or null
        selectedMovie: null,      // movie object or null
        lockedFranchise: null,    // franchise id locked via click (not just hover)
        activeFilters: {
            genres: [],           // selected genre strings
            yearRange: [1970, 2025],
            minEntries: 3,
            metric: 'vote_average'
        },
        currentInsight: 0,        // index into annotations array
        highlightedAnnotation: null // current annotation highlight config or null
    };

    const listeners = {};
    let debounceTimer = null;

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function emit(event) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            (listeners[event] || []).forEach(cb => cb(state));
            (listeners['*'] || []).forEach(cb => cb(state, event));
        }, 50);
    }

    function set(key, value) {
        state[key] = value;
        emit('change');
    }

    function get(key) {
        return key ? state[key] : state;
    }

    function setFilter(filterKey, value) {
        state.activeFilters[filterKey] = value;
        applyFilters();
        emit('change');
    }

    function applyFilters() {
        if (!state.data) return;
        const { genres, yearRange, minEntries } = state.activeFilters;

        state.filteredData = state.data.franchises
            .map(franchise => {
                let movies = franchise.movies.filter(m => {
                    const inYear = m.year >= yearRange[0] && m.year <= yearRange[1];
                    const inGenre = genres.length === 0 ||
                        m.genres.some(g => genres.includes(g));
                    return inYear && inGenre;
                });
                return { ...franchise, movies };
            })
            .filter(franchise => franchise.movies.length >= minEntries);
    }

    function batch(updates) {
        Object.assign(state, updates);
        emit('change');
    }

    function clearSelections() {
        batch({
            selectedFranchise: null,
            selectedMovie: null,
            lockedFranchise: null,
            brushRange: null,
            highlightedAnnotation: null
        });
    }

    return { on, emit, set, get, setFilter, applyFilters, clearSelections, batch };
})();
