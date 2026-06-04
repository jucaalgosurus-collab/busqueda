#!/usr/bin/env node
/**
 * HJC Session Start Hook
 * Loads preserved state, relevant instincts, and verifies objective continuity.
 * Replaces ECC's regex-parsed session files with structured state.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'state', 'active-state.md');
const INSTINCTS_DIR = path.join(MEMORY_DIR, 'instincts');
const SESSIONS_DIR = path.join(MEMORY_DIR, 'sessions');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadActiveState() {
  ensureDir(path.join(MEMORY_DIR, 'state'));
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }
  try {
    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    if (!content || content.trim().length === 0) return null;

    // Parse structured state (not regex-dependent)
    const objective = extractSection(content, 'Objective');
    const currentSprint = extractSection(content, 'Current Sprint');
    const completedWork = extractSection(content, 'Completed Work');
    const decisions = extractSection(content, 'Decisions Made');
    const pendingWork = extractSection(content, 'Pending Work');
    const keyContext = extractSection(content, 'Key Context');

    return {
      objective,
      currentSprint,
      completedWork,
      decisions,
      pendingWork,
      keyContext,
      raw: content
    };
  } catch (e) {
    console.error('[HJC] Failed to load active state:', e.message);
    return null;
  }
}

function extractSection(content, sectionName) {
  const regex = new RegExp(`## ${sectionName}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function loadInstincts() {
  ensureDir(INSTINCTS_DIR);
  const instincts = [];

  try {
    const files = fs.readdirSync(INSTINCTS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(INSTINCTS_DIR, file), 'utf-8');
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter) continue;

        // Filter: confidence >= 0.5
        const confidence = parseFloat(frontmatter.confidence || '0.5');
        if (confidence < 0.5) continue;

        instincts.push({
          name: frontmatter.name || file.replace('.md', ''),
          confidence,
          scope: frontmatter.scope || 'global',
          trigger: frontmatter.trigger || '',
          file,
          summary: content.split('---')[2]?.trim().split(/\r?\n/)[0] || ''
        });
      } catch (e) {
        // Skip malformed instinct files
      }
    }
  } catch (e) {
    // Instincts directory doesn't exist yet
  }

  // Sort by confidence, take top 8
  instincts.sort((a, b) => b.confidence - a.confidence);
  return instincts.slice(0, 8);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  }
  return frontmatter;
}

function decayInstincts() {
  ensureDir(INSTINCTS_DIR);
  try {
    const files = fs.readdirSync(INSTINCTS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const filePath = path.join(INSTINCTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter) continue;

        let confidence = parseFloat(frontmatter.confidence || '0.7');
        const useCount = parseInt(frontmatter.use_count || '0');

        // Decay confidence
        confidence -= 0.05;
        const newUseCount = useCount; // Not used this session, so same count

        // Auto-prune if below threshold
        if (confidence < 0.3) {
          fs.unlinkSync(filePath);
          continue;
        }

        // Update frontmatter
        let newContent = content;
        newContent = newContent.replace(
          /confidence: [\d.]+/,
          `confidence: ${confidence.toFixed(2)}`
        );

        fs.writeFileSync(filePath, newContent, 'utf-8');
      } catch (e) {
        // Skip malformed files
      }
    }
  } catch (e) {
    // Directory doesn't exist yet
  }
}

// Main execution
try {
  // Ensure directories exist
  ensureDir(path.join(MEMORY_DIR, 'state'));
  ensureDir(path.join(MEMORY_DIR, 'instincts'));
  ensureDir(path.join(MEMORY_DIR, 'sessions'));
  ensureDir(path.join(MEMORY_DIR, 'contracts'));

  // Decay instincts from previous session
  decayInstincts();

  // Load state
  const state = loadActiveState();
  const instincts = loadInstincts();

  // Build context injection
  let contextInjection = '';

  if (state && state.objective) {
    contextInjection += `[HJC State] Resuming previous work:\n`;
    contextInjection += `- Objective: ${state.objective}\n`;
    if (state.currentSprint) {
      contextInjection += `- Current Sprint: ${state.currentSprint}\n`;
    }
    if (state.pendingWork) {
      contextInjection += `- Pending: ${state.pendingWork}\n`;
    }
    if (state.keyContext) {
      contextInjection += `- Context: ${state.keyContext}\n`;
    }
    contextInjection += '\n';
  }

  if (instincts.length > 0) {
    contextInjection += `[HJC Instincts] Learned patterns:\n`;
    for (const instinct of instincts) {
      contextInjection += `- ${instinct.name} (confidence: ${instinct.confidence.toFixed(2)}): ${instinct.summary}\n`;
    }
    contextInjection += '\n';
  }

  if (contextInjection) {
    const output = {
      hookSpecificOutput: {
        additionalContext: contextInjection
      }
    };
    process.stdout.write(JSON.stringify(output));
  }
} catch (e) {
  console.error('[HJC] Session start hook failed:', e.message);
  // Never block the session from starting
}