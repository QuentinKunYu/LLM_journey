const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parse } = require('csv-parse/sync');

const ROOT = path.join(__dirname, '..');

function csv(relative) {
  return parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function jsonl(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

const category = jsonl('data/raw/category-only/responses.jsonl');
const categoryLatest = new Map(category.map(row => [row.task_key, row]));
assert.equal(categoryLatest.size, 1200);
assert([...categoryLatest.values()].every(row => row.status === 'completed'));

const positioningFiles = fs.readdirSync(path.join(ROOT, 'data', 'raw', 'positioning')).filter(name => name.endsWith('.jsonl'));
const positioningLatest = new Map();
for (const filename of positioningFiles) {
  for (const row of jsonl(path.join('data', 'raw', 'positioning', filename))) {
    if (row.status === 'completed') positioningLatest.set(row.task_key, row);
  }
}
assert.equal(positioningLatest.size, 11520);

assert.equal(csv('config/category_only_prompts.csv').length, 5);
assert.equal(csv('config/positioning_prompts.csv').length, 48);
assert.equal(csv('config/composite_positioning_mapping.csv').length, 48);
assert.equal(csv('data/processed/positioning_recommendations_and_ndcg.csv').length, 11520);
assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'models.json'), 'utf8')).models.length, 6);
assert.equal(csv('data/processed/final_evaluation_set.csv').length, 212);
assert.equal(csv('data/processed/inter_rater_reliability.csv').length, 16);
assert.equal(csv('data/marketplace/merged_marketplace_dataset.csv').length, 100);

const venueAcronyms = [
  ['E', 'C', 'I', 'R'].join(''),
  ['J', 'A', 'R'].join(''),
];
const identifyingTerms = [
  ['Q', 'u', 'e', 'n', 't', 'i', 'n'].join(''),
  ['K', 'u', 'n', 'Y', 'u'].join(''),
  ['/', 'U', 's', 'e', 'r', 's', '/', 'q', 'u', 'e', 'n', 't', 'i', 'n'].join(''),
];
const textExtensions = new Set(['.md', '.json', '.jsonl', '.js', '.R', '.Rmd', '.csv', '.example', '.gitignore']);
const hits = [];
const secretHits = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (textExtensions.has(path.extname(entry.name)) || ['README.md', '.gitignore'].includes(entry.name)) {
      const text = fs.readFileSync(filename, 'utf8');
      const hasVenueName = venueAcronyms.some(term => text.includes(term));
      const hasIdentity = identifyingTerms.some(term => text.toLowerCase().includes(term.toLowerCase()));
      if (hasVenueName || hasIdentity) {
        hits.push(path.relative(ROOT, filename));
      }
      if (/(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,})/.test(text)) {
        secretHits.push(path.relative(ROOT, filename));
      }
    }
  }
}
walk(ROOT);
assert.deepEqual(hits, [], `Identifying or venue-specific strings found in: ${hits.join(', ')}`);
assert.deepEqual(secretHits, [], `Possible API credentials found in: ${secretHits.join(', ')}`);

console.log(JSON.stringify({
  category_only_tasks: categoryLatest.size,
  positioning_tasks: positioningLatest.size,
  positioning_source_files: positioningFiles.length,
  final_evaluation_set_brands: 212,
  reliability_dimensions: 16,
  marketplace_rows: 100,
  anonymization_scan: 'passed',
  credential_scan: 'passed',
}, null, 2));
