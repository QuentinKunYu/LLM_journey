require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { extractBrands } = require('../lib/brand-extractor');
const {
  callModel,
  classifyBrands,
  estimatedCost,
} = require('./run-live-smoke');

const ROOT = path.join(__dirname, '..');
const PROMPTS_FILE = path.resolve(ROOT, process.env.PROMPTS_FILE || 'config/positioning_prompts.csv');
const EXPECTED_PROMPT_COUNT = Number(process.env.EXPECTED_PROMPT_COUNT || 48);
const RUN_LABEL = process.env.RUN_LABEL || 'full';
const RUN_STAMP = process.env.RUN_STAMP || new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = process.env.RUN_DIR
  ? path.resolve(process.env.RUN_DIR)
  : path.join(ROOT, 'data', 'runs', `${RUN_LABEL}-${RUN_STAMP}`);
const RESULTS_FILE = path.join(RUN_DIR, 'results.jsonl');
const ATTEMPTS_FILE = path.join(RUN_DIR, 'attempts.jsonl');
const PROGRESS_FILE = path.join(RUN_DIR, 'progress.json');
const RUN_CONFIG_FILE = path.join(RUN_DIR, 'run-config.json');
const PREFLIGHT_ONLY = process.env.PREFLIGHT_ONLY === 'true';
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 4);
const BASE_RETRY_MS = Number(process.env.BASE_RETRY_MS || 2000);
const MODEL_FILTER = (process.env.MODELS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const LEDGER_ALL_MODELS = process.env.LEDGER_ALL_MODELS === 'true';

let stopRequested = false;
let progressWrites = Promise.resolve();

function loadCsv(filename) {
  return parse(fs.readFileSync(filename, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function taskKey(modelId, promptId, replicate) {
  return `${modelId}|${promptId}|${replicate}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appendJsonLine(filename, value) {
  fs.appendFileSync(filename, `${JSON.stringify(value)}\n`);
}

function loadLatestResults() {
  const latest = new Map();
  if (!fs.existsSync(RESULTS_FILE)) return latest;
  const lines = fs.readFileSync(RESULTS_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line);
    latest.set(row.task_key, row);
  }
  return latest;
}

function isTruncated(finishReason) {
  return /max[_\s-]?tokens|length|incomplete/i.test(String(finishReason || ''));
}

function retryableError(error) {
  return /429|rate|quota|timeout|timed out|econn|socket|network|fetch|overload|529|500|502|503|504/i
    .test(String(error?.message || error));
}

function atomicWriteJson(filename, value) {
  const tempFile = `${filename}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempFile, filename);
}

function buildProgress({ tasks, latestResults, attempts, startedAt }) {
  const rows = [...latestResults.values()];
  const completed = rows.filter(row => row.status === 'completed').length;
  const errors = rows.filter(row => row.status === 'error').length;
  const byModel = {};
  for (const task of tasks) {
    byModel[task.model.model_id] ||= { total: 0, completed: 0, errors: 0 };
    byModel[task.model.model_id].total += 1;
  }
  for (const row of rows) {
    if (!byModel[row.model_id]) continue;
    if (row.status === 'completed') byModel[row.model_id].completed += 1;
    if (row.status === 'error') byModel[row.model_id].errors += 1;
  }
  return {
    run_type: RUN_LABEL,
    status: stopRequested ? 'stopping' : (completed === tasks.length ? 'completed' : 'running'),
    started_at: startedAt,
    updated_at: new Date().toISOString(),
    run_dir: RUN_DIR,
    total_tasks: tasks.length,
    completed,
    errors,
    remaining: tasks.length - completed,
    attempts,
    by_model: byModel,
    accepted_input_tokens: rows.reduce((sum, row) => sum + Number(row.usage?.input_tokens || 0), 0),
    accepted_billed_output_tokens: rows.reduce((sum, row) => sum + Number(row.usage?.billed_output_tokens || 0), 0),
    accepted_estimated_cost_usd: rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0),
  };
}

function queueProgressWrite(context) {
  progressWrites = progressWrites.then(() => {
    atomicWriteJson(PROGRESS_FILE, buildProgress(context));
  });
  return progressWrites;
}

async function executeTask(task, aliases) {
  const key = taskKey(task.model.model_id, task.prompt.prompt_id, task.replicate);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    try {
      const response = await callModel(task.model, task.prompt.prompt);
      const rawBrands = extractBrands(response.text);
      const brands = classifyBrands(rawBrands, task.prompt.category, aliases);
      const truncated = isTruncated(response.finish_reason);
      const cost = estimatedCost(task.model.model_id, response.usage);
      const accepted = !truncated && brands.length > 0;
      appendJsonLine(ATTEMPTS_FILE, {
        task_key: key,
        attempt,
        accepted,
        provider: task.model.provider,
        model_id: task.model.model_id,
        prompt_id: task.prompt.prompt_id,
        replicate: task.replicate,
        finish_reason: response.finish_reason || '',
        usage: response.usage,
        estimated_cost_usd: cost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedMs,
        issue: truncated ? 'truncated' : (brands.length ? '' : 'no_brands_parsed'),
      });

      if (accepted) {
        return {
          task_key: key,
          status: 'completed',
          provider: task.model.provider,
          model_id: task.model.model_id,
          model_name: task.model.model_name,
          prompt_id: task.prompt.prompt_id,
          category: task.prompt.category,
          sub_category: task.prompt.sub_category,
          dimension: task.prompt.dimension,
          rating_field: task.prompt.rating_field,
          direction: task.prompt.direction,
          replicate: task.replicate,
          prompt: task.prompt.prompt,
          response_text: response.text,
          brands,
          usage: response.usage,
          estimated_cost_usd: cost,
          provider_request_id: response.provider_request_id,
          finish_reason: response.finish_reason || '',
          thinking_config: response.thinking_config || null,
          attempt_count: attempt,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          elapsed_ms: Date.now() - startedMs,
          temperature: task.model.provider === 'openai' ? null : 0.7,
          max_output_tokens: 800,
          web_search: false,
          session_rule: 'fresh_session_no_history',
        };
      }
      lastError = new Error(truncated ? 'Model output was truncated' : 'No brands parsed');
    } catch (error) {
      lastError = error;
      appendJsonLine(ATTEMPTS_FILE, {
        task_key: key,
        attempt,
        accepted: false,
        provider: task.model.provider,
        model_id: task.model.model_id,
        prompt_id: task.prompt.prompt_id,
        replicate: task.replicate,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedMs,
        error: error.message,
      });
    }

    if (attempt <= MAX_RETRIES) {
      const backoff = BASE_RETRY_MS * (2 ** (attempt - 1)) + Math.floor(Math.random() * 750);
      if (!retryableError(lastError) && !/truncated|No brands/i.test(lastError.message)) break;
      await sleep(backoff);
    }
  }

  return {
    task_key: key,
    status: 'error',
    provider: task.model.provider,
    model_id: task.model.model_id,
    model_name: task.model.model_name,
    prompt_id: task.prompt.prompt_id,
    category: task.prompt.category,
    sub_category: task.prompt.sub_category,
    dimension: task.prompt.dimension,
    rating_field: task.prompt.rating_field,
    direction: task.prompt.direction,
    replicate: task.replicate,
    prompt: task.prompt.prompt,
    error: lastError?.message || 'Unknown error',
    finished_at: new Date().toISOString(),
  };
}

async function main() {
  const protocol = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'experiment_protocol.json'), 'utf8'));
  const prompts = loadCsv(PROMPTS_FILE);
  const aliases = loadCsv(path.join(ROOT, 'config', 'brand_aliases_initial.csv'));
  const models = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'models.json'), 'utf8')).models;

  if (prompts.length !== EXPECTED_PROMPT_COUNT) {
    throw new Error(`Expected ${EXPECTED_PROMPT_COUNT} prompts; found ${prompts.length}`);
  }
  if (models.length !== protocol.model_count) throw new Error(`Expected ${protocol.model_count} models; found ${models.length}`);
  if (protocol.repeats_per_prompt_model !== 40) throw new Error('Protocol replicates are not 40.');
  if (protocol.web_search || protocol.followup_reasons) throw new Error('artifact protocol must keep web search and follow-up reasons off.');

  const selectedModels = MODEL_FILTER.length
    ? models.filter(model => MODEL_FILTER.includes(model.model_id))
    : models;
  if (selectedModels.length === 0) throw new Error(`No configured models matched MODELS=${MODEL_FILTER.join(',')}`);
  const unknownModels = MODEL_FILTER.filter(modelId => !models.some(model => model.model_id === modelId));
  if (unknownModels.length) throw new Error(`Unknown model filter: ${unknownModels.join(', ')}`);

  const ledgerModels = LEDGER_ALL_MODELS ? models : selectedModels;
  const tasks = [];
  for (const model of ledgerModels) {
    for (let replicate = 1; replicate <= protocol.repeats_per_prompt_model; replicate += 1) {
      for (const prompt of prompts) tasks.push({ model, prompt, replicate });
    }
  }
  const keys = new Set(tasks.map(task => taskKey(task.model.model_id, task.prompt.prompt_id, task.replicate)));
  const expectedTasks = prompts.length * ledgerModels.length * protocol.repeats_per_prompt_model;
  if (tasks.length !== expectedTasks || keys.size !== tasks.length) {
    throw new Error(`Task ledger mismatch: ${tasks.length} tasks, ${keys.size} unique, expected ${expectedTasks}`);
  }

  for (const envName of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']) {
    if (!process.env[envName]) throw new Error(`${envName} is missing.`);
  }

  fs.mkdirSync(RUN_DIR, { recursive: true });
  const startedAt = fs.existsSync(RUN_CONFIG_FILE)
    ? JSON.parse(fs.readFileSync(RUN_CONFIG_FILE, 'utf8')).started_at
    : new Date().toISOString();
  atomicWriteJson(RUN_CONFIG_FILE, {
    run_type: RUN_LABEL,
    started_at: startedAt,
    run_dir: RUN_DIR,
    prompt_version: PROMPTS_FILE === path.join(ROOT, 'config', 'positioning_prompts.csv')
      ? protocol.prompt_version
      : path.basename(PROMPTS_FILE),
    prompts_file: PROMPTS_FILE,
    prompts: prompts.length,
    models: ledgerModels.map(model => model.model_id),
    replicates: protocol.repeats_per_prompt_model,
    total_tasks: tasks.length,
    concurrency: `one sequential worker per model (${selectedModels.length} model workers)`,
    max_retries: MAX_RETRIES,
    temperature: protocol.temperature,
    max_output_tokens: protocol.max_output_tokens,
    web_search: protocol.web_search,
    followup_reasons: protocol.followup_reasons,
  });

  const latestResults = loadLatestResults();
  let attempts = fs.existsSync(ATTEMPTS_FILE)
    ? fs.readFileSync(ATTEMPTS_FILE, 'utf8').split(/\r?\n/).filter(Boolean).length
    : 0;
  const completedBefore = [...latestResults.values()].filter(row => row.status === 'completed').length;
  console.log(`Run directory: ${RUN_DIR}`);
  console.log(`Task ledger: ${tasks.length} (${prompts.length} prompts × ${ledgerModels.length} models × ${protocol.repeats_per_prompt_model} replicates)`);
  console.log(`Resume state: ${completedBefore} completed; ${tasks.length - completedBefore} remaining`);
  console.log(`Workers: ${selectedModels.map(model => model.model_id).join(', ')}; web search: off; follow-up reasons: off`);

  const context = { tasks, latestResults, attempts, startedAt };
  await queueProgressWrite(context);
  if (PREFLIGHT_ONLY) {
    console.log('Preflight passed; no API calls made.');
    return;
  }

  const handleStop = signal => {
    if (!stopRequested) console.log(`Received ${signal}; checkpointing after active calls finish.`);
    stopRequested = true;
  };
  process.on('SIGINT', () => handleStop('SIGINT'));
  process.on('SIGTERM', () => handleStop('SIGTERM'));

  let processedThisProcess = 0;
  const workers = selectedModels.map(async model => {
    const modelTasks = tasks.filter(task => task.model.model_id === model.model_id);
    for (const task of modelTasks) {
      if (stopRequested) break;
      const key = taskKey(model.model_id, task.prompt.prompt_id, task.replicate);
      if (latestResults.get(key)?.status === 'completed') continue;

      const row = await executeTask(task, aliases);
      attempts += Number(row.attempt_count || 1);
      context.attempts = attempts;
      latestResults.set(key, row);
      appendJsonLine(RESULTS_FILE, row);
      processedThisProcess += 1;
      if (processedThisProcess <= 12 || processedThisProcess % 25 === 0 || row.status !== 'completed') {
        const accepted = [...latestResults.values()].filter(item => item.status === 'completed').length;
        console.log(`[${accepted}/${tasks.length}] ${key} ${row.status}${row.error ? `: ${row.error}` : ''}`);
      }
      await queueProgressWrite(context);
    }
  });

  await Promise.all(workers);
  await progressWrites;
  const progress = buildProgress(context);
  if (progress.completed === tasks.length) progress.status = 'completed';
  else if (stopRequested) progress.status = 'stopped';
  else progress.status = 'completed_with_errors';
  progress.finished_at = new Date().toISOString();
  atomicWriteJson(PROGRESS_FILE, progress);
  console.log(JSON.stringify(progress, null, 2));
  if (progress.completed !== tasks.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
