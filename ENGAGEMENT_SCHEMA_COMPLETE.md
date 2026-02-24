# Engagement Schema Implementation - COMPLETE ✅

**Date:** February 24, 2026  
**Status:** Backend schemas ready for implementation

---

## Created Database Models

### 1. SongLike Model ✅
**File:** `src/models/SongLike.model.ts`

**Schema:**
- userId (ObjectId, ref: User)
- songId (ObjectId, ref: Song)
- likeType (enum: 'like' | 'dislike')
- timestamps (createdAt, updatedAt)

**Indexes:**
- `{ userId, songId }` - unique (one reaction per user per song)
- `{ songId, likeType }` - count likes/dislikes
- `{ createdAt }` - recent activity
- `{ userId, createdAt }` - user history

**Business Logic:**
- Pre-save hook prevents artists from liking their own songs
- Unique constraint ensures one reaction per user

---

### 2. Comment Model ✅
**File:** `src/models/Comment.model.ts`

**Schema:**
- userId (ObjectId, ref: User)
- songId (ObjectId, ref: Song)
- content (string, 1-500 chars)
- parentCommentId (ObjectId, optional - for threaded replies)
- likes (number, default: 0)
- deletedAt (Date, optional - soft delete)
- timestamps (createdAt, updatedAt)

**Indexes:**
- `{ songId, createdAt }` - recent comments per song
- `{ userId, createdAt }` - user's comments
- `{ parentCommentId }` - thread replies
- `{ songId, deletedAt }` - active comments

**Features:**
- Threaded comments (replies to comments)
- Soft delete support
- Virtual field for reply count

---

### 3. CommentLike Model ✅
**File:** `src/models/CommentLike.model.ts`

**Schema:**
- userId (ObjectId, ref: User)
- commentId (ObjectId, ref: Comment)
- createdAt (Date)

**Indexes:**
- `{ userId, commentId }` - unique (one like per user per comment)
- `{ commentId }` - count likes per comment
- `{ createdAt }` - recent activity

---

### 4. SongShare Model ✅
**File:** `src/models/SongShare.model.ts`

**Schema:**
- userId (ObjectId, ref: User)
- songId (ObjectId, ref: Song)
- shareType (enum: 'link' | 'social' | 'download' | 'playlist')
- platform (string, optional - e.g., 'whatsapp', 'twitter')
- createdAt (Date)

**Indexes:**
- `{ songId, shareType }` - count shares by type
- `{ userId, createdAt }` - user share history
- `{ createdAt }` - recent shares
- `{ songId, createdAt }` - song share timeline

---

### 5. Enhanced Song Model ✅
**File:** `src/models/Song.model.ts` (Updated)

**Added Fields:**
```typescript
// Engagement metrics (cached counters)
likeCount: number (default: 0)
dislikeCount: number (default: 0)
commentCount: number (default: 0)
shareCount: number (default: 0)
averageRating: number (0-5, default: 0)
ratingCount: number (default: 0)
engagementScore: number (default: 0)
engagementUpdatedAt: Date (nullable)
```

**New Indexes:**
- `{ engagementScore, createdAt }` - trending/popular sorting
- `{ likeCount }` - most liked
- `{ commentCount }` - most discussed

---

## Engagement Utilities ✅

**File:** `src/utils/engagement.utils.ts`

### Functions:

1. **calculateEngagementScore(metrics)**
   - Formula: `(likes × 5) + (comments × 10) + (shares × 15) + (plays × 1) + (avgRating × 20) - (dislikes × 2)`
   - Returns weighted engagement score

2. **updateSongEngagementMetrics(songId)**
   - Aggregates all engagement data
   - Updates cached counters in Song model
   - Recalculates engagement score
   - Returns complete metrics object

3. **incrementCommentCount(songId)**
   - Real-time counter update when comment is added

4. **decrementCommentCount(songId)**
   - Real-time counter update when comment is deleted

5. **incrementShareCount(songId)**
   - Real-time counter update when song is shared

6. **updateLikeCounts(songId)**
   - Updates like/dislike counts after reaction changes

7. **batchUpdateEngagementMetrics(songIds[])**
   - Batch processing for background jobs
   - Updates multiple songs efficiently

