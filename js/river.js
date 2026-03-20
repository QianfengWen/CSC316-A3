/**
 * river.js — Franchise swim-lane timeline with revenue area pulses.
 * Each franchise gets a horizontal lane. Movies appear as dots within the lane.
 * A soft area fill under the dots encodes revenue, creating a "pulse" effect.
 */
const RiverChart = (() => {
    let svg, g, width, height, xScale, brush;
    const margin = { top: 10, right: 20, bottom: 30, left: 10 };
    const laneHeight = 32;
    const lanePadding = 4;

    function init(container) {
        const el = d3.select(container);
        const rect = el.node().getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = rect.height - margin.top - margin.bottom;

        svg = el.append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // X-axis
        xScale = d3.scaleLinear().range([0, width]);
        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        // Lane container (rendered first so brush overlay sits on top for event capture)
        g.append('g').attr('class', 'lanes');

        // Brush (appended after lanes so it sits on top in SVG z-order)
        brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on('end', brushed);

        g.append('g')
            .attr('class', 'brush')
            .call(brush)
            .selectAll('.overlay')
            .style('pointer-events', 'all')
            .style('cursor', 'crosshair');

        State.on('change', update);
    }

    function brushed(event) {
        if (!event.selection) {
            State.set('brushRange', null);
            return;
        }
        const [x0, x1] = event.selection;
        const yearStart = Math.round(xScale.invert(x0));
        const yearEnd = Math.round(xScale.invert(x1));
        State.set('brushRange', [yearStart, yearEnd]);
    }

    function update(state) {
        const franchises = state.filteredData;
        if (!franchises) return;

        const { yearRange } = state.activeFilters;
        xScale.domain(yearRange);

        // Update x-axis
        g.select('.x-axis')
            .transition().duration(600)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(10))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');
        g.select('.x-axis').selectAll('line, path').style('stroke', '#333');

        // Revenue scale (shared across all lanes for dot sizing)
        const allRevenues = franchises.flatMap(f => f.movies.map(m => m.revenue)).filter(r => r > 0);
        const revenueMax = d3.max(allRevenues) || 1;
        const revenueScale = d3.scaleLinear().domain([0, revenueMax]).range([2, laneHeight / 2 - 2]);
        const dotScale = d3.scaleSqrt().domain([0, d3.max(allRevenues) || 1]).range([3, 10]);
        const ratingOpacity = d3.scaleLinear().domain([4, 9]).range([0.4, 1]).clamp(true);

        // Bind franchise lanes
        const lanes = g.select('.lanes')
            .selectAll('.lane')
            .data(franchises, d => d.id);

        lanes.exit()
            .transition().duration(600)
            .style('opacity', 0)
            .remove();

        const lanesEnter = lanes.enter()
            .append('g')
            .attr('class', 'lane')
            .style('opacity', 0);

        const allLanes = lanesEnter.merge(lanes);

        allLanes
            .transition().duration(600)
            .attr('transform', (d, i) => `translate(0, ${i * (laneHeight + lanePadding)})`)
            .style('opacity', d => {
                if (state.highlightedAnnotation) {
                    const hl = state.highlightedAnnotation;
                    if (hl.franchise_ids.length > 0 && !hl.franchise_ids.includes(d.id)) return 0.15;
                }
                if (state.selectedFranchise && state.selectedFranchise !== d.id && state.lockedFranchise !== d.id) return 0.3;
                return 1;
            });

        // Franchise label
        allLanes.each(function (franchise) {
            const lane = d3.select(this);

            // Label
            let label = lane.select('.lane-label');
            if (label.empty()) {
                label = lane.append('text')
                    .attr('class', 'lane-label')
                    .attr('x', -5)
                    .attr('y', laneHeight / 2)
                    .attr('text-anchor', 'end')
                    .style('font-size', '9px')
                    .style('fill', franchise.color)
                    .style('dominant-baseline', 'middle');
            }
            // Hide labels to save space — franchise identity comes from color + tooltip
            label.text('');

            // Area fill (revenue pulses)
            const movies = franchise.movies.slice().sort((a, b) => a.year - b.year);

            // Build area data: for each movie, create a peak point; between movies, taper to near-zero
            const areaData = [];
            movies.forEach((m, i) => {
                if (i > 0) {
                    // Add zero-point midway between previous and current movie
                    const prevYear = movies[i - 1].year;
                    const midYear = (prevYear + m.year) / 2;
                    areaData.push({ year: midYear, revenue: 0 });
                }
                areaData.push({ year: m.year, revenue: m.revenue });
            });

            const areaGen = d3.area()
                .x(d => xScale(d.year))
                .y0(laneHeight)
                .y1(d => laneHeight - revenueScale(d.revenue))
                .curve(d3.curveMonotoneX);

            let areaPath = lane.select('.lane-area');
            if (areaPath.empty()) {
                areaPath = lane.append('path')
                    .attr('class', 'lane-area')
                    .style('fill', franchise.color)
                    .style('opacity', 0.2);
            }
            areaPath.transition().duration(600)
                .attr('d', areaGen(areaData));

            // Movie dots
            const dots = lane.selectAll('.movie-dot')
                .data(movies, d => d.title);

            dots.exit()
                .transition().duration(600)
                .attr('r', 0)
                .remove();

            const dotsEnter = dots.enter()
                .append('circle')
                .attr('class', 'movie-dot')
                .attr('r', 0)
                .attr('cy', laneHeight / 2)
                .style('cursor', 'pointer');

            dotsEnter.merge(dots)
                .on('mouseover', (event, d) => {
                    State.set('selectedFranchise', franchise.id);
                    showTooltip(event, `
                        <div class="tt-title">${d.title} (${d.year})</div>
                        <div class="tt-row"><span class="tt-label">Revenue</span><span class="tt-value">${fmt.moneyShort(d.revenue)}</span></div>
                        <div class="tt-row"><span class="tt-label">Rating</span><span class="tt-value">${fmt.rating(d.vote_average)}</span></div>
                        <div class="tt-row"><span class="tt-label">Budget</span><span class="tt-value">${d.budget ? fmt.moneyShort(d.budget) : 'N/A'}</span></div>
                    `);
                })
                .on('mouseout', (event, d) => {
                    if (!state.lockedFranchise) State.set('selectedFranchise', null);
                    hideTooltip();
                })
                .on('click', (event, d) => {
                    event.stopPropagation();
                    State.set('selectedMovie', d);
                    State.set('selectedFranchise', franchise.id);
                    State.set('lockedFranchise', franchise.id);
                })
                .each(function (d) {
                    // Apply pulse class if annotation highlights match this dot
                    const el = d3.select(this);
                    if (state.highlightedAnnotation) {
                        const hl = state.highlightedAnnotation;
                        const franchiseMatch = hl.franchise_ids.length === 0 || hl.franchise_ids.includes(franchise.id);
                        const yearMatch = hl.year_range.length === 0 || (d.year >= hl.year_range[0] && d.year <= hl.year_range[1]);
                        const entryMatch = hl.entry_numbers.length === 0 || hl.entry_numbers.includes(d.entry_number);
                        el.classed('pulse', franchiseMatch && yearMatch && entryMatch);
                    } else {
                        el.classed('pulse', false);
                    }
                })
                .transition().duration(600)
                .attr('cx', d => xScale(d.year))
                .attr('cy', laneHeight / 2)
                .attr('r', d => dotScale(d.revenue))
                .style('fill', franchise.color)
                .style('opacity', d => ratingOpacity(d.vote_average));
        });

        // Adjust SVG height to fit all lanes
        const totalHeight = franchises.length * (laneHeight + lanePadding) + margin.top + margin.bottom + 30;
        svg.attr('height', Math.max(totalHeight, 200));
    }

    return { init };
})();
