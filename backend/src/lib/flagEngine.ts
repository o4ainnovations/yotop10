import { Comment } from '../models/Comment';
import { User } from '../models/User';

export async function runFlagDetection(): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const twentyFourHAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Spam: Repetition — same user, near-identical content across posts
    const recentComments = await Comment.find({
      created_at: { $gte: sixHoursAgo },
      deleted: false,
      hidden: false,
      flag_type: null,
    }).select('author_id content post_id').lean();

    const byUser = new Map<string, Array<{ content: string; id: string; post_id: string }>>();
    for (const c of recentComments) {
      if (!byUser.has(c.author_id)) byUser.set(c.author_id, []);
      byUser.get(c.author_id)!.push({ content: c.content, id: c._id.toString(), post_id: c.post_id.toString() });
    }

    for (const [, comments] of byUser) {
      if (comments.length < 2) continue;
      const groups: Array<{ ids: string[]; content: string }> = [];
      for (let i = 0; i < comments.length; i++) {
        let found = false;
        for (const g of groups) {
          const similarity = levenshteinSimilarity(comments[i].content, g.content);
          if (similarity > 0.8) { g.ids.push(comments[i].id); found = true; break; }
        }
        if (!found) groups.push({ ids: [comments[i].id], content: comments[i].content });
      }
      const dupes = groups.filter(g => g.ids.length >= 2);
      for (const d of dupes) {
        const ids = d.ids.slice(0, 5);
        await Comment.updateMany(
          { _id: { $in: ids } },
          { $set: { flag_type: 'spam_repetition', flag_evidence: { duplicates: d.ids.length, sample: d.content.substring(0, 80) } } }
        );
      }
    }

    // Spam: Link-first — skip deleted/hidden
    const firstComments = await Comment.aggregate([
      { $match: { created_at: { $gte: twentyFourHAgo }, deleted: false, hidden: false, flag_type: null } },
      { $sort: { author_id: 1, created_at: 1 } },
      { $group: { _id: '$author_id', first: { $first: '$$ROOT' } } },
      { $match: { 'first.content': { $regex: /https?:\/\// } } },
    ]);
    for (const f of firstComments) {
      await Comment.findByIdAndUpdate(f.first._id, {
        $set: { flag_type: 'spam_link_first', flag_evidence: { url_count: (f.first.content.match(/https?:\/\//g) || []).length } },
      });
    }

    // Brigade: Referrer analysis — skip deleted/hidden
    const brigadeReferrer = await Comment.aggregate([
      { $match: { created_at: { $gte: oneHourAgo }, deleted: false, hidden: false } },
      { $lookup: { from: 'pagevisits', let: { fp: '$author_id' }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$fingerprint', '$$fp'] }, { $ne: ['$referer', null] }, { $ne: ['$referer', ''] }] } } },
        { $sort: { created_at: -1 } }, { $limit: 1 }, { $project: { referer: 1 } },
      ], as: 'visit' } },
      { $unwind: { path: '$visit', preserveNullAndEmptyArrays: false } },
      { $group: { _id: { post_id: '$post_id', referer: '$visit.referer' }, commenters: { $addToSet: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 5 }, _id: { $ne: null } } },
    ]);
    for (const b of brigadeReferrer) {
      const commentIds = b.commenters;
      await Comment.updateMany(
        { _id: { $in: commentIds }, flag_type: null },
        { $set: { flag_type: 'brigade_referrer', flag_evidence: { referer: b._id.referer, count: b.count } } }
      );
    }

    // Brigade: Fresh fingerprints — skip deleted/hidden
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const freshUsers = await User.find({ created_at: { $gte: oneDayAgo } }).select('user_id').lean();
    const freshUserIds = new Set(freshUsers.map((u: Record<string, unknown>) => u.user_id as string));

    const brigadeFresh = await Comment.aggregate([
      { $match: { created_at: { $gte: oneHourAgo }, deleted: false, hidden: false, flag_type: null } },
      { $group: { _id: '$post_id', commenters: { $addToSet: '$author_id' }, total: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { total: { $gte: 8 } } },
    ]);
    for (const b of brigadeFresh) {
      const freshCount = b.commenters.filter((uid: string) => freshUserIds.has(uid)).length;
      const freshPct = freshCount / b.total;
      if (freshPct >= 0.6) {
        await Comment.updateMany(
          { _id: { $in: b.ids }, flag_type: null },
          { $set: { flag_type: 'brigade_fresh', flag_evidence: { total_commenters: b.total, fresh_commenters: freshCount, fresh_pct: Math.round(freshPct * 100) } } }
        );
      }
    }

    console.log(`[FlagEngine] Run complete`);
  } catch (err) { console.error('[FlagEngine] Error:', (err as Error).message); }
}

function levenshteinSimilarity(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= la; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= lb; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1] ? matrix[i - 1][j - 1] : Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]) + 1;
    }
  }
  return 1 - matrix[la][lb] / Math.max(la, lb);
}

let cronHandle: NodeJS.Timeout | null = null;

export function startFlagCron(): void {
  if (cronHandle) return;
  runFlagDetection();
  cronHandle = setInterval(runFlagDetection, 60 * 1000);
  console.log('[FlagEngine] Cron started (every 60s)');
}

export function stopFlagCron(): void {
  if (cronHandle) { clearInterval(cronHandle); cronHandle = null; }
}
