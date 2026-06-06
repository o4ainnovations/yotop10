'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { API, PostSubmission, PostSubmissionResponse, TitleCheckResponse } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/dates';

const DRAFT_KEY = 'yotop10_submit_draft';
const DEBOUNCE_MS = 500;
const DRAFT_EXPIRY_MS = 3600000; // 1 hour
const MIN_ITEMS = 3;
const MAX_ITEMS = 100;

const RANKING_KEYWORDS = /\b(top|best|worst|greatest|most|least|finest|favorite|iconic|legendary|essential|influential|underrated|overrated|controversial|important|hidden|all.time|must.know|must.see|must.read|must.watch)\b/i;

function validateListTitle(title: string): { valid: boolean; code?: string; error?: string; number?: number } {
  if (!title) return { valid: false, code: 'NO_NUMBER', error: 'Title must specify a list size like "Top 10" or "Best 5"' };
  const numberMatch = title.match(/\b(\d{1,3})\b/);
  if (!numberMatch) return { valid: false, code: 'NO_NUMBER', error: 'Title must specify a list size like "Top 10" or "Best 5"' };
  const listNumber = parseInt(numberMatch[1], 10);
  if (listNumber < 3) return { valid: false, code: 'NUMBER_TOO_SMALL', error: 'Minimum list size is 3. Use 3-100.', number: listNumber };
  if (listNumber > 100) return { valid: false, code: 'NUMBER_TOO_LARGE', error: 'Maximum list size is 100. Use 3-100.', number: listNumber };
  const numberIndex = title.search(/\b\d{1,3}\b/);
  const searchStart = Math.max(0, numberIndex - 20);
  const searchEnd = Math.min(title.length, numberIndex + 20);
  const contextWindow = title.substring(searchStart, searchEnd);
  if (!RANKING_KEYWORDS.test(contextWindow)) return { valid: false, code: 'NO_RANKING_KEYWORD', error: 'Title must indicate a ranked list (e.g., Top 10, Best 5, 10 Greatest)', number: listNumber };
  return { valid: true, number: listNumber };
}

interface ListItem {
  id: string;
  rank: number;
  title: string;
  justification: string;
  source_url: string;
  image_url: string;
}

interface FormErrors {
  category?: string;
  title?: string;
  intro?: string;
  items?: string;
  author_display_name?: string;
  titleSimilarity?: string;
}

interface DraftData {
  category_slug?: string;
  title?: string;
  intro?: string;
  format?: 'list_only' | 'hero_list' | 'full_list';
  hero_image_url?: string;
  items?: Array<{ title: string; justification: string; source_url: string; image_url: string }>;
  author_display_name?: string;
  savedAt: number;
}

