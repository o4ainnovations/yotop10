import { Router, Request, Response } from 'express';
import { Category } from '../models/Category';

const router: Router = Router();

// GET /api/categories — All categories with hierarchy
router.get('/', async (req: Request, res: Response) => {
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

// GET /api/categories/:slug — Single category by slug (supports nested slugs like "business/accounting-tax")
router.get('/:slug(*)', async (req: Request, res: Response) => {
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
router.post('/', async (req: Request, res: Response) => {
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

    res.status(201).json({ category: { id: category._id, name: category.name, slug: category.slug } });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PATCH /api/categories/:id — Update category (admin)
router.patch('/:id', async (req: Request, res: Response) => {
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

    res.json({ category: { id: category._id, name: category.name, slug: category.slug } });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — Archive category (admin)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(
      id,
      { is_archived: true },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category archived successfully' });
  } catch (error) {
    console.error('Error archiving category:', error);
    res.status(500).json({ error: 'Failed to archive category' });
  }
});

export default router;
