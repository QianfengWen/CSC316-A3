/**
 * main.js — App initialization, data loading, filter UI wiring.
 */
(async function () {
    // Load data
    const data = await d3.json('data/franchises.json');
    State.set('data', data);
    State.applyFilters();
    State.emit('change');

    // === Populate genre pill toggles ===
    const allGenres = new Set();
    data.franchises.forEach(f =>
        f.movies.forEach(m => m.genres.forEach(g => allGenres.add(g)))
    );
    const pillContainer = d3.select('#filter-genre-pills');
    const activeGenres = new Set();
    [...allGenres].sort().forEach(g => {
        pillContainer.append('button')
            .attr('class', 'genre-pill')
            .attr('data-genre', g)
            .text(g)
            .on('click', function () {
                if (activeGenres.has(g)) {
                    activeGenres.delete(g);
                    d3.select(this).classed('active', false);
                } else {
                    activeGenres.add(g);
                    d3.select(this).classed('active', true);
                }
                State.setFilter('genres', [...activeGenres]);
            });
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
    const yearMinLabel = d3.select('#year-min-value');
    const yearMaxLabel = d3.select('#year-max-value');
    const rangeFill = d3.select('#range-fill');

    function updateRangeFill(minVal, maxVal) {
        const rangeMin = 1970, rangeMax = 2025;
        const leftPct = ((minVal - rangeMin) / (rangeMax - rangeMin)) * 100;
        const rightPct = ((maxVal - rangeMin) / (rangeMax - rangeMin)) * 100;
        rangeFill.style('left', leftPct + '%').style('width', (rightPct - leftPct) + '%');
    }

    function updateYearRange() {
        let minVal = +yearMin.property('value');
        let maxVal = +yearMax.property('value');
        if (minVal > maxVal) {
            [minVal, maxVal] = [maxVal, minVal];
        }
        yearMinLabel.text(minVal);
        yearMaxLabel.text(maxVal);
        updateRangeFill(minVal, maxVal);
        State.setFilter('yearRange', [minVal, maxVal]);
    }

    yearMin.on('input', updateYearRange);
    yearMax.on('input', updateYearRange);
    updateRangeFill(1970, 2025);

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

    // === Build franchise legend ===
    const legendContainer = d3.select('#franchise-legend');

    function buildLegend(state) {
        const franchises = state.filteredData || [];
        legendContainer.html('');
        franchises.forEach(f => {
            const item = legendContainer.append('div')
                .attr('class', 'legend-item')
                .on('click', () => {
                    const current = State.get('lockedFranchise');
                    if (current === f.id) {
                        State.batch({ lockedFranchise: null, selectedFranchise: null });
                    } else {
                        State.batch({ lockedFranchise: f.id, selectedFranchise: f.id });
                    }
                });

            item.append('span')
                .attr('class', 'legend-dot')
                .style('background', f.color);

            item.append('span')
                .attr('class', 'legend-name')
                .text(f.name);
        });
        updateLegendDimming(state);
    }

    function updateLegendDimming(state) {
        const active = state.lockedFranchise || state.selectedFranchise;
        legendContainer.selectAll('.legend-item')
            .classed('dimmed', function (d, i) {
                if (!active) return false;
                const franchises = state.filteredData || [];
                return franchises[i] && franchises[i].id !== active;
            });
    }

    State.on('change', (state) => {
        // Rebuild legend when filtered data changes
        const franchises = state.filteredData || [];
        const currentCount = legendContainer.selectAll('.legend-item').size();
        if (currentCount !== franchises.length) {
            buildLegend(state);
        } else {
            updateLegendDimming(state);
        }
    });
    buildLegend(State.get());

    // === App fade-in on load ===
    requestAnimationFrame(() => {
        d3.select('.app').classed('loaded', true);
    });

    // === Clear selections on background click ===
    d3.select('.panels').on('click', function (event) {
        if (event.target === this) {
            State.clearSelections();
        }
    });
})();
