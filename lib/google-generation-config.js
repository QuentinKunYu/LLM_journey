function googleThinkingConfig(modelName) {
  if (modelName.startsWith('gemini-3')) {
    // Gemini 3's "low" level is relative and can still consume nearly the
    // entire 800-token response allowance. The legacy budget remains accepted
    // by the API and leaves deterministic room for the visible ranked list.
    return { thinkingBudget: 128 };
  }
  if (modelName === 'gemini-2.5-flash') {
    return { thinkingBudget: 0 };
  }
  return undefined;
}

function googleStructuredOutputConfig(modelName) {
  if (!modelName.startsWith('gemini-')) return {};
  return {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        brands: {
          type: 'array',
          description: 'Up to five brand names in recommendation order, with no explanations.',
          items: { type: 'string' },
          maxItems: 5,
        },
      },
      required: ['brands'],
    },
  };
}

function buildGoogleGenerationConfig(modelName, temperature, maxTokens, options = {}) {
  const thinkingConfig = options.brandListMode
    ? googleThinkingConfig(modelName)
    : undefined;
  return {
    ...(Number.isFinite(temperature) ? { temperature } : {}),
    maxOutputTokens: maxTokens,
    ...(thinkingConfig ? { thinkingConfig } : {}),
    ...(options.brandListMode ? googleStructuredOutputConfig(modelName) : {}),
  };
}

module.exports = {
  buildGoogleGenerationConfig,
  googleStructuredOutputConfig,
  googleThinkingConfig,
};
