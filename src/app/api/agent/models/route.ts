import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const MODEL_LABELS: Record<string, string> = {
  openai_gpt: 'OpenAI GPT',
  claude_ops: 'Claude (Opus)',
  claude_sonnet: 'Claude Sonnet',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
};

export async function GET() {
  try {
    const configPath = join(process.cwd(), 'agent_models.json');
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    const configuredModels = Object.keys(config)
      .filter((key) => config[key].API_ENDPOINT && config[key].MODEL_NAME && config[key].ACCESS_KEY)
      .map((key) => ({
        id: key,
        label: MODEL_LABELS[key] || key,
        configured: true,
      }));

    // If absolutely no models are fully configured yet, return all as unconfigured
    if (configuredModels.length === 0) {
      const allModels = Object.keys(config).map((key) => ({
        id: key,
        label: MODEL_LABELS[key] || key,
        configured: false,
      }));
      return NextResponse.json({ models: allModels });
    }

    return NextResponse.json({ models: configuredModels });
  } catch (e) {
    console.error('[Agent Models] Failed to read config:', e);
    return NextResponse.json({ models: [] }, { status: 500 });
  }
}
