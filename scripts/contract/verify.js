#!/usr/bin/env node
/**
 * HJC Contract Verifier
 * Verifies sprint contracts before and after execution.
 * This is the enforcement layer that ensures the evaluator's hard thresholds are met.
 */

const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.join(process.cwd(), 'memory', 'contracts');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createContract(contract) {
  ensureDir(CONTRACTS_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const contractFile = path.join(CONTRACTS_DIR, `sprint-${contract.sprintNumber || timestamp}.md`);

  const content = `# Sprint Contract: ${contract.name}

## Objective
${contract.objective}

## Success Criteria
${contract.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Scope Exclusions
${contract.exclusions ? contract.exclusions.map(e => `- ${e}`).join('\n') : '- None specified'}

## Agent Assignment
- Generator: ${contract.generator || 'generator'}
- Evaluator: evaluator

## Budget
- Estimated tokens: ${contract.estimatedTokens || 'TBD'}
- Max retries: 3

## Context
- Previous sprint: ${contract.previousSprint || 'None'}
- Key decisions: ${contract.keyDecisions || 'None'}

## Status
- Created: ${new Date().toISOString()}
- Status: pending
- Evaluation result: pending
`;

  fs.writeFileSync(contractFile, content, 'utf-8');
  return contractFile;
}

function evaluateContract(contractFile, results) {
  const content = fs.readFileSync(contractFile, 'utf-8');

  // Extract criteria from contract
  const criteriaMatch = content.match(/## Success Criteria\n([\s\S]*?)(?=\n## )/);
  if (!criteriaMatch) {
    return { pass: false, reason: 'No success criteria found in contract' };
  }

  const criteria = criteriaMatch[1].trim().split('\n').filter(l => l.trim());
  let allPass = true;
  const details = [];

  for (let i = 0; i < criteria.length; i++) {
    const result = results[i] || { pass: false, evidence: 'No result provided' };
    details.push({
      criterion: criteria[i],
      pass: result.pass,
      evidence: result.evidence
    });
    if (!result.pass) allPass = false;
  }

  // Update contract file with results
  let updated = content;
  updated = updated.replace(/Status: pending/, `Status: ${allPass ? 'PASSED' : 'FAILED'}`);
  updated = updated.replace(/Evaluation result: pending/, `Evaluation result: ${allPass ? 'PASS' : 'FAIL'}`);
  fs.writeFileSync(contractFile, updated, 'utf-8');

  return {
    pass: allPass,
    details,
    contractFile
  };
}

// Export for use by other scripts
module.exports = { createContract, evaluateContract };

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'create') {
    // Create a contract from command line arguments
    const contract = {
      name: process.argv[3] || 'Unnamed Sprint',
      objective: process.argv[4] || '',
      criteria: (process.argv[5] || '').split('|'),
      sprintNumber: process.argv[6] || Date.now()
    };
    const file = createContract(contract);
    console.log(`Contract created: ${file}`);
  } else if (command === 'list') {
    ensureDir(CONTRACTS_DIR);
    const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} contracts:`);
    for (const file of files) {
      const content = fs.readFileSync(path.join(CONTRACTS_DIR, file), 'utf-8');
      const status = content.match(/Status: (\w+)/)?.[1] || 'unknown';
      const name = content.match(/# Sprint Contract: (.+)/)?.[1] || file;
      console.log(`  - ${name}: ${status}`);
    }
  }
}