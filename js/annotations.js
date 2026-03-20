/**
 * annotations.js — Narrative insight bar with highlight-driven cross-panel linking.
 */
const AnnotationBar = (() => {
    let annotations = [];
    let autoTimer = null;

    function init() {
        State.on('change', onStateChange);

        d3.select('#annotation-prev').on('click', () => navigate(-1));
        d3.select('#annotation-next').on('click', () => navigate(1));

        // Pause auto-advance on hover
        d3.select('#annotation-bar')
            .on('mouseenter', () => clearAutoAdvance())
            .on('mouseleave', () => startAutoAdvance());
    }

    function onStateChange(state) {
        if (state.data && state.data.annotations) {
            annotations = state.data.annotations;
            renderCurrent(state);

            if (!autoTimer) startAutoAdvance();
        }
    }

    function renderCurrent(state) {
        if (annotations.length === 0) return;

        const idx = state.currentInsight % annotations.length;
        const annotation = annotations[idx];

        d3.select('#annotation-text')
            .transition().duration(300)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(annotation.text)
                    .transition().duration(300)
                    .style('opacity', 1);
            });
    }

    function navigate(direction) {
        if (annotations.length === 0) return;
        const state = State.get();
        const newIdx = ((state.currentInsight + direction) % annotations.length + annotations.length) % annotations.length;
        const annotation = annotations[newIdx];

        // Batch all state updates into one emit
        State.batch({
            currentInsight: newIdx,
            highlightedAnnotation: annotation ? annotation.highlights : null,
            lockedFranchise: null,
            selectedMovie: null
        });

        resetAutoAdvance();
    }

    function startAutoAdvance() {
        clearAutoAdvance();
        autoTimer = setInterval(() => navigate(1), 10000);
    }

    function clearAutoAdvance() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    function resetAutoAdvance() {
        clearAutoAdvance();
        startAutoAdvance();
    }

    // Clear annotation highlights when user interacts with other controls
    State.on('*', (state, event) => {
        if ((state.brushRange !== null || state.lockedFranchise !== null) && state.highlightedAnnotation !== null) {
            // Guard: only call set if not already null (prevents infinite re-emit)
            State.set('highlightedAnnotation', null);
        }
    });

    return { init };
})();
