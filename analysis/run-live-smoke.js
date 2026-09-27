require('dotenv').config();

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { parse } = require('csv-parse/sync');
const { extractBrands, norm } = require('../lib/brand-extractor');
const {
  buildGoogleGenerationConfig,
  googleThinkingConfig,
} = require('../lib/google-generation-config');

const ROOT = path.join(__dirname, '..');
const PROMPT_ID = process.env.PROMPT_ID || 'cd-1';
const MODEL_ID = process.env.MODEL_ID || '';
const TEMPERATURE = 0.7;
const MAX_OUTPUT_TOKENS = 800;
const runStamp = process.env.RUN_STAMP || new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(ROOT, 'data', 'runs', `live-smoke-${runStamp}`);

const PRICE_PER_MTOK = {
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
};

function loadCsv(filename) {
  return parse(fs.readFileSync(filename, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function classifyBrands(rawBrands, category, aliases) {
  const lookup = new Map();
  for (const row of aliases) {
    if (row.category !== category) continue;
    const key = norm(row.alias);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(row);
  }
  return rawBrands.map((rawBrand, index) => {
    const candidates = lookup.get(norm(rawBrand)) || [];
    const literal = String(rawBrand || '').trim().toLocaleLowerCase('en-US');
    const match = candidates.find(row => String(row.alias || '').trim().toLocaleLowerCase('en-US') === literal)
      || candidates.find(row => row.match_status === 'in_set_exact')
      || candidates[0];
    return {
      rank: index + 1,
      raw_brand: rawBrand,
      canonical_brand: match?.canonical_brand || '',
      brand_key: match?.brand_key || '',
      match_status: match?.match_status || 'out_of_set_candidate',
      excluded_reason: match?.excluded_reason || '',
    };
  });
}

async function callOpenAI(prompt, modelName) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: modelName,
    input: prompt,
    reasoning: { effort: 'low' },
    text: { verbosity: 'low' },
    max_output_tokens: MAX_OUTPUT_TOKENS,
  });
  const usage = response.usage || {};
  return {
    text: response.output_text || '',
    usage: {
      input_tokens: Number(usage.input_tokens || 0),
      visible_output_tokens: Number(usage.output_tokens || 0) - Number(usage.output_tokens_details?.reasoning_tokens || 0),
      reasoning_tokens: Number(usage.output_tokens_details?.reasoning_tokens || 0),
      billed_output_tokens: Number(usage.output_tokens || 0),
      total_tokens: Number(usage.total_tokens || 0),
    },
    provider_request_id: response.id || '',
    finish_reason: response.status === 'incomplete'
      ? (response.incomplete_details?.reason || 'incomplete')
      : response.status || '',
  };
}

async function callAnthropic(prompt, modelName) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const options = {
    model: modelName,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  };
  if (!modelName.includes('opus-4-7')) options.temperature = TEMPERATURE;
  const response = await client.messages.create(options);
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
  const usage = response.usage || {};
  return {
    text,
    usage: {
      input_tokens: Number(usage.input_tokens || 0),
      visible_output_tokens: Number(usage.output_tokens || 0),
      reasoning_tokens: 0,
      billed_output_tokens: Number(usage.output_tokens || 0),
      total_tokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0),
    },
    provider_request_id: response.id || '',
    finish_reason: response.stop_reason || '',
  };
}

async function callGoogle(prompt, modelName) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const thinkingConfig = googleThinkingConfig(modelName);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: buildGoogleGenerationConfig(
      modelName,
      TEMPERATURE,
      MAX_OUTPUT_TOKENS,
      { brandListMode: true },
    ),
  });
  const result = await model.generateContent(prompt);
  const response = result.response;
  const usage = response.usageMetadata || {};
  const visible = Number(usage.candidatesTokenCount || 0);
  const reasoning = Number(usage.thoughtsTokenCount || 0);
  return {
    text: response.text(),
    usage: {
      input_tokens: Number(usage.promptTokenCount || 0),
      visible_output_tokens: visible,
      reasoning_tokens: reasoning,
      billed_output_tokens: visible + reasoning,
      total_tokens: Number(usage.totalTokenCount || 0),
    },
    provider_request_id: response.responseId || '',
    finish_reason: response.candidates?.[0]?.finishReason || '',
    thinking_config: thinkingConfig || null,
  };
}

