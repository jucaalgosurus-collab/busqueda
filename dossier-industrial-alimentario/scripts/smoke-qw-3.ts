// scripts/smoke-qw-3.ts — QW-3: modo oscuro (data-theme toggle)
// 8 asserts: CSS, layout anti-FOUC, ThemeToggle, Navbar, lucide, localStorage
// Uso: pnpm smoke:qw-3
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const F = (rel: string) => path.join(ROOT, rel);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel: string): string {
  const p = F(rel);
  if (!fs.existsSync(p)) throw new Error(`file not found: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

console.log('\n[QW-3] Modo oscuro (data-theme toggle) — smoke\n');

const css = read('app/globals.css');
const layout = read('app/layout.tsx');
const navbar = read('components/Navbar.tsx');

const themeTogglePath = F('components/ThemeToggle.tsx');
const themeToggleExists = fs.existsSync(themeTogglePath);
let themeToggle = '';
if (themeToggleExists) themeToggle = read('components/ThemeToggle.tsx');

// 1. globals.css contiene el bloque [data-theme="dark"]
check(
  'globals.css define bloque [data-theme="dark"]',
  /\[data-theme=["']dark["']\]\s*\{[\s\S]*--surus-bg[\s\S]*\}/.test(css),
);

// 2. --surus-bg y --surus-text redefinidos en dark
const darkBlockMatch = css.match(/\[data-theme=["']dark["']\]\s*\{([\s\S]+?)\n\}/);
const darkBlock = darkBlockMatch ? darkBlockMatch[1] : '';
check(
  '--surus-bg redefinido en dark',
  /--surus-bg\s*:\s*#[0-9a-fA-F]+/.test(darkBlock),
);
check(
  '--surus-text redefinido en dark',
  /--surus-text\s*:\s*#[0-9a-fA-F]+/.test(darkBlock),
);

// 3. layout.tsx tiene script anti-FOUC
const hasHeadWithScript =
  /<head>[\s\S]*?<\/head>/.test(layout) &&
  /dangerouslySetInnerHTML/.test(layout) &&
  /localStorage\.getItem\(['"]theme['"]\)/.test(layout) &&
  /document\.documentElement\.setAttribute\(['"]data-theme['"]/.test(layout);
check('app/layout.tsx tiene <script> anti-FOUC en <head>', hasHeadWithScript);

// 4. ThemeToggle.tsx existe y exporta ThemeToggle
check(
  'components/ThemeToggle.tsx existe y exporta ThemeToggle',
  themeToggleExists && /export\s+function\s+ThemeToggle\b/.test(themeToggle),
);

// 5. Toggle maneja click → setAttribute + localStorage.setItem
const toggleHasClick =
  themeToggleExists &&
  /document\.documentElement\.setAttribute\(['"]data-theme['"]/.test(themeToggle) &&
  /localStorage\.setItem\(\s*STORAGE_KEY/.test(themeToggle);
check('ThemeToggle persiste con setItem y aplica setAttribute', toggleHasClick);

// 6. Navbar.tsx importa ThemeToggle y lo renderiza
check(
  'Navbar.tsx importa ThemeToggle y lo renderiza',
  /import\s+\{[^}]*ThemeToggle[^}]*\}\s+from\s+['"]\.\/ThemeToggle['"]/.test(navbar) &&
    /<ThemeToggle\s*\/>/.test(navbar),
);

// 7. ThemeToggle SSR-safe: lee localStorage solo en useEffect
// Verifica: tiene 'use client', llama a readInitialTheme() dentro de useEffect,
// y NO usa window/localStorage en el cuerpo del componente (antes del return).
const toggleBody = themeToggleExists
  ? (themeToggle.match(/export function ThemeToggle[\s\S]*?return \(/) || [''])[0]
  : '';
const safeFromBody =
  themeToggleExists &&
  /'use client'/.test(themeToggle) &&
  /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?readInitialTheme\(\)/.test(themeToggle) &&
  !/localStorage\.getItem\(/.test(toggleBody) &&
  !/window\.matchMedia/.test(toggleBody);
check('ThemeToggle es SSR-safe (localStorage solo en useEffect)', safeFromBody);

// 8. 0 emojis hardcoded en el toggle; usa lucide-react Moon/Sun
check(
  'ThemeToggle usa lucide-react Moon/Sun (no emojis hardcoded)',
  themeToggleExists &&
    /from\s+['"]lucide-react['"]/.test(themeToggle) &&
    /\bMoon\b/.test(themeToggle) &&
    /\bSun\b/.test(themeToggle) &&
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(themeToggle),
);

console.log(`\n[QW-3] Result: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
