document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('stats.json');
        if (!response.ok) {
            throw new Error(`Failed to load stats: ${response.statusText}`);
        }
        const data = await response.json();

        // Header Profile Data
        document.getElementById('avatar').src = data.profile.avatar_url;
        document.getElementById('name').textContent = data.profile.name || data.profile.login;
        
        const ghLink = document.getElementById('github-link');
        ghLink.href = `https://github.com/${data.profile.login}`;
        document.getElementById('login-text').textContent = `@${data.profile.login}`;

        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const date = new Date(data.updated_at).toLocaleString('pt-BR', dateOptions);
        document.getElementById('updated-at').textContent = `Última atualização: ${date}`;

        // KPI Stats
        const totalRepos = data.profile.public_repos ?? 0;
        const forkedReposCount = (data.profile.forked_repos !== undefined) 
            ? data.profile.forked_repos 
            : (Array.isArray(data.forked_repos) ? data.forked_repos.length : 0);
        const originalReposCount = (data.profile.original_repos !== undefined)
            ? data.profile.original_repos
            : Math.max(0, totalRepos - forkedReposCount);

        document.getElementById('stat-repos').textContent = totalRepos;
        const originalReposEl = document.getElementById('stat-original-repos');
        if (originalReposEl) originalReposEl.textContent = originalReposCount;
        const forkedReposEl = document.getElementById('stat-forked-repos');
        if (forkedReposEl) forkedReposEl.textContent = forkedReposCount;

        document.getElementById('stat-followers').textContent = data.profile.followers;
        document.getElementById('stat-stars').textContent = data.profile.total_stars;
        document.getElementById('stat-forks').textContent = data.profile.total_forks;

        // Forks Modal Setup
        setupForksModal(data);

        // Contributions
        document.getElementById('stat-commits').textContent = data.contributions.last_year_commits;
        document.getElementById('stat-prs').textContent = data.contributions.total_prs;
        document.getElementById('stat-issues').textContent = data.contributions.total_issues;

        // Chart Data
        renderLanguageChart(data.languages);

        // UI Reveal
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');
        loading.style.display = 'none';
        app.classList.remove('hidden');
        // Trigger reflow to apply opacity transition
        void app.offsetWidth;
        app.style.opacity = '1';

    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = `
            <div class="text-red-500 flex flex-col items-center p-8 bg-card rounded-2xl border border-red-500/30">
                <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
                <h2 class="text-2xl font-bold mb-2">Erro ao carregar dados</h2>
                <p class="text-textMuted text-center">Certifique-se de que o arquivo stats.json foi gerado com sucesso.</p>
                <p class="text-xs mt-4 text-red-400 bg-red-500/10 p-3 rounded w-full font-mono">${error.message}</p>
            </div>
        `;
    }

    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const htmlElement = document.documentElement;

    themeToggleBtn.addEventListener('click', () => {
        if (htmlElement.classList.contains('dark')) {
            // Switch to Light
            htmlElement.classList.remove('dark');
            htmlElement.classList.add('light');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            document.body.style.backgroundColor = '#f6f8fa';
            
            // Fix text colors for light theme (Tailwind overrides logic)
            document.querySelectorAll('.text-white').forEach(el => {
                el.dataset.darkColor = 'text-white';
                el.classList.remove('text-white');
                el.classList.add('text-gray-900');
            });
        } else {
            // Switch to Dark
            htmlElement.classList.remove('light');
            htmlElement.classList.add('dark');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
            document.body.style.backgroundColor = '#0d1117';

            document.querySelectorAll('[data-dark-color]').forEach(el => {
                el.classList.remove('text-gray-900');
                el.classList.add(el.dataset.darkColor);
            });
        }
        
        // Ensure chart updates its colors if needed
        updateChartTheme(htmlElement.classList.contains('dark'));
    });
});

let languageChartInstance = null;

function renderLanguageChart(languages) {
    if (Object.keys(languages).length === 0) {
        document.getElementById('languageChart').parentElement.innerHTML = `
            <div class="text-center text-textMuted flex flex-col items-center py-10">
                <i class="fas fa-ghost text-4xl mb-3 opacity-50"></i>
                <p>Nenhuma linguagem encontrada.</p>
            </div>
        `;
        return;
    }

    const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    const topLangs = sorted.slice(0, 5);
    const otherLangs = sorted.slice(5);
    
    if (otherLangs.length > 0) {
        const otherCount = otherLangs.reduce((acc, [, count]) => acc + count, 0);
        topLangs.push(['Outras', otherCount]);
    }

    const labels = topLangs.map(item => item[0]);
    const counts = topLangs.map(item => item[1]);

    const ctx = document.getElementById('languageChart').getContext('2d');
    
    const backgroundColors = [
        'rgba(88, 166, 255, 0.85)',
        'rgba(63, 185, 80, 0.85)',
        'rgba(240, 136, 62, 0.85)',
        'rgba(210, 168, 255, 0.85)',
        'rgba(248, 81, 73, 0.85)',
        'rgba(139, 148, 158, 0.85)'
    ];

    const isDark = document.documentElement.classList.contains('dark');
    
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    languageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: backgroundColors,
                borderColor: isDark ? '#161b22' : '#ffffff',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        color: isDark ? '#c9d1d9' : '#24292f',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(13, 17, 23, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: isDark ? '#fff' : '#000',
                    bodyColor: isDark ? '#c9d1d9' : '#24292f',
                    borderColor: isDark ? '#30363d' : '#e1e4e8',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6
                }
            }
        }
    });
}

