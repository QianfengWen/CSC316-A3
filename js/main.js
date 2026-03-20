/**
 * main.js — App initialization, data loading, filter UI wiring.
 */
(async function () {
    // Load data
    const data = await d3.json('data/franchises.json');
    State.set('data', data);
    State.applyFilters();
    State.emit('change');

    // === Populate genre filter ===
    const allGenres = new Set();
    data.franchises.forEach(f =>
        f.movies.forEach(m => m.genres.forEach(g => allGenres.add(g)))
    );
    const genreSelect = d3.select('#filter-genre');
    [...allGenres].sort().forEach(g => {
        genreSelect.append('option').attr('value', g).text(g);
    });

    // === Wire filter controls ===
    d3.select('#filter-genre').on('change', function () {
        const selected = Array.from(this.selectedOptions, o => o.value);
        State.setFilter('genres', selected);
    });

    d3.select('#filter-min-entries').on('change', function () {
        State.setFilter('minEntries', +this.value);
    });

    d3.select('#filter-metric').on('change', function () {
        State.setFilter('metric', this.value);
    });

    // Year range sliders
    const yearMin = d3.select('#filter-year-min');
    const yearMax = d3.select('#filter-year-max');
    const yearLabel = d3.select('#year-range-label');

    function updateYearRange() {
        let minVal = +yearMin.property('value');
        let maxVal = +yearMax.property('value');
        if (minVal > maxVal) {
            [minVal, maxVal] = [maxVal, minVal];
        }
        yearLabel.text(`${minVal} – ${maxVal}`);
        State.setFilter('yearRange', [minVal, maxVal]);
    }

    yearMin.on('input', updateYearRange);
    yearMax.on('input', updateYearRange);

    // === Tooltip helper (shared) ===
    const tooltip = d3.select('#tooltip');

    window.showTooltip = function (event, html) {
        tooltip
            .html(html)
            .classed('visible', true)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    };

    window.hideTooltip = function () {
        tooltip.classed('visible', false);
    };

    // === Format helpers (shared) ===
    window.fmt = {
        money: d3.format('$,.0f'),
        moneyShort: (v) => {
            if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
            if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
            return `$${d3.format(',')(v)}`;
        },
        rating: d3.format('.1f'),
        number: d3.format(','),
    };

    // === Initialize panels ===
    RiverChart.init('#river-container');
    TrajectoryChart.init('#trajectory-container');
    DominanceChart.init('#dominance-container');
    ProfileCard.init('#profile-container');
    AnnotationBar.init();

    // === Clear selections on background click ===
    d3.select('.panels').on('click', function (event) {
        if (event.target === this) {
            State.clearSelections();
        }
    });
})();
