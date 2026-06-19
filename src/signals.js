import { insertSignal, getByIdemKey, listSignals } from './db.js';
import { checkAndConsume } from './rateLimit.js';

function nowMs() { return Date.now(); }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, retries = 3) {
  let delay = 50;

  for (let i = 0; i < retries; i++) {
    try {
      return fn();
    } catch (e) {
      if (i === retries - 1) throw e;

      const jitter = Math.floor(Math.random() * 20);

      await sleep(delay + jitter);

      delay *= 2;
    }
  }
}

export async function postSignal(req, reply) {
  const idem = req.headers['idempotency-key'] || null;
  const { userId, type, payload } = req.body || {};

  if (!userId || !type || typeof payload === 'undefined') {
    return reply.code(400).send({ error: 'invalid_body' });
  }

  const { ok, remaining, resetMs } = checkAndConsume(userId, nowMs());

  if (!ok) {
    return reply.code(429).send({
      error: 'rate_limited',
      remaining,
      resetMs
    });
  }

  if (idem) {
    try {
      const existing = await retry(() => getByIdemKey(idem));

      if (existing) {
        return existing;
      }
    } catch (e) {
      req.log.error({ err: e, ctx: 'getByIdemKey' });
    }
  }

  try {
    const t = nowMs();

    const info = await retry(() =>
      insertSignal(userId, type, payload, idem, t)
    );

    return {
      id: info.lastInsertRowid,
      userId,
      type,
      payload: String(payload),
      idempotencyKey: idem,
      createdAt: t
    };
  } catch (e) {
    if (
      idem &&
      (
        String(e.message).includes('UNIQUE') ||
        String(e.code).includes('SQLITE_CONSTRAINT')
      )
    ) {
      try {
        const existing = await retry(() => getByIdemKey(idem));

        if (existing) {
          return existing;
        }
      } catch { }
    }

    req.log.error({ err: e, ctx: 'insertSignal' });

    return reply.code(503).send({
      error: 'db_unavailable'
    });
  }
}

export async function getSignals(req, reply) {
  const { userId, limit = 20 } = req.query || {};

  if (!userId) {
    return reply.code(400).send({
      error: 'missing_userId'
    });
  }

  const lim = Math.min(Number(limit) || 20, 100);

  try {
    const rows = await retry(() =>
      listSignals(userId, lim)
    );

    return { items: rows };
  } catch (e) {
    req.log.error({ err: e, ctx: 'listSignals' });

    return reply.code(503).send({
      error: 'db_unavailable'
    });
  }
}