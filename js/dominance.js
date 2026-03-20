/**
 * dominance.js — Stacked area chart showing franchise box office share by year.
 */
const DominanceChart = (() => {
    let svg, g, width, height, xScale, yScale;
    const margin = { top: 10, right: 15, bottom: 30, left: 50 };

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

        xScale = d3.scaleLinear().range([0, width]);
        yScale = d3.scaleLinear().range([height, 0]);

        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
        g.append('g').attr('class', 'y-axis');
        g.append('g').attr('class', 'areas');

        State.on('change', update);
    }

    function update(state) {
        const franchises = state.filteredData;
        if (!franchises || franchises.length === 0) return;

        const brushRange = state.brushRange;
        const yearRange = state.activeFilters.yearRange;
        const effectiveRange = brushRange || yearRange;

        // Build year-franchise revenue matrix
        const years = d3.range(effectiveRange[0], effectiveRange[1] + 1);
        const franchiseIds = franchises.map(f => f.id);

        const yearData = years.map(year => {
            const row = { year };
            franchises.forEach(f => {
                const moviesThisYear = f.movies.filter(m => m.year === year);
                row[f.id] = d3.sum(moviesThisYear, m => m.revenue);
            });
            return row;
        });

        // Stack
        const stack = d3.stack()
            .keys(franchiseIds)
            .value((d, key) => d[key] || 0)
            .order(d3.stackOrderDescending);

        const stackedData = stack(yearData);

        // Scales
        xScale.domain(effectiveRange);
        yScale.domain([0, d3.max(yearData, d => {
            return d3.sum(franchiseIds, id => d[id] || 0);
        }) || 1]);

        // Axes
        g.select('.x-axis')
            .transition().duration(600)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(8))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        g.select('.y-axis')
            .transition().duration(600)
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(fmt.moneyShort))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        g.selectAll('.x-axis, .y-axis').selectAll('line, path').style('stroke', '#333');

        // Color map
        const colorMap = {};
        franchises.forEach(f => { colorMap[f.id] = f.color; });

        // Areas
        const area = d3.area()
            .x(d => xScale(d.data.year))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        const areas = g.select('.areas')
            .selectAll('.dominance-area')
            .data(stackedData, d => d.key);

        areas.exit()
            .transition().duration(600)
            .style('opacity', 0)
            .remove();

        const areasEnter = areas.enter()
            .append('path')
            .attr('class', 'dominance-area')
            .style('opacity', 0)
            .style('cursor', 'pointer');

        areasEnter.merge(areas)
            .on('mouseover', (event, d) => {
                const franchiseId = d.key;
                const franchise = franchises.find(f => f.id === franchiseId);
                if (!franchise) return;

                // Find nearest year
                const [mx] = d3.pointer(event, g.node());
                const year = Math.round(xScale.invert(mx));
                const yearRow = yearData.find(r => r.year === year);
                const rev = yearRow ? yearRow[franchiseId] || 0 : 0;

                if (!state.lockedFranchise) State.set('selectedFranchise', franchiseId);
                showTooltip(event, `
                    <div class="tt-title">${franchise.name}</div>
                    <div class="tt-row"><span class="tt-label">Year</span><span class="tt-value">${year}</span></div>
                    <div class="tt-row"><span class="tt-label">Revenue</span><span class="tt-value">${fmt.moneyShort(rev)}</span></div>
                `);
            })
            .on('mouseout', () => {
                if (!state.lockedFranchise) State.set('selectedFranchise', null);
                hideTooltip();
            })
            .on('click', (event, d) => {
                event.stopPropagation();
                const fid = d.key;
                if (state.lockedFranchise === fid) {
                    State.set('lockedFranchise', null);
                    State.set('selectedFranchise', null);
                } else {
                    State.set('lockedFranchise', fid);
                    State.set('selectedFranchise', fid);
                }
            })
            .transition().duration(600)
            .attr('d', area)
            .style('fill', d => colorMap[d.key] || '#888')
            .style('opacity', d => {
                if (state.highlightedAnnotation) {
                    const hl = state.highlightedAnnotation;
                    if (hl.franchise_ids.length > 0 && !hl.franchise_ids.includes(d.key)) return 0.1;
                }
                if (state.selectedFranchise && state.selectedFranchise !== d.key) return 0.15;
                return 0.7;
            });
    }

    return { init };
})();
