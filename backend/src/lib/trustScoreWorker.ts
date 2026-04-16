import { calculateTrustScore } from './trustScore';

interface TrustUpdateJob {
  userId: string;
  postId: string;
  action: 'approve' | 'reject';
  attempt: number;
}

class TrustScoreWorker {
  private queue: TrustUpdateJob[] = [];
  private processing = false;
  private maxRetries = 5;
  private retryDelay = 100;

  /**
   * Queue a trust score update for async processing
   */
  public async queueUpdate(userId: string, postId: string, action: 'approve' | 'reject'): Promise<void> {
    this.queue.push({
      userId,
      postId,
      action,
      attempt: 0,
    });

    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process queue with exponential backoff for version conflicts
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const job = this.queue.shift()!;

    try {
      await calculateTrustScore(job.userId, job.postId, job.action);
    } catch (error) {
      // Retry version conflicts with exponential backoff
      if (job.attempt < this.maxRetries && error.message.includes('Version conflict')) {
        job.attempt++;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, job.attempt)));
        this.queue.unshift(job);
      } else {
        console.error('[TrustScoreWorker] Permanent failure for job:', job, error);
      }
    }

    // Process next item
    setImmediate(() => this.processQueue());
  }
}

// Singleton instance
export const trustScoreWorker = new TrustScoreWorker();