async function callModel(model, prompt) {
  if (model.provider === 'openai') return callOpenAI(prompt, model.model_name);
  if (model.provider === 'anthropic') return callAnthropic(prompt, model.model_name);
  if (model.provider === 'google') return callGoogle(prompt, model.model_name);
  throw new Error(`Unsupported provider: ${model.provider}`);
}

function estimatedCost(modelId, usage) {
  const price = PRICE_PER_MTOK[modelId];
  if (!price) return null;
  return (
    usage.input_tokens * price.input / 1_000_000 +
    usage.billed_output_tokens * price.output / 1_000_000
  );
}

async function main() {
  for (const envName of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']) {
    if (!process.env[envName]) throw new Error(`${envName} is missing.`);
  }

  const prompts = loadCsv(path.join(ROOT, 'config', 'positioning_prompts.csv'));
  const aliases = loadCsv(path.join(ROOT, 'config', 'brand_aliases_initial.csv'));
  const configuredModels = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'models.json'), 'utf8')).models;
  const models = MODEL_ID
    ? configuredModels.filter(model => model.model_id === MODEL_ID)
    : configuredModels;
  if (models.length === 0) throw new Error(`Model not found: ${MODEL_ID}`);
  const promptRow = prompts.find(row => row.prompt_id === PROMPT_ID);
  if (!promptRow) throw new Error(`Prompt not found: ${PROMPT_ID}`);

  fs.mkdirSync(outputDir, { recursive: true });
  const results = [];
  for (const model of models) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    process.stdout.write(`[live] ${model.model_id} ... `);
    try {
      const response = await callModel(model, promptRow.prompt);
      if (!response.text.trim()) throw new Error('Empty model response');
      const rawBrands = extractBrands(response.text);
      const classifiedBrands = classifyBrands(rawBrands, promptRow.category, aliases);
      const cost = estimatedCost(model.model_id, response.usage);
      const finishReason = String(response.finish_reason || '');
      const wasTruncated = /max[_\s-]?tokens|length|incomplete/i.test(finishReason);
      const row = {
        status: wasTruncated
          ? 'truncated'
          : (classifiedBrands.length > 0 ? 'completed' : 'parse_failed'),
        provider: model.provider,
        model_id: model.model_id,
        model_name: model.model_name,
        prompt_id: promptRow.prompt_id,
        category: promptRow.category,
        prompt: promptRow.prompt,
        response_text: response.text,
        brands: classifiedBrands,
        usage: response.usage,
        estimated_cost_usd: cost,
        provider_request_id: response.provider_request_id,
        finish_reason: finishReason,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedMs,
        temperature: model.provider === 'openai' ? null : (model.model_id === 'claude-opus-4-7' ? null : TEMPERATURE),
        reasoning_effort: model.provider === 'openai' ? 'low' : '',
        thinking_config: response.thinking_config || null,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        web_search: false,
      };
      results.push(row);
      process.stdout.write(`${row.status}; ${response.usage.input_tokens} in / ${response.usage.billed_output_tokens} out; $${cost.toFixed(6)}\n`);
    } catch (error) {
      results.push({
        status: 'error',
        provider: model.provider,
        model_id: model.model_id,
        model_name: model.model_name,
        prompt_id: promptRow.prompt_id,
        category: promptRow.category,
        prompt: promptRow.prompt,
        error: error.message,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedMs,
      });
      process.stdout.write(`ERROR: ${error.message}\n`);
    }
    fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  }

  const summary = {
    run_type: 'paid_live_smoke_test',
    prompt_id: promptRow.prompt_id,
    calls_attempted: results.length,
    calls_completed: results.filter(row => row.status === 'completed').length,
    truncated: results.filter(row => row.status === 'truncated').length,
    parse_failures: results.filter(row => row.status === 'parse_failed').length,
    errors: results.filter(row => row.status === 'error').length,
    total_input_tokens: results.reduce((sum, row) => sum + Number(row.usage?.input_tokens || 0), 0),
    total_billed_output_tokens: results.reduce((sum, row) => sum + Number(row.usage?.billed_output_tokens || 0), 0),
    total_estimated_cost_usd: results.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0),
    output_dir: outputDir,
  };
  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.calls_completed !== models.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  callModel,
  classifyBrands,
  estimatedCost,
};
