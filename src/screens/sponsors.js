/* ============================================================
   ANCHOR — Sponsors / "Built with" Screen
   Credits hackathon sponsors and how each was used
   ============================================================ */

const SPONSORS = [
  {
    name: 'InsForge',
    role: 'Agentic backend',
    used: 'Postgres · Auth · Realtime · AI Gateway · Edge Functions · pgvector memories',
    url: 'https://github.com/InsForge/InsForge',
  },
  {
    name: 'Vercel',
    role: 'Frontend deploy + AI SDK',
    used: 'Hosting target for Vite build · AI SDK reference',
    url: 'https://vercel.com',
  },
  {
    name: 'Replicas',
    role: 'Background coding agents',
    used: 'Suggested workflow for parallelized agent PRs on this repo',
    url: 'https://tryreplicas.com',
  },
  {
    name: 'Limrun',
    role: 'Cloud mobile preview',
    used: 'Targeted as preview surface for the iPhone 17 Pro mock app',
    url: 'https://lim.run',
  },
  {
    name: 'Cognition · Devin',
    role: 'AI software engineer',
    used: 'Reference agent persona for the Coach agent prompt',
    url: 'https://www.cognition.ai',
  },
  {
    name: 'AI Nexus',
    role: 'Community + events',
    used: 'Hosts of the Agentic Dev Tools Hackathon · 6/6 SF',
    url: 'https://ainexus.global',
  },
  {
    name: 'Entrepreneur First',
    role: 'Talent investor',
    used: 'Founder community partner for the event',
    url: 'https://www.joinef.com',
  },
];

export function render(container) {
  const screen = document.createElement('div');
  screen.className = 'screen flex flex-col';

  screen.innerHTML = `
    <div class="flex flex-between items-center mb-4">
      <h1 class="heading">Built with</h1>
      <span class="badge badge-primary">${SPONSORS.length} partners</span>
    </div>
    <p class="text-secondary text-sm mb-6">
      Mainframe was built at the Agentic Dev Tools Hackathon (6/6 · San Francisco).
      Tap any card to visit the partner.
    </p>

    <div class="flex flex-col gap-3 mb-6" id="sponsors-list">
      ${SPONSORS.map((s) => `
        <a class="sponsor-card" href="${s.url}" target="_blank" rel="noopener noreferrer">
          <span class="name">${s.name}</span>
          <span class="role">${s.role}</span>
          <span class="used">${s.used}</span>
        </a>
      `).join('')}
    </div>

    <button class="btn btn-ghost btn-block mt-2" id="sponsors-back-btn">
      ← Back to Dashboard
    </button>
  `;

  container.appendChild(screen);

  screen.querySelector('#sponsors-back-btn').addEventListener('click', () => {
    window.navigateTo('dashboard');
  });
}
