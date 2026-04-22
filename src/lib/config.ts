/**
 * Configurazione runtime.
 *
 * Le variabili sensibili (token GitHub) vanno nel file `.env.local` che NON deve
 * essere committato. Il token viene incluso nel bundle al momento della build,
 * quindi usa un Personal Access Token *fine-grained* limitato al solo repo
 * `goal-quest` con permessi Contents: read & write. Per il POC va bene; per
 * la produzione va messo dietro un proxy (es. Cloudflare Worker).
 */

const env = import.meta.env;

export const config = {
  github: {
    owner: (env.VITE_GITHUB_OWNER as string) || "mramundo",
    repo: (env.VITE_GITHUB_REPO as string) || "goal-quest",
    branch: (env.VITE_GITHUB_BRANCH as string) || "main",
    token: (env.VITE_GITHUB_TOKEN as string) || "",
    dataDir: "data",
  },
  registration: {
    // Template issue su GitHub per richiedere l'accesso
    issueTemplate: "registration.yml",
  },
  /**
   * Se il token non è presente, l'app gira in modalità demo:
   * i dati sono letti dai JSON statici e le modifiche sono mantenute
   * solo in memoria (localStorage come cache). Serve per il primo avvio
   * quando il repo non è ancora pubblicato.
   */
  demoMode: !env.VITE_GITHUB_TOKEN,
} as const;

export const githubRawUrl = (path: string) =>
  `https://raw.githubusercontent.com/${config.github.owner}/${config.github.repo}/${config.github.branch}/${path}`;

export const githubApiUrl = (path: string) =>
  `https://api.github.com/repos/${config.github.owner}/${config.github.repo}/${path}`;

export const githubIssueUrl = (body: Record<string, string>) => {
  const params = new URLSearchParams({
    template: config.registration.issueTemplate,
    ...body,
  });
  return `https://github.com/${config.github.owner}/${config.github.repo}/issues/new?${params.toString()}`;
};
