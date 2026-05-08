'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { API, PostSubmission, PostSubmissionResponse, TitleCheckResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/lib/toast';

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
  items?: Array<{ title: string; justification: string; source_url: string }>;
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

export default function SubmitPage() {
  const idCounter = useRef(0);
  const generateId = () => `item-${++idCounter.current}`;

  // Form state
  const [categorySlug, setCategorySlug] = useState('');
  const [title, setTitle] = useState('Top 10 ');
  const [intro, setIntro] = useState('');
  const [items, setItems] = useState<ListItem[]>([
    { id: generateId(), rank: 1, title: '', justification: '', source_url: '' },
    { id: generateId(), rank: 2, title: '', justification: '', source_url: '' },
    { id: generateId(), rank: 3, title: '', justification: '', source_url: '' },
  ]);
  const [authorName, setAuthorName] = useState('');

  const formDataRef = useRef({ categorySlug, title, intro, items, authorName });
  formDataRef.current = { categorySlug, title, intro, items, authorName };

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
          if (data.items && data.items.length > 0) {
            const restored = data.items.map((item, idx) => ({
              id: generateId(),
              rank: idx + 1,
              title: item.title || '',
              justification: item.justification || '',
              source_url: item.source_url || '',
            }));
            while (restored.length < MIN_ITEMS) {
              restored.push({ id: generateId(), rank: restored.length + 1, title: '', justification: '', source_url: '' });
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
      const { categorySlug: cat, title: t, intro: i, items: it, authorName: a } = formDataRef.current;
      if (!t && !i && !it.some(item => item.title || item.justification) && !a) return;
      const draft: DraftData = {
        category_slug: cat || undefined,
        title: t || undefined,
        intro: i || undefined,
        items: it.map(({ title, justification, source_url }) => ({ title, justification, source_url })),
        author_display_name: a || undefined,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 1000);
  }, []);

  useEffect(() => {
    saveDraft();
  }, [categorySlug, title, intro, items, authorName, saveDraft]);

  // Flush draft synchronously on tab close / unload (bypasses debounce)
  useEffect(() => {
    const flushDraftSync = () => {
      const { categorySlug: cat, title: t, intro: i, items: it, authorName: a } = formDataRef.current;
      if (!t && !i && !it.some(item => item.title || item.justification) && !a) return;
      const draft: DraftData = {
        category_slug: cat || undefined,
        title: t || undefined,
        intro: i || undefined,
        items: it.map(({ title, justification, source_url }) => ({ title, justification, source_url })),
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
      { id: generateId(), rank: prev.length + 1, title: '', justification: '', source_url: '' }
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
        source_url: item.source_url || undefined,
      })),
      author_display_name: authorName || undefined,
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

  // Success state
  if (submitted) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ backgroundColor: '#f0f9f0', border: '1px solid #4caf50', borderRadius: '8px', padding: '30px', textAlign: 'center' }}>
          <h1 style={{ color: '#2e7d32' }}>✅ Post submitted!</h1>
          <p style={{ fontSize: '18px', margin: '10px 0' }}>Your list is now pending review by our admin team.</p>
          
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', margin: '20px 0', textAlign: 'left' }}>
            <p><strong>Title:</strong> {submitted.title}</p>
            <p><strong>Status:</strong> <span style={{ backgroundColor: '#fff3e0', padding: '2px 8px', borderRadius: '3px' }}>Pending Review</span></p>
            <p><strong>Items:</strong> {submitted.itemCount} items submitted</p>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            {submitted.username && (
              <Link 
                href={`/a/${submitted.username.replace(/^a_/, '')}`}
                style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#0066cc', color: 'white', textDecoration: 'none', borderRadius: '5px' }}
              >
                View My Profile
              </Link>
            )}
            <button 
              onClick={() => {
                setSubmitted(null);
                setTitle('');
                setIntro('');
                setItems([{ id: generateId(), rank: 1, title: '', justification: '', source_url: '' },
                          { id: generateId(), rank: 2, title: '', justification: '', source_url: '' },
                          { id: generateId(), rank: 3, title: '', justification: '', source_url: '' }]);
                setAuthorName('');
                localStorage.removeItem(DRAFT_KEY);
              }}
              style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              Submit Another Post
            </button>
            <Link 
              href="/"
              style={{ padding: '10px 20px', backgroundColor: '#666', color: 'white', textDecoration: 'none', borderRadius: '5px' }}
            >
              Go to Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1>Submit a Top 10 List</h1>
        <p style={{ color: '#666' }}>Share your ranked list with the world. No account required.</p>
        <nav style={{ marginTop: '10px' }}>
          <Link href="/">← Back to Feed</Link>
        </nav>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        {/* Step 1: Basic Info */}
        <section style={{ marginBottom: '30px' }}>
          <h2>Basic Information</h2>

          {/* Category */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="category" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Category <span aria-label="required" style={{ color: '#d32f2f' }}>*</span>
            </label>
            <select
              id="category"
              value={categorySlug}
              onChange={(e) => handleCategoryChange(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.category}
              aria-describedby={errors.category ? 'category-error' : 'category-help'}
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: errors.category ? '2px solid #d32f2f' : '1px solid #ccc', borderRadius: '5px' }}
            >
              <option value="">Select a category...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.slug}>
                  {cat.icon || '📁'} {cat.name}
                </option>
              ))}
            </select>
            <div id="category-help" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Choose exactly one category for your list</div>
            {errors.category && (
              <div id="category-error" role="alert" style={{ color: '#d32f2f', fontSize: '14px', marginTop: '5px' }}>{errors.category}</div>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="title" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Title <span aria-label="required" style={{ color: '#d32f2f' }}>*</span>
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
              style={{ 
                width: '100%', 
                padding: '10px', 
                fontSize: '16px', 
                border: errors.title || errors.titleSimilarity ? '2px solid #d32f2f' : 
                        titleCheck?.blocked ? '2px solid #d32f2f' :
                        titleCheck?.warning ? '2px solid #ff9800' :
                        titleCheck?.allowed ? '2px solid #4caf50' : '1px solid #ccc',
                borderRadius: '5px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '5px' }}>
              <span id="title-help">
                {title.length < 8 ? 'At least 8 characters for similarity check' : 'Title ready for check'}
                {titleCheck?.checking && ' ⏳ Checking...'}
                {titleCheck?.allowed && !titleCheck.blocked && ' ✅ Title available'}
                {titleCheck?.warning && ' ⚠️ Similar titles found'}
                {titleCheck?.blocked && ' ❌ This title is blocked'}
                {titleCheck?.pendingConflicts && titleCheck.pendingConflicts.length > 0 && ' ⏳ Already pending review'}
              </span>
              <span style={{ color: title.length > 240 ? '#ff9800' : title.length > 285 ? '#d32f2f' : '#666' }}>
                {title.length}/300
              </span>
            </div>
            {(errors.title || errors.titleSimilarity) && (
              <div id="title-error" role="alert" style={{ color: '#d32f2f', fontSize: '14px', marginTop: '5px' }}>
                {errors.title || errors.titleSimilarity}
                {titleCheck?.matches && titleCheck.matches.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <p>Similar lists:</p>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                      {titleCheck.matches.map((match, idx) => (
                        <li key={idx}>{match.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {titleCheck?.pendingConflicts && titleCheck.pendingConflicts.length > 0 && (
                  <div style={{ marginTop: '10px', background: '#fff3e0', padding: '8px 12px', borderRadius: '4px', fontSize: '13px' }}>
                    <strong>⏳ This title is already pending review:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                      {titleCheck.pendingConflicts.map((pc, idx) => (
                        <li key={idx}>
                          {pc.title}
                          <span style={{ color: '#888', fontSize: '11px', marginLeft: '8px' }}>
                            (submitted {new Date(pc.submitted_at).toLocaleDateString()})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p style={{ margin: '4px 0 0', color: '#e65100', fontSize: '11px' }}>
                      You can still submit, but the first to be approved claims the title.
                    </p>
                  </div>
                )}
                {titleCheck?.suggestion && (
                  <p style={{ marginTop: '5px' }}>Try: <strong>{titleCheck.suggestion}</strong></p>
                )}
              </div>
            )}
          </div>

          {/* Intro */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="intro" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Introduction <span aria-label="required" style={{ color: '#d32f2f' }}>*</span>
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
              style={{ 
                width: '100%', 
                padding: '10px', 
                fontSize: '16px', 
                border: errors.intro ? '2px solid #d32f2f' : '1px solid #ccc', 
                borderRadius: '5px',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '5px' }}>
              <span id="intro-help">Explain what your list is about</span>
              <span style={{ color: intro.length > 1600 ? '#ff9800' : intro.length > 1900 ? '#d32f2f' : '#666' }}>
                {intro.length}/2000
              </span>
            </div>
            {errors.intro && (
              <div id="intro-error" role="alert" style={{ color: '#d32f2f', fontSize: '14px', marginTop: '5px' }}>{errors.intro}</div>
            )}
          </div>
        </section>

        {/* Step 2: List Items */}
        <section style={{ marginBottom: '30px' }}>
          <h2>List Items</h2>
          <p style={{ color: '#666', marginBottom: '15px' }}>Add at least 3 items (max 100). Each item needs a title and justification.</p>

          {items.map((item) => (
            <fieldset key={item.id} style={{ border: '1px solid #ddd', borderRadius: '5px', padding: '15px', marginBottom: '15px' }}>
              <legend style={{ fontWeight: 'bold', padding: '0 10px' }}>Item #{item.rank}</legend>
              
              <div style={{ marginBottom: '10px' }}>
                <label htmlFor={`item-title-${item.id}`} style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Title <span aria-label="required" style={{ color: '#d32f2f' }}>*</span>
                </label>
                <input
                  id={`item-title-${item.id}`}
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                  placeholder="e.g., Albert Einstein"
                  maxLength={200}
                  aria-required="true"
                  style={{ width: '100%', padding: '8px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '5px' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label htmlFor={`item-justification-${item.id}`} style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Justification <span aria-label="required" style={{ color: '#d32f2f' }}>*</span>
                </label>
                <textarea
                  id={`item-justification-${item.id}`}
                  value={item.justification}
                  onChange={(e) => updateItem(item.id, 'justification', e.target.value)}
                  placeholder={`This is rank #${item.rank} because...`}
                  maxLength={2000}
                  rows={3}
                  aria-required="true"
                  style={{ width: '100%', padding: '8px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '5px', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label htmlFor={`item-source-${item.id}`} style={{ display: 'block', marginBottom: '5px', color: '#666' }}>
                  Source URL (optional)
                </label>
                <input
                  id={`item-source-${item.id}`}
                  type="url"
                  value={item.source_url}
                  onChange={(e) => updateItem(item.id, 'source_url', e.target.value)}
                  placeholder="Paste article, video, or profile link"
                  aria-label="Source URL (optional)"
                  style={{ width: '100%', padding: '8px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '5px' }}
                />
              </div>

              {items.length > MIN_ITEMS && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove item #${item.rank}`}
                  style={{ backgroundColor: '#d32f2f', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}
                >
                  Remove ✕
                </button>
              )}
            </fieldset>
          ))}

          {errors.items && (
            <div role="alert" style={{ color: '#d32f2f', fontSize: '14px', marginBottom: '10px' }}>{errors.items}</div>
          )}

          <button
            type="button"
            onClick={addItem}
            disabled={items.length >= MAX_ITEMS}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: items.length >= MAX_ITEMS ? '#ccc' : '#f0f0f0', 
              border: '1px solid #ccc', 
              borderRadius: '5px', 
              cursor: items.length >= MAX_ITEMS ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            + Add Item ({items.length}/{MAX_ITEMS})
          </button>
        </section>

        {/* Step 3: Author */}
        <section style={{ marginBottom: '30px' }}>
          <h2>Author Information</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="author" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
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
              style={{ 
                width: '100%', 
                padding: '10px', 
                fontSize: '16px', 
                border: errors.author_display_name ? '2px solid #d32f2f' : '1px solid #ccc', 
                borderRadius: '5px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '5px' }}>
              <span id="author-help">Customize your display name (auto-generated if blank)</span>
              <span>{authorName.length}/50</span>
            </div>
            {errors.author_display_name && (
              <div id="author-error" role="alert" style={{ color: '#d32f2f', fontSize: '14px', marginTop: '5px' }}>{errors.author_display_name}</div>
            )}
          </div>
        </section>

        {/* Error Summary */}
        {Object.keys(errors).length > 0 && (
          <div role="alert" aria-live="assertive" style={{ backgroundColor: '#ffebee', border: '1px solid #d32f2f', borderRadius: '5px', padding: '15px', marginBottom: '20px' }}>
            <strong>Please fix the following:</strong>
            <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
              {Object.values(errors).map((error, idx) => (
                <li key={idx} style={{ marginBottom: '5px' }}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !categorySlug || !title || !intro || items.some(i => !i.title || !i.justification)}
          style={{ 
            width: '100%', 
            padding: '15px', 
            fontSize: '18px',
            fontWeight: 'bold',
            backgroundColor: submitting ? '#ccc' : '#0066cc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px', 
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>

      <footer style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px', textAlign: 'center', color: '#666' }}>
        <p>YoTop10 - Open Platform for Top 10 Lists</p>
      </footer>
    </div>
  );
}
