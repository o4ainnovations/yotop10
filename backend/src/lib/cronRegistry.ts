import { EventEmitter } from 'events';

interface CronJobConfig {
  name: string;
  interval: number;
  handler: () => Promise<void>;
  timeout?: number;
  fatal?: boolean;
  startDelay?: number;
}

interface CronJob {
  config: CronJobConfig;
  lastRun: Date | null;
  lastDuration: number | null;
  running: boolean;
  timerId: NodeJS.Timeout | null;
  stopped: boolean;
}

export class CronRegistry extends EventEmitter {
  private jobs = new Map<string, CronJob>();
  private shuttingDown = false;
  private readonly GRACEFUL_TIMEOUT = 30000;

  register(config: CronJobConfig): void {
    if (this.jobs.has(config.name)) {
      throw new Error(`Cron job '${config.name}' is already registered`);
    }

    const job: CronJob = {
      config,
      lastRun: null,
      lastDuration: null,
      running: false,
      timerId: null,
      stopped: false,
    };

    this.jobs.set(config.name, job);

    const delay = config.startDelay ?? Math.random() * 60000;
    setTimeout(() => this.scheduleJob(config.name), delay);
  }

  private scheduleJob(name: string): void {
    const job = this.jobs.get(name);
    if (!job || this.shuttingDown || job.stopped) return;

    const interval = setInterval(async () => {
      if (this.shuttingDown || job.running || job.stopped) return;
      job.running = true;
      const startTime = Date.now();

      try {
        await this.executeWithTimeout(job);
        job.lastRun = new Date();
        job.lastDuration = Date.now() - startTime;
        this.emit('job:complete', { name: job.config.name, duration: job.lastDuration });
      } catch (err) {
        const error = err as Error;
        console.error(`[CronRegistry] Job '${job.config.name}' failed:`, error.message);
        this.emit('job:error', { name: job.config.name, error: error.message });

        if (job.config.fatal) {
          console.error(`[CronRegistry] Fatal job '${job.config.name}' failed. Shutting down.`);
          process.exit(1);
        }
      } finally {
        job.running = false;
      }
    }, job.config.interval);

    job.timerId = interval;
  }

  private executeWithTimeout(job: CronJob): Promise<void> {
    const timeout = job.config.timeout || job.config.interval * 0.8;
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Job '${job.config.name}' timed out after ${timeout}ms`));
      }, timeout);

      job.config.handler()
        .then(() => { clearTimeout(timeoutId); resolve(); })
        .catch((err) => { clearTimeout(timeoutId); reject(err); });
    });
  }

  async gracefulShutdown(): Promise<void> {
    console.log('[CronRegistry] Shutting down...');
    this.shuttingDown = true;

    for (const [, job] of this.jobs) {
      job.stopped = true;
      if (job.timerId) {
        clearInterval(job.timerId);
        job.timerId = null;
      }
    }

    const runningJobs = Array.from(this.jobs.values()).filter(j => j.running);
    if (runningJobs.length > 0) {
      await Promise.race([
        Promise.all(runningJobs.map(job =>
          new Promise<void>(resolve => {
            const check = () => {
              if (!job.running) resolve();
              else setTimeout(check, 100);
            };
            check();
          })
        )),
        new Promise<void>(resolve => setTimeout(resolve, this.GRACEFUL_TIMEOUT)),
      ]);
    }

    console.log(`[CronRegistry] ${this.jobs.size} jobs stopped`);
  }

  getStatus(): Array<{ name: string; running: boolean; lastRun: Date | null }> {
    return Array.from(this.jobs.values()).map(j => ({
      name: j.config.name,
      running: j.running,
      lastRun: j.lastRun,
    }));
  }
}

export const cronRegistry = new CronRegistry();
