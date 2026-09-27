require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { extractBrands } = require('../lib/brand-extractor');
const { buildGoogleGenerationConfig } = require('../lib/google-generation-config');
const { classifyBrands, estimatedCost } = require('./run-live-smoke');

const ROOT = path.join(__dirname, '..');
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS = ['gemini-3.1-pro-preview', 'gemini-2.5-flash'];
const TERMINAL_STATES = new Set([
  'JOB_STATE_SUCCEEDED',
  'JOB_STATE_FAILED',
  'JOB_STATE_CANCELLED',
  'JOB_STATE_EXPIRED',
  'BATCH_STATE_SUCCEEDED',
  'BATCH_STATE_FAILED',
  'BATCH_STATE_CANCELLED',
  'BATCH_STATE_EXPIRED',
]);
const SUCCEEDED_STATES = new Set(['JOB_STATE_SUCCEEDED', 'BATCH_STATE_SUCCEEDED']);
const TEMPERATURE = 0.7;
const MAX_OUTPUT_TOKENS = 800;
const POLL_MS = Number(process.env.POLL_MS || 30_000);
const MAX_REPAIR_ROUNDS = Number(process.env.MAX_REPAIR_ROUNDS || 3);
const PREFLIGHT_ONLY = process.env.PREFLIGHT_ONLY === 'true';
const PROMPTS_FILE = path.resolve(ROOT, process.env.PROMPTS_FILE || 'config/positioning_prompts.csv');
const EXPECTED_PROMPT_COUNT = Number(process.env.EXPECTED_PROMPT_COUNT || 48);
const RUN_LABEL = process.env.RUN_LABEL || 'gemini-batch';
const RUN_STAMP = process.env.RUN_STAMP || new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = process.env.RUN_DIR
  ? path.resolve(process.env.RUN_DIR)
  : path.join(ROOT, 'data', 'runs', `${RUN_LABEL}-${RUN_STAMP}`);
const JOBS_FILE = path.join(RUN_DIR, 'jobs.json');
const PROGRESS_FILE = path.join(RUN_DIR, 'progress.json');

