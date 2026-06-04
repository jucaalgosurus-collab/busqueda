#!/usr/bin/env node
/**
 * HJC Session End Hook
 * Saves state, updates instincts, archives session.
 * Fixes ECC's disconnected storage by writing to a single structured state file.
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

function saveActiveState(state) {
  ensureDir(path.join(MEMORY_DIR, 'state'));

  const content = `# Active State

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
`;

  fs.writeFileSync(STATE_FILE, content, 'utf-8');

  // Verify write was successful
  const verified = fs.readFileSync(STATE_FILE, 'utf-8');
  if (!verified || verified.trim().length === 0) {
    throw new Error('State file verification failed: file is empty');
  }
}

function archiveSession(state) {
  ensureDir(SESSIONS_DIR);
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveFile = path.join(SESSIONS_DIR, `${date}-${timestamp}.md`);

  const content = `# Session Archive: ${date}

## Objective
${state.objective || 'No objective recorded'}

## Completed Work
${state.completedWork || 'None recorded'}

## Decisions Made
${state.decisions || 'None recorded'}

## Key Context
${state.keyContext || 'None recorded'}

## Session End
${new Date().toISOString()}
`;

  fs.writeFileSync(archiveFile, content, 'utf-8');
}

function updateInstincts(patterns) {
  ensureDir(INSTINCTS_DIR);

  for (const pattern of patterns) {
    const instinctFile = path.join(INSTINCTS_DIR, `${pattern.name}.md`);

    if (fs.existsSync(instinctFile)) {
      // Update existing instinct: increase confidence
      const content = fs.readFileSync(instinctFile, 'utf-8');
      let confidence = parseFloat(content.match(/confidence: ([\d.]+)/)?.[1] || '0.7');
      confidence = Math.min(0.95, confidence + 0.03);

      let newContent = content;
      newContent = newContent.replace(
        /confidence: [\d.]+/,
        `confidence: ${confidence.toFixed(2)}`
      );
      newContent = newContent.replace(
        /last_used: .*/,
        `last_used: ${new Date().toISOString().split('T')[0]}`
      );
      const useCountMatch = newContent.match(/use_count: (\d+)/);
      if (useCountMatch) {
        newContent = newContent.replace(
          /use_count: \d+/,
          `use_count: ${parseInt(useCountMatch[1]) + 1}`
        );
      }

      fs.writeFileSync(instinctFile, newContent, 'utf-8');
    } else {
      // Create new instinct
      const content = `---
name: ${pattern.name}
confidence: 0.7
scope: ${pattern.scope || 'project'}
trigger: ${pattern.trigger || 'auto-detected pattern'}
created: ${new Date().toISOString().split('T')[0]}
last_used: ${new Date().toISOString().split('T')[0]}
use_count: 1
---

${pattern.description || 'Auto-detected pattern.'}

## When to Apply
${pattern.when || 'When this pattern is observed again.'}

## What to Do
${pattern.action || 'Apply the learned behavior.'}
`;
      fs.writeFileSync(instinctFile, content, 'utf-8');
    }
  }
}

// Main execution
try {
  // Read session transcript from stdin (Claude Code provides this)
  let transcript = '';
  try {
    transcript = fs.readFileSync(0, 'utf-8');
  } catch (e) {
    // No stdin, that's okay
  }

  // Extract state information from the session
  const state = {
    objective: '',
    currentSprint: '',
    completedWork: '',
    decisions: '',
    pendingWork: '',
    keyContext: ''
  };

  // Try to parse existing state file for continuity
  if (fs.existsSync(STATE_FILE)) {
    const existing = fs.readFileSync(STATE_FILE, 'utf-8');
    const extractSection = (content, name) => {
      const regex = new RegExp(`## ${name}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`, 'm');
      const match = content.match(regex);
      return match ? match[1].trim() : '';
    };
    state.objective = extractSection(existing, 'Objective');
    state.decisions = extractSection(existing, 'Decisions Made');
    state.completedWork = extractSection(existing, 'Completed Work');
  }

  // Update state
  state.currentSprint = '- Status: completed';
  state.pendingWork = '- Session ended, state preserved for next session';

  // Save state
  saveActiveState(state);

  // Archive session
  archiveSession(state);

  // Prune old sessions (keep last 30 days)
  ensureDir(SESSIONS_DIR);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const sessions = fs.readdirSync(SESSIONS_DIR);
    for (const file of sessions) {
      const filePath = path.join(SESSIONS_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtime < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }

} catch (e) {
  console.error('[HJC] Session end hook failed:', e.message);
  // Never block the session from ending
}