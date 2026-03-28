/**
 * trajectory.js — Sequel slope chart.
 * Shows how ratings (or selected metric) change across sequel number.
 * Lines are drawn per-series within each franchise (reboots get separate segments).
 */
const TrajectoryChart = (() => {
    let svg, g, width, height, xScale, yScale;
    const margin = { top: 10, right: 15, bottom: 30, left: 40 };
    const metricLabels = {
        vote_average: 'Rating',
        revenue: 'Revenue',
        budget: 'Budget'
    };

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
        g.append('g').attr('class', 'lines');

        State.on('change', update);
    }

    function update(state) {
        const franchises = state.filteredData;
        if (!franchises) return;

        const metric = state.activeFilters.metric;
        const brushRange = state.brushRange;

        d3.select('#panel-trajectory .panel-title')
            .text(`SEQUEL TRAJECTORY — ${metricLabels[metric] || 'Rating'} by Entry #`);

        // Build series data: group movies by franchise + series
        const seriesData = [];
        franchises.forEach(franchise => {
            const seriesMap = {};
            franchise.movies.forEach(m => {
                // If brush is active, only include movies in range
                if (brushRange && (m.year < brushRange[0] || m.year > brushRange[1])) return;
                const key = m.series || 'main';
                if (!seriesMap[key]) seriesMap[key] = [];
                seriesMap[key].push(m);
            });

            const seriesKeys = Object.keys(seriesMap).sort((a, b) => {
                const aMin = d3.min(seriesMap[a], m => m.year);
                const bMin = d3.min(seriesMap[b], m => m.year);
                return aMin - bMin;
            });

            seriesKeys.forEach((key, idx) => {
                seriesData.push({
                    id: `${franchise.id}-${key}`,
                    franchiseId: franchise.id,
                    color: franchise.color,
                    series: key,
                    isRebootBoundary: idx > 0,
                    movies: seriesMap[key].sort((a, b) => a.entry_number - b.entry_number),
                });
            });
        });

        // Scales
        const maxEntry = d3.max(seriesData, s => d3.max(s.movies, m => m.entry_number)) || 10;
        xScale.domain([1, maxEntry]);

        let yDomain;
        if (metric === 'vote_average') {
            yDomain = [0, 10];
        } else {
            const allVals = seriesData.flatMap(s => s.movies.map(m => m[metric])).filter(v => v > 0);
            yDomain = [0, d3.max(allVals) || 1];
        }
        yScale.domain(yDomain);

        // Axes
        g.select('.x-axis')
            .transition().duration(600)
            .call(d3.axisBottom(xScale).ticks(maxEntry).tickFormat(d => `#${d}`))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        const yAxisFormat = metric === 'vote_average' ? d3.format('.0f') : fmt.moneyShort;
        g.select('.y-axis')
            .transition().duration(600)
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(yAxisFormat))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        g.selectAll('.x-axis, .y-axis').selectAll('line, path').style('stroke', '#333');

        // Lines
        const line = d3.line()
            .x(d => xScale(d.entry_number))
            .y(d => yScale(d[metric]))
            .curve(d3.curveMonotoneX);

        const lines = g.select('.lines')
            .selectAll('.trajectory-group')
            .data(seriesData, d => d.id);

        lines.exit()
            .transition().duration(600)
            .style('opacity', 0)
            .remove();

        const linesEnter = lines.enter()
            .append('g')
            .attr('class', 'trajectory-group');

        linesEnter.append('path')
            .attr('class', 'trajectory-line')
            .attr('fill', 'none')
            .attr('stroke-width', 2.5);

        const allLines = linesEnter.merge(lines);

        allLines.select('.trajectory-line')
            .transition().duration(600)
            .attr('d', d => line(d.movies))
            .attr('stroke', d => d.color)
            .attr('stroke-dasharray', 'none')
            .style('opacity', d => {
                if (state.highlightedAnnotation) {
                    const hl = state.highlightedAnnotation;
                    if (hl.franchise_ids.length > 0 && !hl.franchise_ids.includes(d.franchiseId)) return 0.1;
                }
                if (state.selectedFranchise && state.selectedFranchise !== d.franchiseId) return 0.1;
                return 0.8;
            });

        // Draw dashed connector lines between reboot series within the same franchise
        const connectorData = [];
        const byFranchise = d3.group(seriesData, d => d.franchiseId);
        byFranchise.forEach((seriesList, fid) => {
            for (let i = 1; i < seriesList.length; i++) {
                const prev = seriesList[i - 1];
                const curr = seriesList[i];
                if (prev.movies.length > 0 && curr.movies.length > 0) {
                    const lastMovie = prev.movies[prev.movies.length - 1];
                    const firstMovie = curr.movies[0];
                    connectorData.push({
                        id: `${fid}-connector-${i}`,
                        franchiseId: fid,
                        color: prev.color,
                        from: lastMovie,
                        to: firstMovie
                    });
                }
            }
        });

        const connectors = g.select('.lines')
            .selectAll('.reboot-connector')
            .data(connectorData, d => d.id);

        connectors.exit().transition().duration(600).style('opacity', 0).remove();

        connectors.enter()
            .append('line')
            .attr('class', 'reboot-connector')
            .merge(connectors)
            .transition().duration(600)
            .attr('x1', d => xScale(d.from.entry_number))
            .attr('y1', d => yScale(d.from[metric]))
            .attr('x2', d => xScale(d.to.entry_number))
            .attr('y2', d => yScale(d.to[metric]))
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '6,3')
            .style('opacity', d => {
                if (state.selectedFranchise && state.selectedFranchise !== d.franchiseId) return 0.1;
                return 0.5;
            });

        // Dots on each line
        allLines.each(function (seriesItem) {
            const group = d3.select(this);
            const dots = group.selectAll('.trajectory-dot')
                .data(seriesItem.movies, d => d.title);

            dots.exit().transition().duration(600).attr('r', 0).remove();

            const dotsEnter = dots.enter()
                .append('circle')
                .attr('class', 'trajectory-dot')
                .attr('r', 0)
                .style('cursor', 'pointer');

            dotsEnter.merge(dots)
                .on('mouseover', (event, d) => {
                    State.set('selectedFranchise', seriesItem.franchiseId);
                    showTooltip(event, `
                        <div class="tt-title">${d.title}</div>
                        <div class="tt-row"><span class="tt-label">Entry</span><span class="tt-value">#${d.entry_number} (${d.series})</span></div>
                        <div class="tt-row"><span class="tt-label">${metric === 'vote_average' ? 'Rating' : 'Value'}</span><span class="tt-value">${metric === 'vote_average' ? fmt.rating(d[metric]) : fmt.moneyShort(d[metric])}</span></div>
                    `);
                })
                .on('mouseout', () => {
                    if (!state.lockedFranchise) State.set('selectedFranchise', null);
                    hideTooltip();
                })
                .on('click', (event, d) => {
                    event.stopPropagation();
                    const fid = seriesItem.franchiseId;
                    if (state.lockedFranchise === fid) {
                        State.set('lockedFranchise', null);
                        State.set('selectedFranchise', null);
                    } else {
                        State.set('lockedFranchise', fid);
                        State.set('selectedFranchise', fid);
                    }
                })
                .each(function (d) {
                    // Apply pulse for annotation highlights
                    const el = d3.select(this);
                    if (state.highlightedAnnotation) {
                        const hl = state.highlightedAnnotation;
                        const franchiseMatch = hl.franchise_ids.length === 0 || hl.franchise_ids.includes(seriesItem.franchiseId);
                        const entryMatch = hl.entry_numbers.length === 0 || hl.entry_numbers.includes(d.entry_number);
                        el.classed('pulse', franchiseMatch && entryMatch);
                    } else {
                        el.classed('pulse', false);
                    }
                })
                .transition().duration(600)
                .attr('cx', d => xScale(d.entry_number))
                .attr('cy', d => yScale(d[metric]))
                .attr('r', 4)
                .style('fill', seriesItem.color)
                .style('opacity', () => {
                    if (state.selectedFranchise && state.selectedFranchise !== seriesItem.franchiseId) return 0.1;
                    return 1;
                });
        });

        // Hover interaction on lines
        allLines
            .on('mouseover', function (event, d) {
                if (!state.lockedFranchise) {
                    State.set('selectedFranchise', d.franchiseId);
                }
            })
            .on('mouseout', function () {
                if (!state.lockedFranchise) {
                    State.set('selectedFranchise', null);
                }
            });
    }

    return { init };
})();