function loadCsv(filename) {
  return parse(fs.readFileSync(filename, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function atomicWriteJson(filename, value) {
  const tempFile = `${filename}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempFile, filename);
}

function safeModelName(modelName) {
  return modelName.replace(/[^a-z0-9.-]+/gi, '-');
}

function taskKey(modelName, promptId, replicate) {
  return `${modelName}|${promptId}|${replicate}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getState(job) {
  return job?.metadata?.state || job?.state || (job?.done ? 'JOB_STATE_SUCCEEDED' : 'JOB_STATE_PENDING');
}

function isTruncated(finishReason) {
  return /max[_\s-]?tokens|length|incomplete/i.test(String(finishReason || ''));
}

function buildTasks(modelName, prompts, repeats) {
  const tasks = [];
  for (let replicate = 1; replicate <= repeats; replicate += 1) {
    for (const prompt of prompts) {
      const key = taskKey(modelName, prompt.prompt_id, replicate);
      tasks.push({
        key,
        model_name: modelName,
        prompt_id: prompt.prompt_id,
        category: prompt.category,
        sub_category: prompt.sub_category,
        dimension: prompt.dimension,
        rating_field: prompt.rating_field,
        direction: prompt.direction,
        replicate,
        prompt: prompt.prompt,
      });
    }
  }
  return tasks;
}

function buildBatchBody(modelName, tasks) {
  return {
    batch: {
      display_name: `evaluation-${safeModelName(modelName)}-${RUN_STAMP}`.slice(0, 128),
      input_config: {
        requests: {
          requests: tasks.map(task => ({
            request: {
              contents: [{ role: 'user', parts: [{ text: task.prompt }] }],
              generationConfig: buildGoogleGenerationConfig(
                modelName,
                TEMPERATURE,
                MAX_OUTPUT_TOKENS,
                { brandListMode: true },
              ),
            },
            metadata: { key: task.key },
          })),
        },
      },
    },
  };
}

async function googleRequest(endpoint, options = {}) {
  const response = await fetch(`${API_ROOT}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GOOGLE_API_KEY,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const detail = body?.error?.message || body?.raw || response.statusText;
    const error = new Error(`Gemini API ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function createJob(modelName, body) {
  return googleRequest(`models/${encodeURIComponent(modelName)}:batchGenerateContent`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function getJob(name) {
  return googleRequest(name, { method: 'GET' });
}

function unwrapInlineResponses(job) {
  const candidates = [
    job?.response?.inlinedResponses,
    job?.response?.inlined_responses,
    job?.response?.output?.inlinedResponses,
    job?.response?.output?.inlined_responses,
    job?.dest?.inlinedResponses,
    job?.dest?.inlined_responses,
    job?.output?.inlinedResponses,
    job?.output?.inlined_responses,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.inlinedResponses)) return candidate.inlinedResponses;
    if (Array.isArray(candidate?.inlined_responses)) return candidate.inlined_responses;
  }
  return [];
}

function responseText(response) {
  return (response?.candidates?.[0]?.content?.parts || [])
    .map(part => part?.text || '')
    .join('')
    .trim();
}

function normalizeUsage(response) {
  const usage = response?.usageMetadata || response?.usage_metadata || {};
  const visible = Number(usage.candidatesTokenCount || usage.candidates_token_count || 0);
  const reasoning = Number(usage.thoughtsTokenCount || usage.thoughts_token_count || 0);
  return {
    input_tokens: Number(usage.promptTokenCount || usage.prompt_token_count || 0),
    visible_output_tokens: visible,
    reasoning_tokens: reasoning,
    billed_output_tokens: visible + reasoning,
    total_tokens: Number(usage.totalTokenCount || usage.total_token_count || 0),
  };
}

function materializeResults(modelName, tasks, job, aliases) {
  const inlineResponses = unwrapInlineResponses(job);
  if (inlineResponses.length !== tasks.length) {
    throw new Error(`${modelName}: expected ${tasks.length} inline responses; found ${inlineResponses.length}`);
  }

  const taskByKey = new Map(tasks.map(task => [task.key, task]));
  const usedKeys = new Set();
  return inlineResponses.map((inline, index) => {
    const metadataKey = inline?.metadata?.key;
    const task = (metadataKey && taskByKey.get(metadataKey)) || tasks[index];
    if (!task) throw new Error(`${modelName}: response ${index} cannot be mapped to a task`);
    if (usedKeys.has(task.key)) throw new Error(`${modelName}: duplicate response key ${task.key}`);
    usedKeys.add(task.key);

    const common = {
      task_key: task.key,
      provider: 'google',
      model_id: modelName,
      model_name: modelName,
      prompt_id: task.prompt_id,
      category: task.category,
      sub_category: task.sub_category,
      dimension: task.dimension,
      rating_field: task.rating_field,
      direction: task.direction,
      replicate: task.replicate,
      prompt: task.prompt,
      execution_mode: 'batch',
      batch_job_name: job.name || '',
      finished_at: new Date().toISOString(),
      temperature: TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      web_search: false,
      session_rule: 'fresh_session_no_history',
    };
    if (inline?.error) {
      return {
        ...common,
        status: 'error',
        error: inline.error.message || JSON.stringify(inline.error),
      };
    }

    const response = inline?.response || {};
    const text = responseText(response);
    const finishReason = response?.candidates?.[0]?.finishReason
      || response?.candidates?.[0]?.finish_reason
      || '';
    const usage = normalizeUsage(response);
    const brands = classifyBrands(extractBrands(text), task.category, aliases);
    const issue = isTruncated(finishReason)
      ? 'truncated'
      : (brands.length ? '' : 'no_brands_parsed');
    const standardCost = estimatedCost(modelName, usage);
    return {
      ...common,
      status: issue ? 'error' : 'completed',
      ...(issue ? { error: issue } : {}),
      response_text: text,
      brands,
      usage,
      estimated_cost_usd: standardCost == null ? null : standardCost * 0.5,
      provider_request_id: response?.responseId || response?.response_id || '',
      finish_reason: finishReason,
      thinking_config: buildGoogleGenerationConfig(
        modelName,
        TEMPERATURE,
        MAX_OUTPUT_TOKENS,
        { brandListMode: true },
      ).thinkingConfig || null,
    };
  });
}

function writeJsonLines(filename, rows) {
  fs.writeFileSync(filename, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
}

function writeProgress(jobs, tasksByModel, status = 'running') {
  atomicWriteJson(PROGRESS_FILE, {
    run_type: RUN_LABEL,
    status,
    updated_at: new Date().toISOString(),
    run_dir: RUN_DIR,
    total_requests: [...tasksByModel.values()].reduce((sum, tasks) => sum + tasks.length, 0),
    requests_by_model: Object.fromEntries([...tasksByModel].map(([model, tasks]) => [model, tasks.length])),
    jobs: Object.fromEntries(Object.entries(jobs).map(([model, job]) => [model, {
      name: job.name,
      state: job.state || getState(job.last_status || job.creation_response),
      submitted_at: job.submitted_at,
    }])),
  });
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is missing.');

  const protocol = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'experiment_protocol.json'), 'utf8'));
  const prompts = loadCsv(PROMPTS_FILE);
  const aliases = loadCsv(path.join(ROOT, 'config', 'brand_aliases_initial.csv'));
  const configuredModels = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'models.json'), 'utf8')).models;
  const configuredGoogleModels = new Set(
    configuredModels.filter(model => model.provider === 'google').map(model => model.model_name),
  );
  if (prompts.length !== EXPECTED_PROMPT_COUNT) {
    throw new Error(`Expected ${EXPECTED_PROMPT_COUNT} prompts; found ${prompts.length}`);
  }
  if (protocol.repeats_per_prompt_model !== 40) throw new Error('Expected exactly 40 replicates.');
  for (const modelName of MODELS) {
    if (!configuredGoogleModels.has(modelName)) throw new Error(`Google model is not configured: ${modelName}`);
  }

  fs.mkdirSync(RUN_DIR, { recursive: true });
  const tasksByModel = new Map();
  const bodiesByModel = new Map();
  const validation = {};
  const expectedRequestsPerModel = EXPECTED_PROMPT_COUNT * protocol.repeats_per_prompt_model;
  const expectedTotalRequests = expectedRequestsPerModel * MODELS.length;
  for (const modelName of MODELS) {
    const tasks = buildTasks(modelName, prompts, protocol.repeats_per_prompt_model);
    const keys = new Set(tasks.map(task => task.key));
    if (tasks.length !== expectedRequestsPerModel || keys.size !== expectedRequestsPerModel) {
      throw new Error(
        `${modelName}: expected ${expectedRequestsPerModel} unique tasks; found ${tasks.length}/${keys.size}`,
      );
    }
    const body = buildBatchBody(modelName, tasks);
    const requestBytes = Buffer.byteLength(JSON.stringify(body));
    if (requestBytes >= 20 * 1024 * 1024) {
      throw new Error(`${modelName}: inline request is ${requestBytes} bytes, exceeding 20MB`);
    }
    tasksByModel.set(modelName, tasks);
    bodiesByModel.set(modelName, body);
    validation[modelName] = {
      requests: tasks.length,
      unique_task_keys: keys.size,
      request_bytes: requestBytes,
      generation_config: body.batch.input_config.requests.requests[0].request.generationConfig,
    };
    atomicWriteJson(path.join(RUN_DIR, `manifest-${safeModelName(modelName)}.json`), tasks);
    atomicWriteJson(path.join(RUN_DIR, `request-${safeModelName(modelName)}.json`), body);
  }
  atomicWriteJson(path.join(RUN_DIR, 'preflight.json'), {
    validated_at: new Date().toISOString(),
    run_dir: RUN_DIR,
    prompts_file: PROMPTS_FILE,
    total_requests: expectedTotalRequests,
    validation,
  });
  console.log(JSON.stringify({ run_dir: RUN_DIR, total_requests: expectedTotalRequests, validation }, null, 2));
  if (PREFLIGHT_ONLY) return;

  let jobs = fs.existsSync(JOBS_FILE)
    ? JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'))
    : {};
  for (const modelName of MODELS) {
    if (jobs[modelName]?.name) {
      console.log(`[resume] ${modelName}: ${jobs[modelName].name}`);
      continue;
    }
    console.log(`[submit] ${modelName}: ${expectedRequestsPerModel} requests`);
    const creationResponse = await createJob(modelName, bodiesByModel.get(modelName));
    if (!creationResponse.name) throw new Error(`${modelName}: batch creation returned no job name`);
    jobs[modelName] = {
      name: creationResponse.name,
      state: getState(creationResponse),
      submitted_at: new Date().toISOString(),
      creation_response: creationResponse,
    };
    atomicWriteJson(JOBS_FILE, jobs);
    console.log(`[accepted] ${modelName}: ${creationResponse.name} (${jobs[modelName].state})`);
  }
  writeProgress(jobs, tasksByModel);

  let allTerminal = false;
  while (!allTerminal) {
    allTerminal = true;
    for (const modelName of MODELS) {
      if (TERMINAL_STATES.has(jobs[modelName].state) && jobs[modelName].last_status) continue;
      const previousState = jobs[modelName].state;
      try {
        const status = await getJob(jobs[modelName].name);
        const state = getState(status);
        jobs[modelName].state = state;
        jobs[modelName].last_checked_at = new Date().toISOString();
        jobs[modelName].last_status = status;
        if (state !== previousState) console.log(`[status] ${modelName}: ${previousState} -> ${state}`);
        if (!TERMINAL_STATES.has(state)) allTerminal = false;
      } catch (error) {
        console.error(`[poll warning] ${modelName}: ${error.message}`);
        allTerminal = false;
      }
    }
    atomicWriteJson(JOBS_FILE, jobs);
    writeProgress(jobs, tasksByModel);
    if (!allTerminal) await sleep(POLL_MS);
  }

  const allRows = [];
  const allAttempts = [];
  for (const modelName of MODELS) {
    const job = jobs[modelName].last_status;
    atomicWriteJson(path.join(RUN_DIR, `raw-result-${safeModelName(modelName)}.json`), job);
    if (!SUCCEEDED_STATES.has(jobs[modelName].state)) {
      throw new Error(`${modelName}: batch ended in ${jobs[modelName].state}`);
    }
    let rows = materializeResults(modelName, tasksByModel.get(modelName), job, aliases);
    allAttempts.push(...rows.map(row => ({ ...row, attempt_type: 'initial', repair_round: 0 })));

    jobs[modelName].repairs ||= [];
    for (let round = 1; round <= MAX_REPAIR_ROUNDS; round += 1) {
      const failedRows = rows.filter(row => row.status !== 'completed');
      if (failedRows.length === 0) break;
      const failedKeys = new Set(failedRows.map(row => row.task_key));
      const repairTasks = tasksByModel.get(modelName).filter(task => failedKeys.has(task.key));
      let repair = jobs[modelName].repairs[round - 1];
      if (!repair) {
        const repairBody = buildBatchBody(modelName, repairTasks);
        repairBody.batch.display_name = `${repairBody.batch.display_name}-repair-${round}`.slice(0, 128);
        console.log(`[repair submit] ${modelName}: round ${round}, ${repairTasks.length} requests`);
        const creationResponse = await createJob(modelName, repairBody);
        if (!creationResponse.name) throw new Error(`${modelName}: repair batch returned no job name`);
        repair = {
          round,
          task_keys: repairTasks.map(task => task.key),
          name: creationResponse.name,
          state: getState(creationResponse),
          submitted_at: new Date().toISOString(),
          creation_response: creationResponse,
        };
        jobs[modelName].repairs.push(repair);
        atomicWriteJson(JOBS_FILE, jobs);
        console.log(`[repair accepted] ${modelName}: ${repair.name} (${repair.state})`);
      } else {
        const expectedKeys = repairTasks.map(task => task.key);
        if (JSON.stringify(repair.task_keys) !== JSON.stringify(expectedKeys)) {
          throw new Error(`${modelName}: repair round ${round} task ledger changed on resume`);
        }
        console.log(`[repair resume] ${modelName}: round ${round}, ${repair.name}`);
      }

      while (!TERMINAL_STATES.has(repair.state) || !repair.last_status) {
        const previousState = repair.state;
        try {
          const status = await getJob(repair.name);
          repair.state = getState(status);
          repair.last_checked_at = new Date().toISOString();
          repair.last_status = status;
          if (repair.state !== previousState) {
            console.log(`[repair status] ${modelName} round ${round}: ${previousState} -> ${repair.state}`);
          }
          atomicWriteJson(JOBS_FILE, jobs);
          if (!TERMINAL_STATES.has(repair.state)) await sleep(POLL_MS);
        } catch (error) {
          console.error(`[repair poll warning] ${modelName} round ${round}: ${error.message}`);
          await sleep(POLL_MS);
        }
      }
      atomicWriteJson(
        path.join(RUN_DIR, `raw-result-${safeModelName(modelName)}-repair-${round}.json`),
        repair.last_status,
      );
      if (!SUCCEEDED_STATES.has(repair.state)) {
        throw new Error(`${modelName}: repair round ${round} ended in ${repair.state}`);
      }
      const repairRows = materializeResults(modelName, repairTasks, repair.last_status, aliases);
      allAttempts.push(...repairRows.map(row => ({ ...row, attempt_type: 'repair', repair_round: round })));
      const repairByKey = new Map(repairRows.map(row => [row.task_key, row]));
      rows = rows.map(row => repairByKey.get(row.task_key) || row);
      console.log(
        `[repair result] ${modelName} round ${round}: `
        + `${repairRows.filter(row => row.status === 'completed').length}/${repairRows.length} completed`,
      );
    }
    writeJsonLines(path.join(RUN_DIR, `results-${safeModelName(modelName)}.jsonl`), rows);
    allRows.push(...rows);
  }
  writeJsonLines(path.join(RUN_DIR, 'results.jsonl'), allRows);
  writeJsonLines(path.join(RUN_DIR, 'attempts.jsonl'), allAttempts);

  const summary = {
    run_type: RUN_LABEL,
    status: allRows.every(row => row.status === 'completed') ? 'completed' : 'completed_with_errors',
    run_dir: RUN_DIR,
    total_requests: allRows.length,
    completed: allRows.filter(row => row.status === 'completed').length,
    errors: allRows.filter(row => row.status !== 'completed').length,
    by_model: Object.fromEntries(MODELS.map(modelName => {
      const rows = allRows.filter(row => row.model_id === modelName);
      const attempts = allAttempts.filter(row => row.model_id === modelName);
      return [modelName, {
        requests: rows.length,
        completed: rows.filter(row => row.status === 'completed').length,
        errors: rows.filter(row => row.status !== 'completed').length,
        input_tokens: rows.reduce((sum, row) => sum + Number(row.usage?.input_tokens || 0), 0),
        billed_output_tokens: rows.reduce((sum, row) => sum + Number(row.usage?.billed_output_tokens || 0), 0),
        billed_attempts: attempts.length,
        billed_input_tokens: attempts.reduce((sum, row) => sum + Number(row.usage?.input_tokens || 0), 0),
        billed_output_tokens_all_attempts: attempts.reduce(
          (sum, row) => sum + Number(row.usage?.billed_output_tokens || 0),
          0,
        ),
        estimated_batch_cost_usd: attempts.reduce(
          (sum, row) => sum + Number(row.estimated_cost_usd || 0),
          0,
        ),
      }];
    })),
    total_estimated_batch_cost_usd: allAttempts.reduce(
      (sum, row) => sum + Number(row.estimated_cost_usd || 0),
      0,
    ),
    finished_at: new Date().toISOString(),
  };
  atomicWriteJson(path.join(RUN_DIR, 'summary.json'), summary);
  writeProgress(jobs, tasksByModel, summary.status);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildBatchBody,
  buildTasks,
  materializeResults,
  normalizeUsage,
  responseText,
  unwrapInlineResponses,
};
