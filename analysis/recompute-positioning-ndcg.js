const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'data', 'processed', 'positioning_recommendations_and_ndcg.csv');
const RATINGS = path.join(ROOT, 'data', 'processed', 'brand_positioning_scores.csv');
const FINAL_SET = path.join(ROOT, 'data', 'processed', 'final_evaluation_set.csv');
const MAPPING = path.join(ROOT, 'config', 'composite_positioning_mapping.csv');
const OUTPUT_DIR = path.join(ROOT, 'data', 'derived', 'positioning');

function readCsv(filename) {
  return parse(fs.readFileSync(filename, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function number(value) {
  if (value === '' || value == null || String(value).toUpperCase() === 'NA') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function meanRequired(values) {
  return values.every(Number.isFinite)
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function score(row, dimension) {
  const n = field => number(row[field]);
  if (dimension === 'User orientation') return n('DrillDIY_pro');
  if (dimension === 'Cruise positioning') {
    return meanRequired([6 - n('VesselBig'), n('Service'), n('Conventional_Expedition'), n('Family_AdultOnly')]);
  }
  if (dimension === 'Cat food tier') return meanRequired([n('Science_Natural'), n('Trad_UltPrem')]);
  if (dimension === 'Veterinary to general') return n('Vet_General');
  if (dimension === 'Jacket tier') return meanRequired([n('Technical'), 6 - n('Urban'), n('Value')]);
  if (dimension === 'Sustainability') return n('Sustainability');
  if (dimension === 'Barista involvement') return meanRequired([n('Auto_Manual'), 6 - n('Convenience')]);
  if (dimension === 'Brew focus') return n('Drip_Espresso');
  throw new Error(`Unknown dimension: ${dimension}`);
}

function directional(value, endpoint) {
  return endpoint === 'high' ? value : 6 - value;
}

function dcg(values) {
  return values.reduce((sum, value, index) => sum + value / Math.log2(index + 2), 0);
}

const input = readCsv(INPUT);
const ratingRows = readCsv(RATINGS);
const finalRows = readCsv(FINAL_SET).filter(row => row.Key && row.Category);
const mappingRows = readCsv(MAPPING);
const ratingByKey = new Map(ratingRows.map(row => [row.Key, row]));
const finalByCategory = new Map();
for (const row of finalRows) {
  if (!finalByCategory.has(row.Category)) finalByCategory.set(row.Category, []);
  finalByCategory.get(row.Category).push(row);
}
const mappingByPrompt = new Map(mappingRows.map(row => [row.prompt_id, row]));

assert.equal(input.length, 11520, 'Expected 11,520 positioning rows.');
assert.equal(mappingByPrompt.size, 48, 'Expected 48 prompt mappings.');
assert.equal(new Set(input.map(row => row.model)).size, 6, 'Expected six models.');

let maxDifference = 0;
const recomputed = input.map(row => {
  const mapping = mappingByPrompt.get(row.prompt_id);
  assert(mapping, `Missing prompt mapping: ${row.prompt_id}`);
  assert.equal(mapping.category, row.category, `Category mismatch for ${row.prompt_id}`);
  assert.equal(mapping.position_dimension, row.position_dimension, `Dimension mismatch for ${row.prompt_id}`);
  assert.equal(mapping.target_endpoint, row.target_endpoint, `Endpoint mismatch for ${row.prompt_id}`);

  const ideal = (finalByCategory.get(row.category) || [])
    .map(brand => ratingByKey.get(brand.Key))
    .filter(Boolean)
    .map(rating => score(rating, row.position_dimension))
    .filter(Number.isFinite)
    .map(value => directional(value, row.target_endpoint))
    .sort((a, b) => b - a)
    .slice(0, 5);
  assert.equal(ideal.length, 5, `Not enough ideal brands for ${row.prompt_id}.`);

  const seen = new Set();
  const relevance = [];
  for (let rank = 1; rank <= 5; rank += 1) {
    const key = row[`brand_key_${rank}`];
    let value = 0;
    if (key && !seen.has(key) && ratingByKey.has(key)) {
      seen.add(key);
      const sourceScore = score(ratingByKey.get(key), row.position_dimension);
      if (Number.isFinite(sourceScore)) value = directional(sourceScore, row.target_endpoint);
    }
    relevance.push(value);
    maxDifference = Math.max(maxDifference, Math.abs(value - Number(row[`relevance_${rank}`])));
  }
  const calculatedDcg = dcg(relevance);
  const calculatedIdcg = dcg(ideal);
  const calculatedNdcg = calculatedDcg / calculatedIdcg;
  maxDifference = Math.max(
    maxDifference,
    Math.abs(calculatedDcg - Number(row.dcg_at_5)),
    Math.abs(calculatedIdcg - Number(row.idcg_at_5)),
    Math.abs(calculatedNdcg - Number(row.ndcg_at_5)),
  );
  return {
    model: row.model,
    category: row.category,
    prompt_id: row.prompt_id,
    replicate: Number(row.replicate),
    position_dimension: row.position_dimension,
    target_endpoint: row.target_endpoint,
    ndcg_at_5: calculatedNdcg,
  };
});

assert(maxDifference < 1e-10, `Stored and recomputed NDCG differ by ${maxDifference}.`);

const groups = new Map();
for (const row of recomputed) {
  const key = [row.model, row.category, row.position_dimension, row.target_endpoint].join('\u001f');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row.ndcg_at_5);
}
const summary = [...groups.entries()].map(([key, values]) => {
  const [model, category, position_dimension, target_endpoint] = key.split('\u001f');
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1);
  return {
    model,
    category,
    position_dimension,
    target_endpoint,
    runs: values.length,
    mean_ndcg_at_5: average,
    sd_ndcg_at_5: Math.sqrt(variance),
  };
}).sort((a, b) => (
  a.position_dimension.localeCompare(b.position_dimension)
  || a.target_endpoint.localeCompare(b.target_endpoint)
  || a.model.localeCompare(b.model)
));

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'ndcg_by_run.csv'), stringify(recomputed, { header: true }));
fs.writeFileSync(path.join(OUTPUT_DIR, 'ndcg_summary.csv'), stringify(summary, { header: true }));

console.log(JSON.stringify({
  rows: recomputed.length,
  prompts: mappingByPrompt.size,
  final_evaluation_set_brands: finalRows.length,
  summary_cells: summary.length,
  maximum_recomputation_difference: maxDifference,
}, null, 2));
