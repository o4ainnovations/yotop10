# RAM — Runtime Action Manifest

## Completed
- **[M00.0] Dev ports changed** — Frontend `3000→3100`, Backend `8000→8100`. `docker-compose.dev.yml` port mappings, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL` all synced. `frontend/README.md` docs updated.
- **[Fix] PM2 7 compatibility** — Switched from `.js` to `.json` ecosystem config, replaced shell wrappers with actual Node entry points, added missing `pm2` install in `Dockerfile.dev`, fixed entrypoint for PM2 7's `pm2 start` + `pm2 logs` approach.

## Current
- _(none)_

## Next
- _(none)_
