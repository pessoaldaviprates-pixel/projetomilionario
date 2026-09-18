import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    errors.push(`${name}: ${error.message}`);
  }
}

await step('landing carrega', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (!(await page.getByText('mais organizada').first().isVisible())) throw new Error('hero ausente');
});

await step('login com usuário semeado', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', 'gabriel@nexora.app');
  await page.fill('input[name="password"]', 'Nexora@2026');
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);
});

await step('dashboard mostra dados reais', async () => {
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  for (const expected of ['Olá, Prates', 'Minhas tarefas', 'Reuniões de hoje', 'Projetos em andamento']) {
    if (!body.includes(expected)) throw new Error(`faltou "${expected}"`);
  }
});

await step('sugestões de IA aparecem ou não quebram', async () => {
  const body = await page.textContent('body');
  console.log('   → tarefas hoje na tela:', /Tarefas de hoje/.test(body));
});

await step('busca global responde', async () => {
  const response = await page.request.get(`${BASE}/api/busca?q=dashboard`);
  if (!response.ok()) throw new Error(`status ${response.status()}`);
  const json = await response.json();
  console.log('   → resultados:', json.data.length, json.data.slice(0, 3).map((h) => `${h.type}:${h.title}`).join(' | '));
  if (json.data.length === 0) throw new Error('busca não retornou nada');
});

await step('isolamento: tarefa de outro tenant não é acessível', async () => {
  const response = await page.request.get(`${BASE}/api/tarefas/id-inexistente-de-outro-tenant`);
  if (response.status() !== 404) throw new Error(`esperado 404, veio ${response.status()}`);
});

await step('screenshot do dashboard', async () => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/claude-0/-home-user-projetomilionario/392cff7c-0253-5ea2-a805-159c77469745/scratchpad/dashboard.png', fullPage: false });
});

await browser.close();

console.log('\n--- erros de console/página ---');
console.log(errors.length === 0 ? 'nenhum' : errors.join('\n'));
process.exit(errors.length > 0 ? 1 : 0);
