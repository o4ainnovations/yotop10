import { Router } from 'express';

import authRouter from './auth';
import categoriesRouter from './categories';
import commentsRouter from './comments';
import fingerprintRouter from './fingerprint';
import identityRouter from './identity';
import listingsRouter from './listings';
import postsRouter from './posts';
import reactionsRouter from './reactions';
import reviewsRouter from './reviews';
import uploadRouter from './upload';
import searchRouter from './search';
import usersRouter from './users';
import articlesRouter from './articles';
import exploreRouter from './explore';
import adminRouter from './admin';

export interface RouteDefinition {
  path: string;
  router: Router;
  adminOnly?: boolean;
}

export const routes: RouteDefinition[] = [
  { path: '/api/auth',        router: authRouter },
  { path: '/api/categories',  router: categoriesRouter },
  { path: '/api/comments',    router: commentsRouter },
  { path: '/api/fingerprint', router: fingerprintRouter },
  { path: '/api/identity',    router: identityRouter },
  { path: '/api/listings',    router: listingsRouter },
  { path: '/api/posts',       router: postsRouter },
  { path: '/api/reactions',   router: reactionsRouter },
  { path: '/api/reviews',     router: reviewsRouter },
  { path: '/api/search',      router: searchRouter },
  { path: '/api/upload',      router: uploadRouter },
  { path: '/api/users',       router: usersRouter },
  { path: '/api/admin',       router: adminRouter },
  { path: '/api/articles',    router: articlesRouter },
  { path: '/api/explore',     router: exploreRouter },
];
