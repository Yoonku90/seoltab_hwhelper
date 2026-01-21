type GeminiModel = {
  generateContent: (...args: any[]) => Promise<any>;
};

const MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 300);

let queue: Promise<void> = Promise.resolve();
let lastRunAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const waitMs = Math.max(0, MIN_INTERVAL_MS - (now - lastRunAt));
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastRunAt = Date.now();
    return task();
  };

  const result = queue.then(run, run);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

export function generateWithLimiter(model: GeminiModel, ...args: any[]) {
  // RPM 제한을 끈 경우: 바로 실행 (직렬 큐 우회)
  if (MIN_INTERVAL_MS <= 0) {
    return model.generateContent(...args);
  }
  return schedule(() => model.generateContent(...args));
}

