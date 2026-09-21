const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_MAX_TRACKED_IPS = 20_000;

export type QuotaRejectionReason =
  | 'ip_hourly_limit'
  | 'ip_in_flight'
  | 'global_concurrency'
  | 'global_request_rate'
  | 'global_budget';

export interface QuotaConfig {
  perIpPerHour: number;
  globalMaxConcurrency: number;
  /**
   * Max AI-calling requests per rolling minute, summed across all IPs — an
   * IP-independent ceiling. No amount of source-address diversity can push
   * total throughput past this, unlike the per-IP limits below.
   */
  globalRequestsPerMinute: number;
  /**
   * Max cumulative input+output tokens per rolling hour, across all
   * clients. `null` = unlimited. Rolling, not lifetime — a burst that
   * exhausts it self-heals within the hour instead of requiring a manual
   * process restart to recover the AI feature for every visitor.
   */
  globalTokenBudget: number | null;
  /**
   * Bounds how many distinct IPs' hourly-request history is tracked at
   * once, evicting the oldest-inserted entry once at capacity. IPs that
   * stop requesting are never proactively swept, so without this a
   * long-running process (or an attacker deliberately rotating through many
   * source addresses) would grow this map without bound. Defaults to
   * 20,000 when omitted.
   */
  maxTrackedIps?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export type QuotaReservation =
  | { ok: true; release: (usage?: Usage) => void }
  | { ok: false; reason: QuotaRejectionReason };

export function quotaRejectionMessage(reason: QuotaRejectionReason): string {
  switch (reason) {
    case 'ip_hourly_limit':
      return 'Has alcanzado el límite de peticiones por hora para esta demo. Prueba con uno de los ejemplos mientras tanto.';
    case 'ip_in_flight':
      return 'Ya hay una petición en curso. Espera a que termine antes de enviar otra.';
    case 'global_concurrency':
    case 'global_request_rate':
      return 'La demo está muy solicitada en este momento. Inténtalo de nuevo en unos segundos.';
    case 'global_budget':
      return 'Esta demo alcanzó su límite de uso de IA por ahora. Prueba con uno de los ejemplos mientras tanto.';
  }
}

interface TokenSpend {
  timestamp: number;
  tokens: number;
}

/**
 * In-memory, single-instance quota tracker: per-IP hourly limit, one
 * in-flight request per IP, a global concurrency cap, an IP-independent
 * global requests-per-minute ceiling, and a rolling global token budget.
 * Not durable and doesn't coordinate across instances — acceptable for a
 * single-instance deployment (spec §10), not a substitute for a hard
 * provider-side spend cap.
 *
 * The requests-per-minute ceiling and the rolling (not lifetime) token
 * budget exist specifically so that no amount of source-IP diversity can
 * bypass throughput limits or permanently exhaust the AI feature for every
 * visitor — both recover within their window on their own, without an
 * operator having to notice and restart the process.
 */
export class QuotaManager {
  private readonly maxTrackedIps: number;
  private readonly ipHourlyTimestamps = new Map<string, number[]>();
  private readonly ipInFlight = new Set<string>();
  private globalInFlight = 0;
  private globalRequestTimestamps: number[] = [];
  private globalTokenSpendLog: TokenSpend[] = [];

  constructor(private readonly config: QuotaConfig) {
    this.maxTrackedIps = config.maxTrackedIps ?? DEFAULT_MAX_TRACKED_IPS;
  }

  reserve(ip: string): QuotaReservation {
    const now = Date.now();

    if (this.config.globalTokenBudget !== null && this.tokensSpentInWindow(now) >= this.config.globalTokenBudget) {
      return { ok: false, reason: 'global_budget' };
    }

    this.globalRequestTimestamps = this.pruneOld(this.globalRequestTimestamps, now, MINUTE_MS);
    if (this.globalRequestTimestamps.length >= this.config.globalRequestsPerMinute) {
      return { ok: false, reason: 'global_request_rate' };
    }

    if (this.globalInFlight >= this.config.globalMaxConcurrency) {
      return { ok: false, reason: 'global_concurrency' };
    }
    if (this.ipInFlight.has(ip)) {
      return { ok: false, reason: 'ip_in_flight' };
    }
    const recentIpRequests = this.pruneOld(this.ipHourlyTimestamps.get(ip) ?? [], now, HOUR_MS);
    if (recentIpRequests.length >= this.config.perIpPerHour) {
      return { ok: false, reason: 'ip_hourly_limit' };
    }

    recentIpRequests.push(now);
    this.touchIp(ip, recentIpRequests);
    this.globalRequestTimestamps.push(now);
    this.ipInFlight.add(ip);
    this.globalInFlight += 1;

    let released = false;
    return {
      ok: true,
      release: (usage?: Usage) => {
        if (released) return;
        released = true;
        this.ipInFlight.delete(ip);
        this.globalInFlight -= 1;
        if (usage) {
          this.globalTokenSpendLog.push({ timestamp: Date.now(), tokens: usage.inputTokens + usage.outputTokens });
        }
      },
    };
  }

  private tokensSpentInWindow(now: number): number {
    this.globalTokenSpendLog = this.globalTokenSpendLog.filter((entry) => entry.timestamp > now - HOUR_MS);
    return this.globalTokenSpendLog.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  private pruneOld(timestamps: number[], now: number, windowMs: number): number[] {
    return timestamps.filter((timestamp) => timestamp > now - windowMs);
  }

  /**
   * Writes back this IP's pruned timestamp array, evicting the
   * oldest-inserted tracked IP once at `maxTrackedIps` capacity — the
   * deterministic bound on map growth described on `QuotaConfig.maxTrackedIps`.
   */
  private touchIp(ip: string, timestamps: number[]): void {
    if (!this.ipHourlyTimestamps.has(ip) && this.ipHourlyTimestamps.size >= this.maxTrackedIps) {
      const oldestKey = this.ipHourlyTimestamps.keys().next().value;
      if (oldestKey !== undefined) this.ipHourlyTimestamps.delete(oldestKey);
    }
    this.ipHourlyTimestamps.set(ip, timestamps);
  }
}