---

## Integration with Rising Stars 🌟

### Enhanced Rising Score Formula:

```typescript
risingScore = 
  // Growth metrics (existing)
  (newSongsLast30Days × 200) +
  (newFollowersLast30Days × 100) +
  
  // Engagement metrics (NEW)
  (newLikesLast30Days × 80) +
  (newCommentsLast30Days × 60) +
  (newSharesLast30Days × 40) +
  
  // Total metrics
  (totalPlayCount × 0.05) +
  (averageRating × 50) +
  (totalSongs × 5) +
  (totalFollowers × 2)
```

### Data Sources:

**Growth Metrics (30-day):**
- `Follow.createdAt >= 30 days ago` → newFollowers
- `Song.createdAt >= 30 days ago` → newSongs
- `SongLike.createdAt >= 30 days ago` → newLikes
- `Comment.createdAt >= 30 days ago` → newComments
- `SongShare.createdAt >= 30 days ago` → newShares

**Total Metrics:**
- `Song.playCount` (sum all songs)
- `Song.averageRating` (weighted average)
- `Song.count` (total songs)
- `Follow.count` (total followers)

---

## Next Steps - Implementation Order:

### Phase 1: Like System (Week 1)
- [ ] POST `/api/v1/songs/:songId/like` - Toggle like
- [ ] POST `/api/v1/songs/:songId/dislike` - Toggle dislike
- [ ] DELETE `/api/v1/songs/:songId/reaction` - Remove reaction
- [ ] GET `/api/v1/songs/:songId/reaction` - Get user's reaction
- [ ] GET `/api/v1/songs/:songId/stats` - Get engagement stats

### Phase 2: Comment System (Week 2)
- [ ] POST `/api/v1/songs/:songId/comments` - Create comment
- [ ] GET `/api/v1/songs/:songId/comments` - List comments (paginated)
- [ ] POST `/api/v1/comments/:commentId/reply` - Reply to comment
- [ ] PATCH `/api/v1/comments/:commentId` - Edit comment
- [ ] DELETE `/api/v1/comments/:commentId` - Delete comment (soft)
- [ ] POST `/api/v1/comments/:commentId/like` - Like comment
- [ ] GET `/api/v1/comments/:commentId/replies` - Get thread

### Phase 3: Share System (Week 2)
- [ ] POST `/api/v1/songs/:songId/share` - Track share event

### Phase 4: Frontend UI (Week 3)
- [ ] Update `SongModel` in Flutter to include engagement fields
- [ ] Update `song_list_tile.dart` with engagement row
- [ ] Create `comments_bottom_sheet.dart`
- [ ] Create `share_bottom_sheet.dart`
- [ ] Create engagement providers (Riverpod)

### Phase 5: Rising Stars Integration (Week 4)
- [ ] Update `user.controller.ts` aggregation pipeline
- [ ] Add engagement metrics to rising score calculation
- [ ] Test ranking with real engagement data
- [ ] Deploy Rising Stars feature

---

## Database Migration Notes:

**No migration needed** - All new fields have defaults:
- Existing songs will have `likeCount: 0`, `commentCount: 0`, etc.
- New indexes will be created automatically on first query
- Engagement metrics can be populated via background job

**Optional: Initial Engagement Update**
```javascript
// Run this once to populate engagement metrics for existing songs
db.songs.find().forEach(async (song) => {
  await updateSongEngagementMetrics(song._id);
});
```

---

## Performance Considerations:

1. **Cached Counters:** Song model stores engagement counts to avoid aggregation on every request
2. **Background Updates:** Use `batchUpdateEngagementMetrics()` for periodic recalculation
3. **Real-time Updates:** Use increment/decrement functions for instant UI feedback
4. **Indexes:** All critical queries are indexed for fast retrieval

---

**Status:** ✅ Ready for API endpoint implementation  
**Build Status:** ✅ TypeScript compiled successfully  
**Models Created:** 4 new models (SongLike, Comment, CommentLike, SongShare)  
**Models Updated:** 1 model (Song with engagement fields)  
**Utilities Created:** 7 helper functions for engagement management
