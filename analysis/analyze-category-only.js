const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const ROOT = path.join(__dirname, '..');
const RAW_FILE = path.join(ROOT, 'data', 'raw', 'category-only', 'responses.jsonl');
const SET_FILE = path.join(ROOT, 'data', 'processed', 'final_evaluation_set.csv');
const LEGACY_FILE = path.join(ROOT, 'data', 'marketplace', 'brand_metrics_legacy.csv');
const OUTPUT_DIR = path.join(ROOT, 'data', 'derived', 'category-only');

function readCsv(filename) {
  return parse(fs.readFileSync(filename, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function readJsonl(filename) {
  return fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function writeCsv(filename, rows, columns) {
  fs.writeFileSync(filename, stringify(rows, { header: true, columns }));
}

const rows = readJsonl(RAW_FILE);
const brands = readCsv(SET_FILE).filter(row => row.Key && row.Brand && row.Category);
const latest = new Map(rows.map(row => [row.task_key, row]));
const responses = [...latest.values()].filter(row => row.status === 'completed');

assert.equal(responses.length, 1200, 'Expected 1,200 completed category-only responses.');
assert.equal(new Set(responses.map(row => row.model_id)).size, 6, 'Expected six models.');
assert.equal(new Set(responses.map(row => row.category)).size, 5, 'Expected five categories.');

const metrics = [];
for (const brand of brands) {
  const categoryRows = responses.filter(row => row.category === brand.Category);
  assert.equal(categoryRows.length, 240, `Expected 240 responses for ${brand.Category}.`);
  const ranks = categoryRows.map(row => {
    const hit = (row.brands || []).find(item => item.brand_key === brand.Key);
    return hit ? Number(hit.rank) : 0;
  });
  metrics.push({
    brand_key: brand.Key,
    category: brand.Category,
    brand: brand.Brand,
    responses: ranks.length,
    brp_at_1: ranks.filter(rank => rank === 1).length / ranks.length,
    brp_at_3: ranks.filter(rank => rank > 0 && rank <= 3).length / ranks.length,
    brp_at_5: ranks.filter(rank => rank > 0 && rank <= 5).length / ranks.length,
    mrr_at_5: ranks.reduce((sum, rank) => sum + (rank > 0 && rank <= 5 ? 1 / rank : 0), 0) / ranks.length,
  });
}

const byKey = new Map(metrics.map(row => [row.brand_key, row]));
assert.equal(byKey.get('CD3').brp_at_5, 0, 'Craftsman BRP@5 should be zero.');
assert(Math.abs(byKey.get('CD1').brp_at_5 - 19 / 240) < 1e-12, 'Black+Decker BRP@5 should be 19/240.');
assert.equal(byKey.get('HJ16').brp_at_5, 0, 'L.L.Bean BRP@5 should be zero.');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
writeCsv(
  path.join(OUTPUT_DIR, 'brand_metrics.csv'),
  metrics,
  ['brand_key', 'category', 'brand', 'responses', 'brp_at_1', 'brp_at_3', 'brp_at_5', 'mrr_at_5'],
);

const legacy = readCsv(LEGACY_FILE);
const currentMarketplace = legacy.map(row => {
  const metric = byKey.get(row.Key);
  if (!metric || !row.Category || row.Category === 'NA') return row;
  return {
    ...row,
    BRP1: metric.brp_at_1,
    BRP3: metric.brp_at_3,
    BRP5: metric.brp_at_5,
    MRR: metric.mrr_at_5,
  };
});
writeCsv(
  path.join(ROOT, 'data', 'marketplace', 'brand_metrics_current.csv'),
  currentMarketplace,
  Object.keys(legacy[0]),
);

const changed = legacy.filter(row => {
  const metric = byKey.get(row.Key);
  return metric && Math.abs(Number(row.BRP5) - metric.brp_at_5) > 1e-12;
}).length;

console.log(JSON.stringify({
  responses: responses.length,
  brands_in_final_evaluation_set: metrics.length,
  marketplace_rows_with_changed_brp_at_5: changed,
  checks: {
    craftsman_brp_at_5: byKey.get('CD3').brp_at_5,
    black_and_decker_brp_at_5: byKey.get('CD1').brp_at_5,
    ll_bean_brp_at_5: byKey.get('HJ16').brp_at_5,
  },
}, null, 2));