function updateChartTheme(isDark) {
    if (!languageChartInstance) return;
    
    languageChartInstance.data.datasets[0].borderColor = isDark ? '#161b22' : '#ffffff';
    languageChartInstance.options.plugins.legend.labels.color = isDark ? '#c9d1d9' : '#24292f';
    languageChartInstance.options.plugins.tooltip.backgroundColor = isDark ? 'rgba(13, 17, 23, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    languageChartInstance.options.plugins.tooltip.titleColor = isDark ? '#fff' : '#000';
    languageChartInstance.options.plugins.tooltip.bodyColor = isDark ? '#c9d1d9' : '#24292f';
    languageChartInstance.options.plugins.tooltip.borderColor = isDark ? '#30363d' : '#e1e4e8';
    
    languageChartInstance.update();
}

function setupForksModal(data) {
    const modal = document.getElementById('forks-modal');
    const modalCard = document.getElementById('forks-modal-card');
    const openBtn = document.getElementById('btn-view-forks');
    const closeBtn = document.getElementById('close-forks-modal');
    const forksList = document.getElementById('forks-list');
    const forksBadge = document.getElementById('modal-forks-badge');
    const forksTotal = document.getElementById('modal-forks-total');
    const ghForksLink = document.getElementById('github-forks-link');

    if (!modal || !openBtn) return;

    const forkedRepos = data.forked_repos || [];
    const count = (data.profile && data.profile.forked_repos !== undefined)
        ? data.profile.forked_repos
        : forkedRepos.length;

    if (forksBadge) forksBadge.textContent = count;
    if (forksTotal) forksTotal.textContent = count;

    if (ghForksLink && data.profile && data.profile.login) {
        ghForksLink.href = `https://github.com/${data.profile.login}?tab=repositories&q=&type=fork`;
    }

    const renderList = () => {
        if (!forksList) return;
        if (forkedRepos.length === 0) {
            forksList.innerHTML = `
                <div class="text-center text-textMuted py-10 flex flex-col items-center">
                    <i class="fas fa-code-branch text-4xl mb-3 opacity-40"></i>
                    <p class="font-medium">Nenhum repositório forkado encontrado.</p>
                </div>
            `;
            return;
        }

        const isDark = document.documentElement.classList.contains('dark');
        const titleClass = isDark ? 'text-white' : 'text-gray-900';

        forksList.innerHTML = forkedRepos.map(repo => `
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" 
               class="block p-4 rounded-xl bg-card/60 hover:bg-card border border-border hover:border-purple-500/50 transition-all duration-200 group">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                            <i class="fas fa-code-branch text-purple-400 text-xs"></i>
                            <span class="font-semibold ${titleClass} group-hover:text-primary transition-colors truncate">${escapeHtml(repo.name)}</span>
                            <i class="fas fa-arrow-up-right-from-square text-[10px] text-textMuted opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                        ${repo.description ? `<p class="text-xs text-textMuted line-clamp-2 mb-2.5 leading-relaxed">${escapeHtml(repo.description)}</p>` : ''}
                        <div class="flex items-center gap-4 text-xs text-textMuted">
                            ${repo.language ? `
                                <span class="inline-flex items-center gap-1.5 font-medium">
                                    <span class="w-2 h-2 rounded-full bg-primary inline-block"></span>
                                    ${escapeHtml(repo.language)}
                                </span>` : ''}
                            ${repo.stargazers_count > 0 ? `
                                <span class="inline-flex items-center gap-1">
                                    <i class="fas fa-star text-yellow-400 text-[10px]"></i>
                                    ${repo.stargazers_count}
                                </span>` : ''}
                            ${repo.forks_count > 0 ? `
                                <span class="inline-flex items-center gap-1">
                                    <i class="fas fa-code-fork text-purple-400 text-[10px]"></i>
                                    ${repo.forks_count}
                                </span>` : ''}
                        </div>
                    </div>
                </div>
            </a>
        `).join('');
    };

    renderList();

    const openModal = () => {
        renderList();
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modalCard.classList.remove('scale-95');
            modalCard.classList.add('scale-100');
        });
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.classList.add('opacity-0');
        modalCard.classList.remove('scale-100');
        modalCard.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    };

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