const debounce = <T extends unknown[]>(fn: (...args: T) => void, ms: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

export default function SubmitClient() {
  const idCounter = useRef(0);
  const generateId = () => `item-${++idCounter.current}`;

  // Form state
  const [categorySlug, setCategorySlug] = useState('');
  const [title, setTitle] = useState('Top 10 ');
  const [intro, setIntro] = useState('');
  const [postFormat, setPostFormat] = useState<'list_only' | 'hero_list' | 'full_list'>('list_only');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [items, setItems] = useState<ListItem[]>([
    { id: generateId(), rank: 1, title: '', justification: '', source_url: '', image_url: '' },
    { id: generateId(), rank: 2, title: '', justification: '', source_url: '', image_url: '' },
    { id: generateId(), rank: 3, title: '', justification: '', source_url: '', image_url: '' },
  ]);
  const [authorName, setAuthorName] = useState('');

  const formDataRef = useRef({ categorySlug, title, intro, postFormat, heroImageUrl, items, authorName });
  formDataRef.current = { categorySlug, title, intro, postFormat, heroImageUrl, items, authorName };

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // UI state
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string; icon?: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [titleCheck, setTitleCheck] = useState<{
    checking: boolean;
    allowed: boolean;
    blocked: boolean;
    warning: boolean;
    matches: Array<{ title: string; slug: string }>;
    pendingConflicts: Array<{ title: string; submitted_at: string }>;
    suggestion?: string;
  } | null>(null);

  // Success state
  const [submitted, setSubmitted] = useState<{
    title: string;
    id: string;
    status: string;
    itemCount: number;
    username?: string;
  } | null>(null);

  // Load categories on mount
  useEffect(() => {
    API.getCategories()
      .then(data => {
        setCategories((data as { categories?: Array<{ id: string; name: string; slug: string; icon?: string }> }).categories || []);
      })
      .catch(err => console.error('Failed to load categories:', err));
  }, []);

  // Restore draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const data: DraftData = JSON.parse(draft);
        if (Date.now() - data.savedAt < DRAFT_EXPIRY_MS) {
          if (data.category_slug) setCategorySlug(data.category_slug);
          if (data.title) setTitle(data.title);
          if (data.intro) setIntro(data.intro);
          if (data.format) setPostFormat(data.format);
          if (data.hero_image_url) setHeroImageUrl(data.hero_image_url);
          if (data.items && data.items.length > 0) {
            const restored = data.items.map((item, idx) => ({
              id: generateId(),
              rank: idx + 1,
              title: item.title || '',
              justification: item.justification || '',
              source_url: item.source_url || '',
              image_url: item.image_url || '',
            }));
            while (restored.length < MIN_ITEMS) {
              restored.push({ id: generateId(), rank: restored.length + 1, title: '', justification: '', source_url: '', image_url: '' });
            }
            setItems(restored);
          }
          if (data.author_display_name) setAuthorName(data.author_display_name);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to restore draft:', e);
    }
  }, []);

  // Save draft (debounced via ref to avoid stale closures)
  const saveDraft = useCallback(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const { categorySlug: cat, title: t, intro: i, postFormat: fmt, heroImageUrl: hero, items: it, authorName: a } = formDataRef.current;
      if (!t && !i && !it.some(item => item.title || item.justification) && !a) return;
      const draft: DraftData = {
        category_slug: cat || undefined,
        title: t || undefined,
        intro: i || undefined,
        format: fmt,
        hero_image_url: hero || undefined,
        items: it.map(({ title, justification, source_url, image_url }) => ({ title, justification, source_url, image_url })),
        author_display_name: a || undefined,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 1000);
  }, []);

  useEffect(() => {
    saveDraft();
  }, [categorySlug, title, intro, postFormat, heroImageUrl, items, authorName, saveDraft]);

  // Flush draft synchronously on tab close / unload (bypasses debounce)
  useEffect(() => {
    const flushDraftSync = () => {
      const { categorySlug: cat, title: t, intro: i, postFormat: fmt, heroImageUrl: hero, items: it, authorName: a } = formDataRef.current;
      if (!t && !i && !it.some(item => item.title || item.justification) && !a) return;
      const draft: DraftData = {
        category_slug: cat || undefined,
        title: t || undefined,
        intro: i || undefined,
        format: fmt,
        hero_image_url: hero || undefined,
        items: it.map(({ title, justification, source_url, image_url }) => ({ title, justification, source_url, image_url })),
        author_display_name: a || undefined,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    };
    window.addEventListener('beforeunload', flushDraftSync);
    return () => window.removeEventListener('beforeunload', flushDraftSync);
  }, []);

  // Scroll to first error after React re-renders with aria-invalid attributes
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const firstErrorField = document.querySelector('[aria-invalid="true"]') as HTMLElement;
      if (firstErrorField) firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkTitleSimilarity = useCallback(
    debounce(async (titleValue: string, catId: string) => {
      if (titleValue.length < 8 || !catId) {
        setTitleCheck(null);
        return;
      }

      setTitleCheck(prev => prev ? { ...prev, checking: true } : { checking: true, allowed: true, blocked: false, warning: false, matches: [], pendingConflicts: [] });

      try {
        const response = await API.checkTitle(titleValue, catId) as TitleCheckResponse;
        setTitleCheck({
          checking: false,
          allowed: response.allowed,
          blocked: response.blocked,
          warning: response.warning,
          matches: response.matches || [],
          pendingConflicts: response.pending_conflicts || [],
          suggestion: response.suggestion,
        });
      } catch (err) {
        console.error('Title check failed:', err);
        setTitleCheck(prev => prev ? { ...prev, checking: false } : null);
      }
    }, DEBOUNCE_MS),
    []
  );

  // Client-side validation
  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'category':
        return !value ? 'Please select a category' : undefined;
      case 'title':
        if (!value) return 'Title is required';
        if (value.length < 8) return 'Title must be at least 8 characters';
        if (value.length > 300) return 'Title must be less than 300 characters';
        const format = validateListTitle(value);
        if (!format.valid) return format.error;
        return undefined;
      case 'intro':
        if (!value) return 'Introduction is required';
        if (value.length > 2000) return 'Introduction must be less than 2000 characters';
        return undefined;
      case 'author_display_name':
        if (value && value.length > 50) return 'Name must be less than 50 characters';
        return undefined;
      default:
        return undefined;
    }
  };

  const validateItems = (): string | undefined => {
    if (items.length < MIN_ITEMS) return `At least ${MIN_ITEMS} items are required`;

    for (let i = 0; i < items.length; i++) {
      if (!items[i].title.trim()) return `Item #${i + 1}: Title is required (max 200 chars)`;
      if (items[i].title.length > 200) return `Item #${i + 1}: Title must be less than 200 characters`;
      if (!items[i].justification.trim()) return `Item #${i + 1}: Justification is required (max 2000 chars)`;
      if (items[i].justification.length > 2000) return `Item #${i + 1}: Justification must be less than 2000 characters`;
      if (items[i].source_url && !isValidUrl(items[i].source_url)) {
        return `Item #${i + 1}: Please enter a valid URL`;
      }
    }
    return undefined;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const categoryError = validateField('category', categorySlug);
    if (categoryError) newErrors.category = categoryError;

    const titleError = validateField('title', title);
    if (titleError) newErrors.title = titleError;

    const introError = validateField('intro', intro);
    if (introError) newErrors.intro = introError;

    const itemsError = validateItems();
    if (itemsError) newErrors.items = itemsError;

    const authorError = validateField('author_display_name', authorName);
    if (authorError) newErrors.author_display_name = authorError;

    // Title similarity check
    if (titleCheck?.blocked) {
      newErrors.titleSimilarity = 'This list already exists. Please choose a different title.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle category change
  const handleCategoryChange = (value: string) => {
    setCategorySlug(value);
    setErrors(prev => ({ ...prev, category: undefined }));

    if (title.length >= 8 && value) {
      checkTitleSimilarity(title, value);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setErrors(prev => ({ ...prev, title: undefined, titleSimilarity: undefined }));

    const formatResult = validateListTitle(value);
    if (!formatResult.valid) {
      setTitleCheck(null);
      return;
    }

    if (value.length >= 8 && categorySlug) {
      checkTitleSimilarity(value, categorySlug);
    } else {
      setTitleCheck(null);
    }
  };

  // Item management
  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems(prev => [
      ...prev,
      { id: generateId(), rank: prev.length + 1, title: '', justification: '', source_url: '', image_url: '' }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= MIN_ITEMS) return;
    if (!confirm('Remove this item?')) return;
    setItems(prev => prev.filter(item => item.id !== id).map((item, idx) => ({ ...item, rank: idx + 1 })));
  };

  const updateItem = (id: string, field: string, value: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
    if (field === 'title' || field === 'justification') {
      setErrors(prev => ({ ...prev, items: undefined }));
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    const submission: PostSubmission = {
      title,
      post_type: 'top_list',
      intro,
      category_slug: categorySlug,
      items: items.map((item, idx) => ({
        rank: idx + 1,
        title: item.title,
        justification: item.justification,
        image_url: item.image_url || undefined,
        source_url: item.source_url || undefined,
      })),
      author_display_name: authorName || undefined,
      format: postFormat,
      hero_image_url: heroImageUrl || undefined,
    };

    try {
      const response = await API.addPost(submission) as PostSubmissionResponse & { post?: { title: string; id: string; status: string }; items?: Array<{ id: string }> };

      // Clear draft
      localStorage.removeItem(DRAFT_KEY);

      const authUser = useAuthStore.getState().user;
      const username = authUser?.username || '';

      setSubmitted({
        title: response.post?.title || title,
        id: response.post?.id || '',
        status: response.post?.status || 'pending_review',
        itemCount: response.items?.length || items.length,
        username,
      });
      toast.success('Post submitted! It\'s now pending review.');
    } catch (err: unknown) {
      console.error('Submit failed:', err);

      // Try to parse field errors from response
      const errorText = err instanceof Error ? err.message : '';
      if (errorText.includes('409') || errorText.includes('already exists')) {
        setErrors({ titleSimilarity: 'This list already exists. Please choose a different title.' });
      } else if (errorText.includes('429')) {
        setErrors({ title: 'Rate limit exceeded. Please try again later.' });
      } else {
        setErrors({ title: 'Failed to submit post. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──
  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-green-500/30 bg-white/5 p-6 text-center backdrop-blur-sm sm:p-10">
          <h1 className="mb-3 flex items-center justify-center gap-2 text-2xl font-bold text-green-400">
            <Icon name="Check" size={24} color="#4ade80" /> Post submitted!
          </h1>
          <p className="mb-4 text-base text-white sm:text-lg">Your list is now pending review by our admin team.</p>

          <div className="my-6 rounded-xl bg-white/5 p-5 text-left">
            <p className="text-white"><strong className="text-white">Title:</strong> {submitted.title}</p>
            <p className="text-white"><strong className="text-white">Status:</strong>{' '}
              <span className="inline-block rounded-lg bg-orange-500/10 px-2 py-0.5 text-sm text-orange-400">Pending Review</span>
            </p>
            <p className="text-white"><strong className="text-white">Items:</strong> {submitted.itemCount} items submitted</p>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {submitted.username && (
              <Link
                href={`/a/${submitted.username.replace(/^a_/, '')}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
              >
                View My Profile
              </Link>
            )}
            <button
              onClick={() => {
                setSubmitted(null);
                setTitle('Top 10 ');
                setIntro('');
                setPostFormat('list_only');
                setHeroImageUrl('');
                setItems([{ id: generateId(), rank: 1, title: '', justification: '', source_url: '', image_url: '' },
                          { id: generateId(), rank: 2, title: '', justification: '', source_url: '', image_url: '' },
                          { id: generateId(), rank: 3, title: '', justification: '', source_url: '', image_url: '' }]);
                setAuthorName('');
                localStorage.removeItem(DRAFT_KEY);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
            >
              Submit Another Post
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
            >
              Go to Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Dynamic title input border classes ──
  const titleInputBorder = (() => {
    if (errors.title || errors.titleSimilarity) return 'border-red-400 border-2';
    if (titleCheck?.blocked) return 'border-red-400 border-2';
    if (titleCheck?.warning) return 'border-orange-400 border-2';
    if (titleCheck?.allowed) return 'border-green-400 border-2';
    return 'border-white/10 focus:border-orange-500/50';
  })();

  const introBorder = errors.intro ? 'border-red-400 border-2' : 'border-white/10 focus:border-orange-500/50';

  const authorBorder = errors.author_display_name ? 'border-red-400 border-2' : 'border-white/10 focus:border-orange-500/50';

  const selectBaseClasses = 'w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-orange-500/50 focus:outline-none';

  const categorySelectBorder = errors.category ? 'border-red-400 border-2' : 'border-white/10 focus:border-orange-500/50';

  // ── Main form ──
  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Submit a Top 10 List</h1>
        <p className="mt-1 text-sm text-zinc-400 sm:text-base">Share your ranked list with the world. No account required.</p>
        <nav className="mt-3">
          <Link href="/" className="text-sm text-orange-400 transition hover:text-orange-300">
            &larr; Back to Feed
          </Link>
        </nav>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        {/* Step 1: Basic Info */}
        <section className="mb-8">
          <h2 className="mb-5 border-b border-white/5 pb-3 text-lg font-bold text-white">Basic Information</h2>

          {/* Category */}
          <div className="mb-5">
            <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Category <span className="text-orange-400" aria-label="required">*</span>
            </label>
            <div className="relative">
              <select
                id="category"
                value={categorySlug}
                onChange={(e) => handleCategoryChange(e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.category}
                aria-describedby={errors.category ? 'category-error' : 'category-help'}
                className={`${selectBaseClasses} pr-10 ${categorySelectBorder}`}
              >
                <option value="">Select a category...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Icon name="ChevronDown" size={16} className="text-zinc-500" />
              </div>
            </div>
            <div id="category-help" className="mt-1.5 text-xs text-zinc-500">Choose exactly one category for your list</div>
            {errors.category && (
              <div id="category-error" role="alert" className="mt-1.5 text-sm text-red-400">{errors.category}</div>
            )}
          </div>

          {/* Title */}
          <div className="mb-5">
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Title <span className="text-orange-400" aria-label="required">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => {
                const error = validateField('title', title);
                if (error) setErrors(prev => ({ ...prev, title: error }));
              }}
              maxLength={300}
              aria-required="true"
              aria-invalid={!!errors.title || !!errors.titleSimilarity}
              aria-describedby={errors.title || errors.titleSimilarity ? 'title-error' : 'title-help'}
              className={`w-full rounded-xl bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none ${titleInputBorder}`}
            />
            <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
              <span id="title-help" className="flex items-center gap-1.5">
                {title.length < 8 ? 'At least 8 characters for similarity check' : 'Title ready for check'}
                {titleCheck?.checking && <><Icon name="Hourglass" size={14} /> Checking...</>}
                {titleCheck?.allowed && !titleCheck.blocked && <span className="flex items-center gap-1 text-green-400"><Icon name="Check" size={14} color="#4ade80" /> Title available</span>}
                {titleCheck?.warning && <span className="flex items-center gap-1 text-orange-400"><Icon name="TriangleAlert" size={14} color="#f97316" /> Similar titles found</span>}
                {titleCheck?.blocked && <span className="flex items-center gap-1 text-red-400"><Icon name="X" size={14} color="#f87171" /> This title is blocked</span>}
                {titleCheck?.pendingConflicts && titleCheck.pendingConflicts.length > 0 && <span className="flex items-center gap-1 text-orange-400"><Icon name="Hourglass" size={14} /> Already pending review</span>}
              </span>
              <span className={title.length > 240 ? 'text-orange-400' : title.length > 285 ? 'text-red-400' : 'text-zinc-500'}>
                {title.length}/300
              </span>
            </div>
            {(errors.title || errors.titleSimilarity) && (
              <div id="title-error" role="alert" className="mt-2 text-sm text-red-400">
                {errors.title || errors.titleSimilarity}
                {titleCheck?.matches && titleCheck.matches.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-zinc-400">Similar lists:</p>
                    <ul className="ml-5 list-disc">
                      {titleCheck.matches.map((match, idx) => (
                        <li key={idx} className="text-zinc-400">{match.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {titleCheck?.pendingConflicts && titleCheck.pendingConflicts.length > 0 && (
                  <div className="mt-3 rounded-lg bg-orange-500/10 p-3 text-sm">
                    <strong className="flex items-center gap-1.5 text-white"><Icon name="Hourglass" size={14} /> This title is already pending review:</strong>
                    <ul className="ml-5 mt-1 list-disc">
                      {titleCheck.pendingConflicts.map((pc, idx) => (
                        <li key={idx} className="text-zinc-400">
                          {pc.title}
                          <span className="ml-2 text-xs text-zinc-500">
                            (submitted <span suppressHydrationWarning>{formatDate(pc.submitted_at)}</span>)
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-orange-400">
                      You can still submit, but the first to be approved claims the title.
                    </p>
                  </div>
                )}
                {titleCheck?.suggestion && (
                  <p className="mt-1.5 text-zinc-400">Try: <strong className="text-white">{titleCheck.suggestion}</strong></p>
                )}
              </div>
            )}
          </div>

          {/* Intro */}
          <div className="mb-5">
            <label htmlFor="intro" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Introduction <span className="text-orange-400" aria-label="required">*</span>
            </label>
            <textarea
              id="intro"
              value={intro}
              onChange={(e) => { setIntro(e.target.value); setErrors(prev => ({ ...prev, intro: undefined })); }}
              onBlur={() => {
                const error = validateField('intro', intro);
                if (error) setErrors(prev => ({ ...prev, intro: error }));
              }}
              maxLength={2000}
              rows={4}
              placeholder="Briefly explain what this list is about and why it matters"
              aria-required="true"
              aria-invalid={!!errors.intro}
              aria-describedby={errors.intro ? 'intro-error' : 'intro-help'}
              className={`w-full resize-y rounded-xl bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none ${introBorder}`}
            />
            <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
              <span id="intro-help">Explain what your list is about</span>
              <span className={intro.length > 1600 ? 'text-orange-400' : intro.length > 1900 ? 'text-red-400' : 'text-zinc-500'}>
                {intro.length}/2000
              </span>
            </div>
            {errors.intro && (
              <div id="intro-error" role="alert" className="mt-1.5 text-sm text-red-400">{errors.intro}</div>
            )}
          </div>
        </section>

        {/* Layout Format */}
        <section className="mb-8">
          <h2 className="mb-5 border-b border-white/5 pb-3 text-lg font-bold text-white">Layout Format</h2>

          <div className="mb-5">
            <label htmlFor="format" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Post Layout
            </label>
            <div className="relative">
              <select
                id="format"
                value={postFormat}
                onChange={(e) => setPostFormat(e.target.value as 'list_only' | 'hero_list' | 'full_list')}
                className={`${selectBaseClasses} pr-10`}
              >
                <option value="list_only">List Only — text items, no images</option>
                <option value="hero_list">Hero + List — hero banner top, items with images</option>
                <option value="full_list">Full List — hero banner + all items have images</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Icon name="ChevronDown" size={16} className="text-zinc-500" />
              </div>
            </div>
          </div>

          {(postFormat === 'hero_list' || postFormat === 'full_list') && (
            <div className="mb-5">
              <label htmlFor="hero-image" className="mb-1.5 block text-sm font-medium text-zinc-400">
                Hero Banner Image
              </label>
              <input
                id="hero-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setErrors(prev => ({ ...prev, titleSimilarity: undefined }));
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.INTERNAL_API_URL || 'http://localhost:8000');
                    const res = await fetch(`${baseUrl}/api/upload`, {
                      method: 'POST',
                      body: formData,
                      credentials: 'include',
                    });
                    if (!res.ok) throw new Error('Upload failed');
                    const data = await res.json() as { file: { hero_lg: string; item_thumb: string; original: string } };
                    setHeroImageUrl(data.file.hero_lg);
                  } catch {
                    setErrors(prev => ({ ...prev, titleSimilarity: 'Image upload failed. Try a smaller file.' }));
                  }
                }}
                className="w-full text-sm text-zinc-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-300 file:transition hover:file:bg-white/20"
              />
              {heroImageUrl && (
                <div className="mt-2">
                  <Image src={heroImageUrl} alt="Hero preview" width={400} height={200} unoptimized className="h-auto max-h-[200px] max-w-[400px] rounded-lg border border-white/5" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 2: List Items */}
        <section className="mb-8">
          <h2 className="mb-5 border-b border-white/5 pb-3 text-lg font-bold text-white">List Items</h2>
          <p className="mb-4 text-sm text-zinc-400">Add at least 3 items (max 100). Each item needs a title and justification.</p>

          {items.map((item) => (
            <fieldset key={item.id} className="mb-4 rounded-xl border border-white/5 p-3 sm:p-4">
              <legend className="px-2 text-sm font-bold text-white">Item #{item.rank}</legend>

              <div className="mb-3">
                <label htmlFor={`item-title-${item.id}`} className="mb-1.5 block text-sm font-medium text-zinc-400">
                  Title <span className="text-orange-400" aria-label="required">*</span>
                </label>
                <input
                  id={`item-title-${item.id}`}
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                  placeholder="e.g., Albert Einstein"
                  maxLength={200}
                  aria-required="true"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              <div className="mb-3">
                <label htmlFor={`item-justification-${item.id}`} className="mb-1.5 block text-sm font-medium text-zinc-400">
                  Justification <span className="text-orange-400" aria-label="required">*</span>
                </label>
                <textarea
                  id={`item-justification-${item.id}`}
                  value={item.justification}
                  onChange={(e) => updateItem(item.id, 'justification', e.target.value)}
                  placeholder={`This is rank #${item.rank} because...`}
                  maxLength={2000}
                  rows={3}
                  aria-required="true"
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              <div className="mb-3">
                <label htmlFor={`item-source-${item.id}`} className="mb-1.5 block text-sm text-zinc-400">
                  Source URL (optional)
                </label>
                <input
                  id={`item-source-${item.id}`}
                  type="url"
                  value={item.source_url}
                  onChange={(e) => updateItem(item.id, 'source_url', e.target.value)}
                  placeholder="Paste article, video, or profile link"
                  aria-label="Source URL (optional)"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              {(postFormat === 'hero_list' || postFormat === 'full_list') && (
                <div className="mb-3">
                  <label htmlFor={`item-image-${item.id}`} className="mb-1.5 block text-sm text-zinc-400">
                    Item Image (optional)
                  </label>
                  <input
                    id={`item-image-${item.id}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const baseUrl = typeof window !== 'undefined' ? '' : (process.env.INTERNAL_API_URL || 'http://localhost:8000');
                        const res = await fetch(`${baseUrl}/api/upload`, {
                          method: 'POST',
                          body: formData,
                          credentials: 'include',
                        });
                        if (!res.ok) throw new Error('Upload failed');
                        const data = await res.json() as { file: { item_thumb: string; original: string; hero_lg: string } };
                        updateItem(item.id, 'image_url', data.file.item_thumb);
                      } catch {
                        /* upload failed — silently ignore */
                      }
                    }}
                    className="w-full text-sm text-zinc-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-300 file:transition hover:file:bg-white/20"
                  />
                  {item.image_url && (
                    <div className="mt-1.5">
                      <Image src={item.image_url} alt="Item preview" width={150} height={100} unoptimized className="h-auto max-h-[100px] max-w-[150px] rounded-lg border border-white/5" />
                    </div>
                  )}
                </div>
              )}

              {items.length > MIN_ITEMS && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove item #${item.rank}`}
                  className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600/80"
                >
                  Remove
                </button>
              )}
            </fieldset>
          ))}

          {errors.items && (
            <div role="alert" className="mb-3 text-sm text-red-400">{errors.items}</div>
          )}

          <button
            type="button"
            onClick={addItem}
            disabled={items.length >= MAX_ITEMS}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add Item ({items.length}/{MAX_ITEMS})
          </button>
        </section>

        {/* Step 3: Author */}
        <section className="mb-8">
          <h2 className="mb-5 border-b border-white/5 pb-3 text-lg font-bold text-white">Author Information</h2>

          <div className="mb-5">
            <label htmlFor="author" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Display Name (optional)
            </label>
            <input
              id="author"
              type="text"
              value={authorName}
              onChange={(e) => { setAuthorName(e.target.value); setErrors(prev => ({ ...prev, author_display_name: undefined })); }}
              maxLength={50}
              placeholder="Leave blank for auto-generated username (e.g., a_9Gh7)"
              aria-label="Display name (optional)"
              aria-invalid={!!errors.author_display_name}
              aria-describedby={errors.author_display_name ? 'author-error' : 'author-help'}
              className={`w-full rounded-xl bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none ${authorBorder}`}
            />
            <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
              <span id="author-help">Customize your display name (auto-generated if blank)</span>
              <span>{authorName.length}/50</span>
            </div>
            {errors.author_display_name && (
              <div id="author-error" role="alert" className="mt-1.5 text-sm text-red-400">{errors.author_display_name}</div>
            )}
          </div>
        </section>

        {/* Error Summary */}
        {Object.keys(errors).length > 0 && (
          <div role="alert" aria-live="assertive" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <strong className="text-red-400">Please fix the following:</strong>
            <ul className="ml-5 mt-2 list-disc">
              {Object.values(errors).map((error, idx) => (
                <li key={idx} className="mb-1 text-sm text-white">{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !categorySlug || !title || !intro || items.some(i => !i.title || !i.justification)}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>

      <footer className="mt-10 border-t border-white/5 pt-6 text-center text-sm text-zinc-500">
        <p>YoTop10 — Open Platform for Top 10 Lists</p>
      </footer>
    </div>
  );
}
