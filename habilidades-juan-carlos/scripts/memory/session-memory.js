#!/usr/bin/env node
/**
 * HJC Session Memory — Chat Memory System
 *
 * When a new chat starts, this script:
 * 1. Loads the active state from memory/state/active-state.md
 * 2. Scans memory/sessions/ for recent sessions
 * 3. Builds a context summary from previous sessions
 * 4. Injects relevant past context into the new session
 *
 * When the user says "te acuerdas de..." or "ayer estábamos trabajando en...":
 * This system searches session files for matches and restores context.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'state', 'active-state.md');
const SESSIONS_DIR = path.join(MEMORY_DIR, 'sessions');
const INSTINCTS_DIR = path.join(MEMORY_DIR, 'instincts');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Search previous sessions for a keyword or topic
 * Used when the user says "te acuerdas de X" or "ayer hicimos Y"
 */
function searchSessions(query) {
  ensureDir(SESSIONS_DIR);

  const results = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse(); // Most recent first

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');

        // Calculate relevance score
        let score = 0;
        const contentLower = content.toLowerCase();

        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            score += 1;
          }
        }

        if (score > 0) {
          // Extract key sections
          const objective = extractSection(content, 'Objective');
          const completed = extractSection(content, 'Completed Work');
          const pending = extractSection(content, 'Pending Work');
          const decisions = extractSection(content, 'Decisions Made');
          const filesModified = extractSection(content, 'Files Modified');

          results.push({
            file,
            date: file.split('-').slice(0, 3).join('-'),
            score,
            objective: objective || 'No objective recorded',
            completed: completed || 'None recorded',
            pending: pending || 'None remaining',
            decisions: decisions || 'None recorded',
            filesModified: filesModified || 'None recorded',
          });
        }
      } catch (e) {
        // Skip malformed files
      }
    }
  } catch (e) {
    // Sessions directory doesn't exist yet
  }

  // Sort by relevance score, then by date (most recent first)
  results.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));

  return results.slice(0, 5); // Return top 5 most relevant
}

/**
 * Save current session state to a session file
 * Called at session end and periodically during the session
 */
function saveSession(state) {
  ensureDir(SESSIONS_DIR);

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');

  // Create a slug from the objective
  const slug = (state.objective || 'session')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const filename = `${date}-${time}-${slug}.md`;
  const filepath = path.join(SESSIONS_DIR, filename);

  const content = `# Session: ${date} ${time}

## Objective
${state.objective || 'No objective recorded'}

## Completed Work
${state.completedWork || 'None recorded'}

## Pending Work
${state.pendingWork || 'None remaining'}

## Decisions Made
${state.decisions || 'None recorded'}

## Files Modified
${state.filesModified || 'None recorded'}

## Key Context
${state.keyContext || 'None recorded'}

## Session End
${now.toISOString()}
`;

  fs.writeFileSync(filepath, content, 'utf-8');

  // Also update the active state file
  ensureDir(path.join(MEMORY_DIR, 'state'));
  const activeContent = `# Active State

## Objective
${state.objective || 'No active objective'}

## Current Sprint
${state.currentSprint || '- Status: completed'}

## Completed Work
${state.completedWork || '- None recorded'}

## Decisions Made
${state.decisions || '- None recorded'}

## Pending Work
${state.pendingWork || '- None remaining'}

## Key Context
${state.keyContext || '- None recorded'}

## Last Session
${filename}
`;

  fs.writeFileSync(STATE_FILE, activeContent, 'utf-8');

  return filename;
}

/**
 * Load the most recent sessions for context restoration
 * Called at session start to provide continuity
 */
function loadRecentSessions(count = 3) {
  ensureDir(SESSIONS_DIR);

  const sessions = [];

  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, count);

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
        sessions.push({
          file,
          objective: extractSection(content, 'Objective') || 'No objective',
          completed: extractSection(content, 'Completed Work') || 'None',
          pending: extractSection(content, 'Pending Work') || 'None',
          date: file.split('-').slice(0, 3).join('-'),
        });
      } catch (e) {
        // Skip malformed
      }
    }
  } catch (e) {
    // No sessions yet
  }

  return sessions;
}

/**
 * Prune old sessions (keep last 90 days)
 */
function pruneOldSessions() {
  ensureDir(SESSIONS_DIR);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filepath = path.join(SESSIONS_DIR, file);
      try {
        const stat = fs.statSync(filepath);
        if (stat.mtime < ninetyDaysAgo) {
          fs.unlinkSync(filepath);
        }
      } catch (e) {
        // Skip
      }
    }
  } catch (e) {
    // Ignore
  }
}

function extractSection(content, sectionName) {
  const regex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'search') {
    const query = process.argv.slice(3).join(' ');
    const results = searchSessions(query);
    console.log(JSON.stringify(results, null, 2));
  } else if (command === 'save') {
    const objective = process.argv[3] || 'Session';
    const state = {
      objective,
      completedWork: process.argv[4] || '',
      pendingWork: process.argv[5] || '',
      decisions: process.argv[6] || '',
      filesModified: process.argv[7] || '',
      keyContext: process.argv[8] || '',
    };
    const filename = saveSession(state);
    console.log(`Session saved: ${filename}`);
  } else if (command === 'recent') {
    const count = parseInt(process.argv[3]) || 3;
    const sessions = loadRecentSessions(count);
    console.log(JSON.stringify(sessions, null, 2));
  } else if (command === 'prune') {
    pruneOldSessions();
    console.log('Old sessions pruned');
  } else {
    console.log('Usage: node session-memory.js <search|save|recent|prune> [args]');
    console.log('  search <query>  - Search previous sessions for a topic');
    console.log('  save <objective> [completed] [pending] [decisions] [files] [context]');
    console.log('  recent [count]   - Load recent sessions (default: 3)');
    console.log('  prune            - Remove sessions older than 90 days');
  }
}

module.exports = { searchSessions, saveSession, loadRecentSessions, pruneOldSessions };