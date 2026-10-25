const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('pt-BR');
const fmt = (n) => nf.format(n ?? 0);

let languageChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    setupThemeToggle();

    try {
        const response = await fetch('stats.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Falha ao carregar stats.json: ${response.status} ${response.statusText}`);
        const data = await response.json();

        renderProfile(data);
        renderKpis(data);
        renderContributions(data.contributions || {});
        setupForksModal(data);
        renderLanguageChart(data.languages || []);

        $('loading').style.display = 'none';
        const app = $('app');
        app.classList.remove('hidden');
        void app.offsetWidth; // força reflow para a transição de opacidade
        app.style.opacity = '1';
        requestAnimationFrame(animateBars);
    } catch (error) {
        console.error(error);
        $('loading').innerHTML = `
            <div class="text-red-500 flex flex-col items-center p-8 bg-card rounded-2xl border border-red-500/30 max-w-md">
                <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
                <h2 class="text-2xl font-bold mb-2">Não foi possível carregar os dados</h2>
                <p class="text-textMuted text-center">Verifique se o workflow gerou o arquivo stats.json e recarregue a página.</p>
                <p class="text-xs mt-4 text-red-500 bg-red-500/10 p-3 rounded w-full font-mono">${escapeHtml(error.message)}</p>
            </div>`;
    }
});

/* ---------- Perfil e KPIs ---------- */

function renderProfile(data) {
    const p = data.profile;
    $('avatar').src = p.avatar_url;
    $('name').textContent = p.name || p.login;
    $('github-link').href = `https://github.com/${p.login}`;
    $('login-text').textContent = `@${p.login}`;

    const date = new Date(data.updated_at).toLocaleString('pt-BR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    $('updated-at').textContent = `Última atualização: ${date}`;
}

function renderKpis(data) {
    const p = data.profile;
    const forked = p.forked_repos ?? (data.forked_repos || []).length;
    const original = p.original_repos ?? Math.max(0, (p.public_repos ?? 0) - forked);

    $('stat-repos').textContent = fmt(p.public_repos);
    $('stat-original-repos').textContent = fmt(original);
    $('stat-forked-repos').textContent = fmt(forked);
    $('stat-followers').textContent = fmt(p.followers);
    $('stat-stars').textContent = fmt(p.total_stars);
    $('stat-forks').textContent = fmt(p.total_forks);
}

function renderContributions(c) {
    $('stat-total').textContent = fmt(c.total);
    $('stat-commits').textContent = fmt(c.commits);
    $('stat-prs').textContent = fmt(c.pull_requests);
    $('stat-issues').textContent = fmt(c.issues);
    $('stat-reviews').textContent = fmt(c.reviews);

    if (c.private > 0) {
        $('private-note').textContent = `(incluindo ${fmt(c.private)} em repositórios privados)`;
    }

    // Barras proporcionais ao maior valor entre as quatro categorias
    const values = { commits: c.commits, prs: c.pull_requests, issues: c.issues, reviews: c.reviews };
    const max = Math.max(1, ...Object.values(values).map((v) => v || 0));
    for (const [key, value] of Object.entries(values)) {
        $(`bar-${key}`).dataset.width = `${Math.round(((value || 0) / max) * 100)}%`;
    }
}

function animateBars() {
    document.querySelectorAll('.bar').forEach((el) => { el.style.width = el.dataset.width || '0'; });
}

/* ---------- Tema ---------- */

function setupThemeToggle() {
    const root = document.documentElement;
    const icon = $('theme-icon');
    const sync = () => {
        const isDark = root.classList.contains('dark');
        icon.classList.toggle('fa-moon', isDark);
        icon.classList.toggle('fa-sun', !isDark);
    };
    sync();

    $('theme-toggle').addEventListener('click', () => {
        const toDark = root.classList.contains('light');
        root.classList.toggle('dark', toDark);
        root.classList.toggle('light', !toDark);
        try { localStorage.setItem('theme', toDark ? 'dark' : 'light'); } catch (e) { /* ignora */ }
        sync();
        updateChartTheme(toDark);
    });
}

/* ---------- Gráfico de linguagens (por bytes) ---------- */

function renderLanguageChart(languages) {
    if (!languages.length) {
        $('languageChart').parentElement.innerHTML = `
            <div class="text-center text-textMuted flex flex-col items-center py-10">
                <i class="fas fa-ghost text-4xl mb-3 opacity-50"></i>
                <p>Nenhuma linguagem encontrada nos repositórios públicos.</p>
            </div>`;
        return;
    }

    const top = languages.slice(0, 5).map((l) => ({ ...l }));
    const rest = languages.slice(5);
    if (rest.length) top.push({ name: 'Outras', bytes: rest.reduce((a, l) => a + l.bytes, 0), color: '#8b949e' });

    const total = top.reduce((a, l) => a + l.bytes, 0);
    const fallback = ['#58a6ff', '#3fb950', '#f0883e', '#d2a8ff', '#f85149', '#8b949e'];
    const isDark = document.documentElement.classList.contains('dark');

    Chart.defaults.font.family = "'Inter', sans-serif";
    languageChartInstance = new Chart($('languageChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: top.map((l) => l.name),
            datasets: [{
                data: top.map((l) => l.bytes),
                backgroundColor: top.map((l, i) => l.color || fallback[i]),
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
                        pointStyle: 'circle',
                        generateLabels: (chart) => {
                            const ds = chart.data.datasets[0];
                            return chart.data.labels.map((label, i) => ({
                                text: `${label} ${((ds.data[i] / total) * 100).toFixed(1)}%`,
                                fillStyle: ds.backgroundColor[i],
                                fontColor: chart.options.plugins.legend.labels.color,
                                strokeStyle: ds.backgroundColor[i],
                                pointStyle: 'circle',
                                index: i
                            }));
                        }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(13, 17, 23, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDark ? '#fff' : '#000',
                    bodyColor: isDark ? '#c9d1d9' : '#24292f',
                    borderColor: isDark ? '#30363d' : '#d0d7de',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (ctx) => ` ${((ctx.parsed / total) * 100).toFixed(1)}% (${fmt(Math.round(ctx.parsed / 1024))} KB)`
                    }
                }
            }
        }
    });
}

