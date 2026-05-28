#!/usr/bin/env node
/**
 * HJC Instinct Engine
 * Manages instinct creation, confidence scoring, decay, conflict resolution, and auto-pruning.
 * Fixes ECC's manual-only instinct system by providing automatic evolution.
 */

const fs = require('fs');
const path = require('path');

const INSTINCTS_DIR = path.join(process.cwd(), 'memory', 'instincts');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  }
  return frontmatter;
}

function listInstincts() {
  ensureDir(INSTINCTS_DIR);
  const instincts = [];
  try {
    const files = fs.readdirSync(INSTINCTS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(INSTINCTS_DIR, file), 'utf-8');
        const frontmatter = parseFrontmatter(content);
        if (!frontmatter) continue;
        instincts.push({
          name: frontmatter.name || file.replace('.md', ''),
          confidence: parseFloat(frontmatter.confidence || '0.7'),
          scope: frontmatter.scope || 'global',
          trigger: frontmatter.trigger || '',
          useCount: parseInt(frontmatter.use_count || '0'),
          lastUsed: frontmatter.last_used || '',
          file
        });
      } catch (e) {
        // Skip malformed files
      }
    }
  } catch (e) {
    // Directory doesn't exist yet
  }
  return instincts;
}

function decayInstincts() {
  const instincts = listInstincts();
  let pruned = 0;
  let decayed = 0;

  for (const instinct of instincts) {
    const filePath = path.join(INSTINCTS_DIR, instinct.file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let newConfidence = instinct.confidence - 0.05;

      // Auto-prune below threshold
      if (newConfidence < 0.3) {
        fs.unlinkSync(filePath);
        pruned++;
        continue;
      }

      // Update confidence
      let updated = content.replace(
        /confidence: [\d.]+/,
        `confidence: ${newConfidence.toFixed(2)}`
      );

      fs.writeFileSync(filePath, updated, 'utf-8');
      decayed++;
    } catch (e) {
      // Skip files that can't be processed
    }
  }

  return { pruned, decayed };
}

function resolveConflicts() {
  const instincts = listInstincts();
  const conflicts = [];

  // Find instincts with overlapping triggers
  for (let i = 0; i < instincts.length; i++) {
    for (let j = i + 1; j < instincts.length; j++) {
      const a = instincts[i];
      const b = instincts[j];

      // Check if triggers overlap
      if (a.trigger && b.trigger && triggersOverlap(a.trigger, b.trigger)) {
        conflicts.push({ a, b });
      }
    }
  }

  // Resolve conflicts: higher confidence wins
  for (const conflict of conflicts) {
    const winner = conflict.a.confidence >= conflict.b.confidence ? conflict.a : conflict.b;
    const loser = conflict.a.confidence >= conflict.b.confidence ? conflict.b : conflict.a;

    // If tied confidence, prefer project-scoped
    if (conflict.a.confidence === conflict.b.confidence) {
      if (conflict.b.scope === 'project' && conflict.a.scope !== 'project') {
        // b wins
      }
      // otherwise a wins (arbitrary but consistent)
    }

    // Mark loser as superseded
    const loserPath = path.join(INSTINCTS_DIR, loser.file);
    try {
      const content = fs.readFileSync(loserPath, 'utf-8');
      if (!content.includes('superseded')) {
        const updated = content + '\n\n## Superseded By\n' + winner.name;
        fs.writeFileSync(loserPath, updated, 'utf-8');
      }
    } catch (e) {
      // Skip if file doesn't exist
    }
  }

  return conflicts;
}

function triggersOverlap(triggerA, triggerB) {
  // Simple overlap detection: check if one trigger contains keywords from the other
  const wordsA = triggerA.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordsB = triggerB.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const overlap = wordsA.filter(w => wordsB.includes(w));
  return overlap.length >= 2; // At least 2 shared significant words
}

function evolveInstincts() {
  const instincts = listInstincts();

  // Group instincts by theme (shared significant words in triggers)
  const themes = {};
  for (const instinct of instincts) {
    const words = instinct.trigger.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      if (!themes[word]) themes[word] = [];
      themes[word].push(instinct);
    }
  }

  // Find themes with 3+ instincts (candidates for evolution)
  const evolutionCandidates = Object.entries(themes)
    .filter(([_, instincts]) => instincts.length >= 3)
    .map(([theme, instincts]) => ({ theme, instincts }));

  const evolved = [];
  for (const candidate of evolutionCandidates) {
    // Create parent instinct that subsumes children
    const avgConfidence = candidate.instincts.reduce((sum, i) => sum + i.confidence, 0) / candidate.instincts.length;
    const parentName = `${candidate.theme}-pattern`;

    // Check if parent already exists
    const parentPath = path.join(INSTINCTS_DIR, `${parentName}.md`);
    if (fs.existsSync(parentPath)) continue;

    const content = `---
name: ${parentName}
confidence: ${avgConfidence.toFixed(2)}
scope: project
trigger: ${candidate.instincts.map(i => i.trigger).join(' OR ')}
created: ${new Date().toISOString().split('T')[0]}
last_used: ${new Date().toISOString().split('T')[0]}
use_count: 1
evolved_from: ${candidate.instincts.map(i => i.name).join(', ')}
---

Evolved pattern combining ${candidate.instincts.length} related instincts.

## When to Apply
When any of the following patterns are observed: ${candidate.instincts.map(i => i.trigger).join('; ')}.

## What to Do
Apply the most common behavior from the evolved instincts.
`;

    fs.writeFileSync(parentPath, content, 'utf-8');
    evolved.push(parentName);
  }

  return evolved;
}

// CLI
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'list') {
    const instincts = listInstincts();
    console.log(JSON.stringify(instincts, null, 2));
  } else if (command === 'decay') {
    const result = decayInstincts();
    console.log(`Decayed: ${result.decayed}, Pruned: ${result.pruned}`);
  } else if (command === 'conflicts') {
    const conflicts = resolveConflicts();
    console.log(`Found ${conflicts.length} conflicts`);
    for (const c of conflicts) {
      console.log(`  ${c.a.name} vs ${c.b.name}`);
    }
  } else if (command === 'evolve') {
    const evolved = evolveInstincts();
    console.log(`Evolved: ${evolved.length} new parent instincts`);
    for (const e of evolved) {
      console.log(`  - ${e}`);
    }
  }
}

module.exports = { listInstincts, decayInstincts, resolveConflicts, evolveInstincts };