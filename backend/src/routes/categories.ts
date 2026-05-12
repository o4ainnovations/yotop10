/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { Category } from '../models/Category';
import { Post } from '../models/Post';
import { adminAuthMiddleware } from '../lib/adminAuth';
import { logAudit } from '../lib/auditWriter';
import { getClientIp } from '../middleware/fingerprint';

const router: Router = Router();

// GET /api/categories — All categories with hierarchy
router.get('/', async (req: any, res: any) => {
  try {
    const { include_children = 'true' } = req.query;

    // Get all non-archived categories
    const categories = await Category.find({ is_archived: false })
      .sort({ name: 1 })
      .lean();

    if (include_children === 'true') {
      // Group into parent/children hierarchy
      const parents = categories.filter(c => !c.parent_id);
      const children = categories.filter(c => c.parent_id);

      const hierarchy = parents.map(parent => ({
        id: parent._id,
        name: parent.name,
        slug: parent.slug,
        description: parent.description,
        icon: parent.icon,
        post_count: parent.post_count,
        is_featured: parent.is_featured,
        children: children
          .filter(child => child.parent_id?.toString() === parent._id.toString())
          .map(child => ({
            id: child._id,
            name: child.name,
            slug: child.slug,
            description: child.description,
            icon: child.icon,
            post_count: child.post_count,
          })),
      }));

      res.json({ categories: hierarchy });
    } else {
      // Flat list
      res.json({ categories: categories.map(c => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        icon: c.icon,
        post_count: c.post_count,
        parent_id: c.parent_id,
      }))});
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ═══ Admin: Workflow ═══════════════════════════════════════════════

import { CategoryAudit } from '../models/CategoryAudit';

const logCatAudit = (categoryId: string, action: string, changes: Record<string, unknown>, username: string) => {
  CategoryAudit.create({ category_id: categoryId as any, action, changes, admin_username: username }).catch(() => {});
};

// Duplicate category
router.post('/:id/duplicate', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const newSlug = `${cat.slug}-copy-${Date.now().toString(36)}`;
    const copy = await Category.create({
      name: `${cat.name} (Copy)`, slug: newSlug, description: cat.description,
      icon: cat.icon, parent_id: cat.parent_id, post_count: 0,
      is_featured: false, is_archived: false, sort_order: cat.sort_order,
      status: 'draft', template: cat.template,
    });
    logCatAudit(req.params.id, 'duplicated', { to: { id: copy._id, slug: newSlug } }, req.admin?.username || 'admin');
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'duplicate_category', ip: getClientIp(req), metadata: { category_id: req.params.id, new_category_id: (copy._id as { toString(): string }).toString(), new_slug: newSlug }, user_agent: req.headers['user-agent'] || '' });
    res.status(201).json({ category: { id: copy._id, name: copy.name, slug: copy.slug } });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Publish category
router.post('/:id/publish', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, { status: 'published', publish_at: new Date() }, { new: true });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    logCatAudit(req.params.id, 'published', { from: cat.status, to: 'published' }, req.admin?.username || 'admin');
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'publish_category', ip: getClientIp(req), metadata: { category_id: req.params.id }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Hide category
router.post('/:id/hide', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, { status: 'hidden' }, { new: true });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    logCatAudit(req.params.id, 'hidden', { from: cat.status, to: 'hidden' }, req.admin?.username || 'admin');
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'hide_category', ip: getClientIp(req), metadata: { category_id: req.params.id }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ Admin: Analytics ═════════════════════════════════════════════

// All categories with health scores
router.get('/stats', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const cats = await Category.find({ is_archived: false }).sort({ sort_order: 1, name: 1 }).lean();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const healthScores = await Promise.all(cats.map(async (c) => {
      const [posts30d, postsPrev30d] = await Promise.all([
        Post.countDocuments({ category_slug: c.slug, status: 'approved', published_at: { $gte: thirtyDaysAgo } }),
        Post.countDocuments({ category_slug: c.slug, status: 'approved', published_at: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      ]);
      const avgPosts = Math.max(1, cats.reduce((s, cc) => s + cc.post_count, 0) / cats.length);
      return {
        _id: c._id, name: c.name, slug: c.slug, parent_id: c.parent_id,
        post_count: c.post_count, posts_30d: posts30d, posts_prev_30d: postsPrev30d,
        health_score: Math.round((posts30d / avgPosts) * 100) / 100,
        grown: posts30d > postsPrev30d,
        dead: c.post_count === 0, is_featured: c.is_featured, status: c.status, sort_order: c.sort_order,
      };
    }));

    res.json({ categories: healthScores });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Single category stats
router.get('/:id/stats', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const [postCount, pendingCount, approvedCount, topAuthors] = await Promise.all([
      Post.countDocuments({ category_slug: cat.slug, deleted: false }),
      Post.countDocuments({ category_slug: cat.slug, status: 'pending_review', deleted: false }),
      Post.countDocuments({ category_slug: cat.slug, status: 'approved', deleted: false }),
      Post.aggregate([
        { $match: { category_slug: cat.slug, status: 'approved', deleted: false } },
        { $group: { _id: '$author_username', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
      ]),
    ]);

    res.json({
      category: { id: cat._id, name: cat.name, slug: cat.slug },
      stats: { total: postCount, pending: pendingCount, approved: approvedCount },
      top_authors: topAuthors.map((a: Record<string, unknown>) => ({ username: a._id, posts: a.count })),
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Health overview — dead, overloaded, alive
router.get('/health', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    const [allCats, deadCats] = await Promise.all([
      Category.find({ is_archived: false }).lean(),
      Category.find({ is_archived: false, post_count: 0, created_at: { $lt: ninetyDaysAgo } }).lean(),
    ]);

    const parentCats = allCats.filter(c => !c.parent_id);
    const overloaded = parentCats.filter(p => {
      const total = allCats.reduce((s, c) => s + (c.parent_id?.toString() === p._id.toString() ? c.post_count : 0), 0) + p.post_count;
      const parentTotal = allCats.reduce((s, cc) => s + (!cc.parent_id ? cc.post_count : 0), 0) || 1;
      return total / parentTotal > 0.8;
    });

    res.json({
      total: allCats.length,
      dead: deadCats.map(c => ({ name: c.name, slug: c.slug, created_at: c.created_at })),
      overloaded: overloaded.map(c => ({ name: c.name, slug: c.slug, post_count: c.post_count })),
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Content distribution
router.get('/analytics', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const parents = await Category.find({ parent_id: null, is_archived: false }).lean();
    const distribution = await Promise.all(parents.map(async (p) => {
      const children = await Category.find({ parent_id: p._id, is_archived: false }).lean();
      const totalPosts = children.reduce((s, c) => s + c.post_count, 0) + p.post_count;
      return { name: p.name, slug: p.slug, post_count: p.post_count, children_count: children.length, total_posts: totalPosts };
    }));

    res.json({ distribution: distribution.sort((a, b) => b.total_posts - a.total_posts) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ Admin: Bulk Operations ═══════════════════════════════════════

router.post('/bulk/feature', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { ids, featured_in } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Provide category IDs' });
    const update: Record<string, unknown> = { is_featured: true };
    if (featured_in) update.featured_in = featured_in;
    const r = await Category.updateMany({ _id: { $in: ids } }, { $set: update });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'feature_categories', ip: getClientIp(req), metadata: { ids, count: r.modifiedCount, featured: true }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, updated: r.modifiedCount });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/bulk/archive', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Provide category IDs' });
    const affected = await Post.countDocuments({ category_slug: { $in: await Category.find({ _id: { $in: ids } }).distinct('slug') } });
    const r = await Category.updateMany({ _id: { $in: ids } }, { $set: { is_archived: true } });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'archive_categories', ip: getClientIp(req), metadata: { ids, archived: r.modifiedCount, affected_posts: affected }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, archived: r.modifiedCount, affected_posts: affected });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/bulk/merge', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { source_id, target_id } = req.body;
    if (!source_id || !target_id) return res.status(400).json({ error: 'Provide source_id and target_id' });
    const [source, target] = await Promise.all([Category.findById(source_id), Category.findById(target_id)]);
    if (!source || !target) return res.status(404).json({ error: 'Category not found' });

    await Post.updateMany({ category_slug: source.slug }, { $set: { category_slug: target.slug } });
    await Category.updateMany({ parent_id: source._id }, { $set: { parent_id: target._id } });
    source.is_archived = true;
    await source.save();

    logCatAudit(source_id, 'merged_into', { to: { id: target_id, slug: target.slug } }, req.admin?.username || 'admin');
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'merge_categories', ip: getClientIp(req), metadata: { source_id, target_id, target_slug: target.slug }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, posts_moved: await Post.countDocuments({ category_slug: target.slug }) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/bulk/reparent', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { ids, new_parent_id } = req.body;
    if (!Array.isArray(ids) || !new_parent_id) return res.status(400).json({ error: 'Provide ids and new_parent_id' });
    const r = await Category.updateMany({ _id: { $in: ids } }, { $set: { parent_id: new_parent_id } });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'reparent_categories', ip: getClientIp(req), metadata: { ids, new_parent_id, reparented: r.modifiedCount }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, reparented: r.modifiedCount });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/import', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories) || categories.length === 0) return res.status(400).json({ error: 'Provide categories array' });
    let created = 0, skipped = 0;
    for (const c of categories) {
      const exists = await Category.findOne({ slug: c.slug });
      if (exists) { skipped++; continue; }
      await Category.create({ name: c.name, slug: c.slug, description: c.description, icon: c.icon, parent_id: c.parent_id, is_featured: c.is_featured || false });
      created++;
    }
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'import_categories', ip: getClientIp(req), metadata: { created, skipped, total_input: categories.length }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, created, skipped });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/export', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const cats = await Category.find({}).sort({ parent_id: 1, sort_order: 1, name: 1 }).lean();
    const header = 'ID,Name,Slug,Description,Icon,ParentID,PostCount,Featured,Archived,Status,SortOrder\n';
    const rows = cats.map(c => [`"${c._id}"`, `"${(c.name || '').replace(/"/g, '""')}"`, c.slug, `"${(c.description || '').replace(/"/g, '""')}"`, c.icon || '', c.parent_id || '', c.post_count, c.is_featured, c.is_archived, c.status, c.sort_order].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="categories_export_${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send(header + rows);
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ Admin: Quality ═══════════════════════════════════════════════

router.get('/check-duplicate', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const name = req.query.name as string;
    if (!name) return res.status(400).json({ error: 'Provide name query param' });
    const cats = await Category.find({ is_archived: false }).select('name slug').lean();
    const matches = cats.filter(c => {
      const a = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const b = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const maxLen = Math.max(a.length, b.length, 1);
      const dist = [...a].filter((ch, i) => ch !== b[i]).length;
      return (1 - dist / maxLen) >= 0.8;
    });
    res.json({ matches: matches.slice(0, 10) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/orphans', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const allCats = await Category.find({}).lean();
    const archivedIds = new Set(allCats.filter(c => c.is_archived).map(c => c._id.toString()));
    const orphans = allCats.filter(c => c.parent_id && archivedIds.has(c.parent_id.toString()));
    res.json({ orphans: orphans.map(c => ({ _id: c._id, name: c.name, slug: c.slug, parent_id: c.parent_id })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id/audit', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const logs = await CategoryAudit.find({ category_id: req.params.id }).sort({ created_at: -1 }).limit(50).lean();
    res.json({ audit: logs });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ Public: Single Category ══════════════════════════════════════

// GET /api/categories/:slug — Single category by slug (supports nested slugs like "business/accounting-tax")
router.get('/:slug(*)', async (req: any, res: any) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ slug, is_archived: false }).lean();

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get children if it's a parent category
    const children: Array<{ _id: unknown; name: string; slug: string; description?: string; icon?: string; post_count: number }> = [];
    if (!category.parent_id) {
      const childDocs = await Category.find({ parent_id: category._id, is_archived: false })
        .sort({ name: 1 })
        .lean();
      childDocs.forEach(c => {
        children.push(c);
      });
    }

    res.json({
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        post_count: category.post_count,
        is_featured: category.is_featured,
        children: children.map(c => ({
          id: c._id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          post_count: c.post_count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// POST /api/categories — Create category (admin)
router.post('/', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { name, slug, description, icon, parent_id, is_featured } = req.body;

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check for duplicate
    const existing = await Category.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(400).json({ error: 'Category with this slug already exists' });
    }

    const category = await Category.create({
      name,
      slug: finalSlug,
      description,
      icon,
      parent_id,
      is_featured: is_featured || false,
      post_count: 0,
      is_archived: false,
    });

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'create_category', ip: getClientIp(req), metadata: { category_id: (category._id as { toString(): string }).toString(), name: category.name, slug: category.slug }, user_agent: req.headers['user-agent'] || '' });

    res.status(201).json({ category: { id: category._id, name: category.name, slug: category.slug } });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PATCH /api/categories/:id — Update category (admin)
router.patch('/:id', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, description, icon, is_featured } = req.body;

    const category = await Category.findByIdAndUpdate(
      id,
      { name, description, icon, is_featured },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'update_category', ip: getClientIp(req), metadata: { category_id: id, changes: { name, description, icon, is_featured } }, user_agent: req.headers['user-agent'] || '' });

    res.json({ category: { id: category._id, name: category.name, slug: category.slug } });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — Archive category (admin)
router.delete('/:id', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const escapedSlug = category.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const postsInHierarchy = await Post.countDocuments({
      category_slug: { $regex: `^${escapedSlug}` },
    });

    if (postsInHierarchy > 0) {
      return res.status(409).json({
        code: 'HAS_POSTS',
        error: `Cannot delete: ${postsInHierarchy} posts reference this category or its children.`,
        post_count: postsInHierarchy,
      });
    }

    category.is_archived = true;
    await category.save();

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'archive_category', ip: getClientIp(req), metadata: { category_id: id, name: category.name, slug: category.slug }, user_agent: req.headers['user-agent'] || '' });

    res.json({ message: 'Category archived successfully' });
  } catch (error) {
    console.error('Error archiving category:', error);
    res.status(500).json({ error: 'Failed to archive category' });
  }
});

// POST /api/categories/recalculate-post-counts — Recalculate post counts for all categories (maintenance)
router.post('/recalculate-post-counts', adminAuthMiddleware, async (req: any, res: any) => {
  try {
    // Get all categories
    const categories = await Category.find({ is_archived: false }).lean();
    const { Post } = await import('../models/Post');
    
    // Build parent-child map
    const childrenMap: Record<string, string[]> = {};
    categories.forEach(cat => {
      if (cat.parent_id) {
        const parentId = cat.parent_id.toString();
        if (!childrenMap[parentId]) {
          childrenMap[parentId] = [];
        }
        childrenMap[parentId].push(cat._id.toString());
      }
    });
    
    // Get all category IDs
    const categoryIds = categories.map(c => c._id.toString());
    
    // Count posts for each category
    const postCounts: Record<string, number> = {};
    for (const catId of categoryIds) {
      postCounts[catId] = await Post.countDocuments({ 
        category_id: catId, 
        status: 'approved' 
      });
    }
    
    // For parent categories, add children's post counts
    const parentCategories = categories.filter(c => !c.parent_id);
    const results = await Promise.all(parentCategories.map(async (parent) => {
      const directCount = postCounts[parent._id.toString()] || 0;
      
      // Sum up all children
      const childIds = childrenMap[parent._id.toString()] || [];
      const childrenCount = childIds.reduce((sum, childId) => {
        return sum + (postCounts[childId] || 0);
      }, 0);
      
      const totalCount = directCount + childrenCount;
      
      // Update the parent
      await Category.findByIdAndUpdate(parent._id, { post_count: totalCount });
      
      return { slug: parent.slug, directCount, childrenCount, totalCount };
    }));
    
    // Also update child categories with their direct counts
    const childCategories = categories.filter(c => c.parent_id);
    for (const child of childCategories) {
      const count = postCounts[child._id.toString()] || 0;
      await Category.findByIdAndUpdate(child._id, { post_count: count });
    }
    
    console.log('Recalculated post counts:', results);
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'recalculate_post_counts', ip: getClientIp(req), metadata: { categories_updated: parentCategories.length + childCategories.length, results }, user_agent: req.headers['user-agent'] || '' });
    res.json({ message: 'Post counts recalculated', results });
  } catch (error) {
    console.error('Error recalculating post counts:', error);
    res.status(500).json({ error: 'Failed to recalculate post counts' });
  }
});

export default router;
