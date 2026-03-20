/**
 * profile.js — Franchise/movie detail card.
 * Shows aggregate franchise stats by default, individual movie details on click.
 */
const ProfileCard = (() => {
    let container;

    function init(selector) {
        container = d3.select(selector);
        renderEmpty();
        State.on('change', update);
    }

    function renderEmpty() {
        container.html('');
        container.append('div')
            .attr('class', 'profile-empty')
            .text('Hover a franchise or click a movie to see details');
    }

    function update(state) {
        if (state.selectedMovie) {
            renderMovie(state.selectedMovie, state);
        } else if (state.selectedFranchise || state.lockedFranchise) {
            const fid = state.lockedFranchise || state.selectedFranchise;
            const franchise = (state.filteredData || []).find(f => f.id === fid);
            if (franchise) {
                renderFranchise(franchise, state);
            }
        } else {
            renderEmpty();
        }
    }

    function renderFranchise(franchise, state) {
        container.html('');
        const div = container.append('div').attr('class', 'profile-franchise');

        // Filter movies by brush range if active
        let movies = franchise.movies;
        if (state.brushRange) {
            movies = movies.filter(m => m.year >= state.brushRange[0] && m.year <= state.brushRange[1]);
        }

        if (movies.length === 0) {
            div.append('div').attr('class', 'profile-name').style('color', franchise.color).text(franchise.name);
            div.append('div').attr('class', 'profile-years').text('No movies in selected range');
            return;
        }

        const totalRevenue = d3.sum(movies, m => m.revenue);
        const avgRating = d3.mean(movies, m => m.vote_average);
        const budgets = movies.filter(m => m.budget > 0);
        const avgBudget = budgets.length > 0 ? d3.mean(budgets, m => m.budget) : null;
        const minYear = d3.min(movies, m => m.year);
        const maxYear = d3.max(movies, m => m.year);

        div.append('div')
            .attr('class', 'profile-name')
            .style('color', franchise.color)
            .text(franchise.name);

        div.append('div')
            .attr('class', 'profile-years')
            .text(`${minYear} – ${maxYear} · ${movies.length} entries`);

        const stats = div.append('div').attr('class', 'profile-stats');

        addStat(stats, fmt.moneyShort(totalRevenue), 'Total Revenue');
        addStat(stats, fmt.rating(avgRating), 'Avg Rating');
        addStat(stats, avgBudget ? fmt.moneyShort(avgBudget) : 'N/A', 'Avg Budget');
    }

    function renderMovie(movie, state) {
        container.html('');
        const div = container.append('div').attr('class', 'profile-movie');

        // Poster
        if (movie.poster_path) {
            div.append('img')
                .attr('class', 'profile-poster')
                .attr('src', `https://image.tmdb.org/t/p/w200${movie.poster_path}`)
                .attr('alt', movie.title)
                .on('error', function () {
                    d3.select(this).remove();
                    addPosterPlaceholder(div, state);
                });
        } else {
            addPosterPlaceholder(div, state);
        }

        div.append('div')
            .attr('class', 'profile-name')
            .text(`${movie.title} (${movie.year})`);

        const stats = div.append('div').attr('class', 'profile-stats');
        addStat(stats, fmt.moneyShort(movie.revenue), 'Revenue');
        addStat(stats, fmt.rating(movie.vote_average), 'Rating');
        addStat(stats, movie.budget ? fmt.moneyShort(movie.budget) : 'N/A', 'Budget');
        addStat(stats, movie.runtime ? `${movie.runtime} min` : 'N/A', 'Runtime');

        // Genre tags
        const genres = div.append('div').attr('class', 'profile-genres');
        movie.genres.forEach(g => {
            genres.append('span').attr('class', 'profile-genre-tag').text(g);
        });

        // Back button
        div.append('button')
            .attr('class', 'profile-back')
            .text('← Back to franchise')
            .on('click', () => {
                State.set('selectedMovie', null);
            });
    }

    function addPosterPlaceholder(parent, state) {
        const franchise = (state.filteredData || []).find(f => f.id === state.selectedFranchise);
        parent.append('div')
            .attr('class', 'profile-poster-placeholder')
            .style('background', (franchise ? franchise.color : '#333') + '22')
            .style('border', `1px solid ${franchise ? franchise.color : '#333'}`)
            .text('🎬');
    }

    function addStat(container, value, label) {
        const stat = container.append('div');
        stat.append('div').attr('class', 'profile-stat-value').text(value);
        stat.append('div').attr('class', 'profile-stat-label').text(label);
    }

    return { init };
})();
