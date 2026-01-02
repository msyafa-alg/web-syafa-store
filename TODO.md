# TODO - Fix EROFS Error (In-Memory Storage)

## Problem
Vercel's file system is read-only (`/var/task`), causing EROFS error when trying to read/write `data/orders.json`.

## Solution
Implement in-memory storage fallback when file system is read-only.

## Tasks
- [x] 1. Create TODO.md file to track progress
- [x] 2. Modify utils/storage.js to add in-memory storage fallback
- [x] 3. Test the solution works without errors ✅

## Changes Made
### utils/storage.js
✅ Added in-memory storage (`memoryStore` object with `orders` and `users` arrays)
✅ Added `init()` method to detect read-only file system on startup
✅ Added `isReadOnly` flag to track file system state
✅ Modified `readJSON()` to fallback to memory store on EROFS error
✅ Modified `writeJSON()` to use memory store when `isReadOnly` is true
✅ Memory store is synchronized with file system when possible

## How It Works
1. On first access, the storage tries to load data from the file system
2. If EROFS error is detected, it switches to read-only mode
3. All read operations return data from memory store
4. All write operations update memory store only
5. This prevents EROFS errors while keeping the app functional

## Notes
- In-memory storage is fast but data may reset on cold starts
- For production with persistent data, consider Vercel KV (Redis)