function updateChartTheme(isDark) {
    if (!languageChartInstance) return;
    const o = languageChartInstance.options.plugins;
    languageChartInstance.data.datasets[0].borderColor = isDark ? '#161b22' : '#ffffff';
    o.legend.labels.color = isDark ? '#c9d1d9' : '#24292f';
    o.tooltip.backgroundColor = isDark ? 'rgba(13, 17, 23, 0.9)' : 'rgba(255, 255, 255, 0.95)';
    o.tooltip.titleColor = isDark ? '#fff' : '#000';
    o.tooltip.bodyColor = isDark ? '#c9d1d9' : '#24292f';
    o.tooltip.borderColor = isDark ? '#30363d' : '#d0d7de';
    languageChartInstance.update();
}

/* ---------- Modal de forks ---------- */

function setupForksModal(data) {
    const modal = $('forks-modal');
    const card = $('forks-modal-card');
    const openBtn = $('btn-view-forks');
    if (!modal || !openBtn) return;

    const repos = data.forked_repos || [];
    const count = data.profile?.forked_repos ?? repos.length;
    $('modal-forks-badge').textContent = count;
    $('modal-forks-total').textContent = count;
    if (data.profile?.login) {
        $('github-forks-link').href = `https://github.com/${data.profile.login}?tab=repositories&q=&type=fork`;
    }

    const renderList = () => {
        const list = $('forks-list');
        if (!repos.length) {
            list.innerHTML = `
                <div class="text-center text-textMuted py-10 flex flex-col items-center">
                    <i class="fas fa-code-branch text-4xl mb-3 opacity-40"></i>
                    <p class="font-medium">Nenhum repositório forkado encontrado.</p>
                </div>`;
            return;
        }
        list.innerHTML = repos.map((repo) => `
            <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer"
               class="block p-4 rounded-xl bg-card/60 hover:bg-card border border-border hover:border-purple-500/50 transition-colors group">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <i class="fas fa-code-branch text-purple-500 text-xs"></i>
                    <span class="font-semibold text-strong group-hover:text-primary transition-colors truncate">${escapeHtml(repo.name)}</span>
                </div>
                ${repo.description ? `<p class="text-xs text-textMuted line-clamp-2 mb-2.5 leading-relaxed">${escapeHtml(repo.description)}</p>` : ''}
                <div class="flex items-center gap-4 text-xs text-textMuted">
                    ${repo.language ? `<span class="inline-flex items-center gap-1.5 font-medium"><span class="w-2 h-2 rounded-full bg-primary inline-block"></span>${escapeHtml(repo.language)}</span>` : ''}
                    ${repo.stargazers_count > 0 ? `<span class="inline-flex items-center gap-1"><i class="fas fa-star text-yellow-500 text-[10px]"></i>${fmt(repo.stargazers_count)}</span>` : ''}
                    ${repo.forks_count > 0 ? `<span class="inline-flex items-center gap-1"><i class="fas fa-code-fork text-purple-500 text-[10px]"></i>${fmt(repo.forks_count)}</span>` : ''}
                </div>
            </a>`).join('');
    };
    renderList();

    const open = () => {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            card.classList.replace('scale-95', 'scale-100');
        });
        document.body.style.overflow = 'hidden';
        $('close-forks-modal').focus();
    };
    const close = () => {
        modal.classList.add('opacity-0');
        card.classList.replace('scale-100', 'scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            openBtn.focus();
        }, 300);
    };

    openBtn.addEventListener('click', (e) => { e.preventDefault(); open(); });
    $('close-forks-modal').addEventListener('click', (e) => { e.preventDefault(); close(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
}