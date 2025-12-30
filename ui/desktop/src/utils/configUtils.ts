export const configLabels: Record<string, string> = {
  // Goose設定
  GOOSE_PROVIDER: 'プロバイダー',
  GOOSE_MODEL: 'モデル',
  GOOSE_TEMPERATURE: '温度',
  GOOSE_MODE: 'モード',
  GOOSE_LEAD_PROVIDER: 'リードプロバイダー',
  GOOSE_LEAD_MODEL: 'リードモデル',
  GOOSE_PLANNER_PROVIDER: 'プランナープロバイダー',
  GOOSE_PLANNER_MODEL: 'プランナーモデル',
  GOOSE_TOOLSHIM: 'ツールシム',
  GOOSE_TOOLSHIM_OLLAMA_MODEL: 'ツールシム Ollamaモデル',
  GOOSE_CLI_MIN_PRIORITY: 'CLI最小優先度',
  GOOSE_ALLOWLIST: '許可リスト',
  GOOSE_RECIPE_GITHUB_REPO: 'レシピGitHubリポジトリ',

  // セキュリティ設定
  SECURITY_PROMPT_ENABLED: 'プロンプトインジェクション検出を有効化',
  SECURITY_PROMPT_THRESHOLD: 'プロンプトインジェクション検出閾値',

  // OpenAI
  OPENAI_API_KEY: 'OpenAI APIキー',
  OPENAI_HOST: 'OpenAIホスト',
  OPENAI_BASE_PATH: 'OpenAIベースパス',

  // Groq
  GROQ_API_KEY: 'Groq APIキー',

  // OpenRouter
  OPENROUTER_API_KEY: 'OpenRouter APIキー',

  // Anthropic
  ANTHROPIC_API_KEY: 'Anthropic APIキー',
  ANTHROPIC_HOST: 'Anthropicホスト',

  // Google
  GOOGLE_API_KEY: 'Google APIキー',

  // Databricks
  DATABRICKS_HOST: 'Databricksホスト',

  // Ollama
  OLLAMA_HOST: 'Ollamaホスト',

  // Azure OpenAI
  AZURE_OPENAI_API_KEY: 'Azure OpenAI APIキー',
  AZURE_OPENAI_ENDPOINT: 'Azure OpenAIエンドポイント',
  AZURE_OPENAI_DEPLOYMENT_NAME: 'Azure OpenAIデプロイ名',
  AZURE_OPENAI_API_VERSION: 'Azure OpenAI APIバージョン',

  // GCP Vertex
  GCP_PROJECT_ID: 'GCPプロジェクトID',
  GCP_LOCATION: 'GCPロケーション',

  // Snowflake
  SNOWFLAKE_HOST: 'Snowflakeホスト',
  SNOWFLAKE_TOKEN: 'Snowflakeトークン',
};

export const providerPrefixes: Record<string, string[]> = {
  openai: ['OPENAI_'],
  anthropic: ['ANTHROPIC_'],
  google: ['GOOGLE_'],
  groq: ['GROQ_'],
  databricks: ['DATABRICKS_'],
  openrouter: ['OPENROUTER_'],
  ollama: ['OLLAMA_'],
  azure_openai: ['AZURE_'],
  gcp_vertex_ai: ['GCP_'],
  snowflake: ['SNOWFLAKE_'],
};

export const getUiNames = (key: string): string => {
  if (configLabels[key]) {
    return configLabels[key];
  }
  return key
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};
