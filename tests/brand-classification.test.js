const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const { classifyBrands } = require('../analysis/run-live-smoke');

const aliases = parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'brand_aliases_initial.csv'), 'utf8'),
  { columns: true, skip_empty_lines: true, trim: true },
);

test('evaluation classification preserves raw names and distinguishes exact names from aliases', () => {
  const results = classifyBrands(['Black+Decker', 'Black & Decker'], 'Cordless Drill', aliases);
  assert.deepEqual(results.map(row => row.raw_brand), ['Black+Decker', 'Black & Decker']);
  assert.deepEqual(results.map(row => row.canonical_brand), ['Black+Decker', 'Black+Decker']);
  assert.deepEqual(results.map(row => row.match_status), ['in_set_exact', 'in_set_alias']);
});

test('evaluation classification keeps rated Purina subbrands separate and labels bare Purina consistently', () => {
  const results = classifyBrands(
    ['Purina', 'Purina ONE Healthy Kitten Food', 'Purina Pro Plan Veterinary Diets', 'Purina Cat Chow Naturals'],
    'Cat Food',
    aliases,
  );
  assert.deepEqual(results.map(row => row.brand_key), ['CF8', 'CF27', 'CF28', 'CF16']);
  assert.equal(results[0].canonical_brand, 'Purina');
  assert.equal(results[0].match_status, 'in_set_alias');
});

test('evaluation classification consolidates confirmed out-of-set variants without assigning ratings', () => {
  const results = classifyBrands(
    ['Rayne Clinical Nutrition', 'Rayne Nutrition', 'Fjallraven'],
    'Cat Food',
    aliases,
  );
  assert.equal(results[0].canonical_brand, 'Rayne Clinical Nutrition');
  assert.equal(results[1].canonical_brand, 'Rayne Clinical Nutrition');
  assert.equal(results[0].brand_key, '');
  assert.equal(results[0].match_status, 'out_of_set_candidate');
  assert.equal(results[2].canonical_brand, '');
});

test('evaluation classification flags parser noise and compound ranks without deleting them', () => {
  const noise = classifyBrands(['Moka Pot'], 'Coffee Maker', aliases)[0];
  const compound = classifyBrands(['Black+Decker or Craftsman'], 'Cordless Drill', aliases)[0];
  assert.equal(noise.raw_brand, 'Moka Pot');
  assert.equal(noise.match_status, 'excluded_non_brand');
  assert.equal(compound.raw_brand, 'Black+Decker or Craftsman');
  assert.equal(compound.match_status, 'ambiguous_compound');
});
