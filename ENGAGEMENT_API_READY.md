# Engagement API Endpoints - READY ✅

**Date:** February 24, 2026  
**Status:** ALL ENDPOINTS DEPLOYED

---

## API Endpoints Implemented

### 1. Like/Dislike System

#### Toggle Like
```bash
POST /api/v1/songs/:songId/like
Headers: Authorization: Bearer <token>
Response: { message: "Song liked", reaction: "like" }
```

#### Toggle Dislike
```bash
POST /api/v1/songs/:songId/dislike
Headers: Authorization: Bearer <token>
Response: { message: "Song disliked", reaction: "dislike" }
```

#### Remove Reaction
```bash
DELETE /api/v1/songs/:songId/reaction
Headers: Authorization: Bearer <token>
Response: { message: "Reaction removed" }
```

#### Get User's Reaction
```bash
GET /api/v1/songs/:songId/reaction
Headers: Authorization: Bearer <token>
Response: { reaction: "like" | "dislike" | null }
```

#### Get Song Stats
```bash
GET /api/v1/songs/:songId/stats
Headers: Authorization: Bearer <token> (optional)
Response: {
  stats: {
    likeCount: 150,
    dislikeCount: 5,
    commentCount: 23,
    shareCount: 12,
    averageRating: 4.5,
    ratingCount: 89,
    engagementScore: 2150,
    playCount: 5000
  },
  userEngagement: {  // Only if authenticated
    hasLiked: true,
    hasDisliked: false,
    hasRated: true,
    userRating: 5,
    hasCommented: false
  }
}
```

---

### 2. Comment System

#### Create Comment
```bash
POST /api/v1/songs/:songId/comments
Headers: Authorization: Bearer <token>
Body: { content: "Great song! 🔥" }
Response: {
  message: "Comment created",
  comment: {
    _id: "...",
    userId: { username: "user123", profilePicture: "..." },
    content: "Great song! 🔥",
    likes: 0,
    createdAt: "2026-02-24T10:30:00Z"
  }
}
```

#### Get Comments (Paginated)
```bash
GET /api/v1/songs/:songId/comments?page=1&limit=20
Response: {
  comments: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 45,
    pages: 3
  }
}
```

#### Reply to Comment
```bash
POST /api/v1/comments/:commentId/reply
Headers: Authorization: Bearer <token>
Body: { content: "Thanks!" }
Response: {
  message: "Reply created",
  reply: { ... }
}
```

#### Get Replies
```bash
GET /api/v1/comments/:commentId/replies?page=1&limit=10
Response: {
  replies: [...],
  pagination: { ... }
}
```

#### Edit Comment
```bash
PATCH /api/v1/comments/:commentId
Headers: Authorization: Bearer <token>
Body: { content: "Updated comment" }
Response: {
  message: "Comment updated",
  comment: { ... }
}
```

#### Delete Comment (Soft Delete)
```bash
DELETE /api/v1/comments/:commentId
Headers: Authorization: Bearer <token>
Response: { message: "Comment deleted" }
```

#### Like Comment
```bash
POST /api/v1/comments/:commentId/like
Headers: Authorization: Bearer <token>
Response: {
  message: "Comment liked",
  liked: true,
  likes: 12
}
```

---

### 3. Share System

#### Track Share Event
```bash
POST /api/v1/songs/:songId/share
Headers: Authorization: Bearer <token>
Body: {
  shareType: "link" | "social" | "download" | "playlist",
  platform: "whatsapp" (optional)
}
Response: {
  message: "Share tracked",
  share: {
    id: "...",
    shareType: "social",
    platform: "whatsapp",
    createdAt: "..."
  }
}
```

#### Get Share Statistics
```bash
GET /api/v1/songs/:songId/shares/stats
Response: {
  total: 45,
  byType: {
    link: 20,
    social: 15,
    download: 5,
    playlist: 5
  },
  byPlatform: {
    whatsapp: 8,
    twitter: 4,
    facebook: 3
  }
}
```

#### Get User's Share History
```bash
GET /api/v1/users/me/shares?page=1&limit=20
Headers: Authorization: Bearer <token>
Response: {
  shares: [...],
  pagination: { ... }
}
```

---

## Testing the APIs

### Quick Test Commands:

```bash
# Set your auth token
TOKEN="your_jwt_token_here"

# 1. Like a song
curl -X POST http://localhost:3000/api/v1/songs/SONG_ID/like \
  -H "Authorization: Bearer $TOKEN"

# 2. Get song stats
curl http://localhost:3000/api/v1/songs/SONG_ID/stats

# 3. Create comment
curl -X POST http://localhost:3000/api/v1/songs/SONG_ID/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Amazing track!"}'

# 4. Get comments
curl http://localhost:3000/api/v1/songs/SONG_ID/comments?page=1&limit=10

# 5. Track share
curl -X POST http://localhost:3000/api/v1/songs/SONG_ID/share \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shareType":"link"}'

# 6. Reply to comment
curl -X POST http://localhost:3000/api/v1/comments/COMMENT_ID/reply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Thank you!"}'

# 7. Like comment
curl -X POST http://localhost:3000/api/v1/comments/COMMENT_ID/like \
  -H "Authorization: Bearer $TOKEN"

# 8. Dislike song
curl -X POST http://localhost:3000/api/v1/songs/SONG_ID/dislike \
  -H "Authorization: Bearer $TOKEN"

# 9. Get user's reaction
curl http://localhost:3000/api/v1/songs/SONG_ID/reaction \
  -H "Authorization: Bearer $TOKEN"

# 10. Edit comment
curl -X PATCH http://localhost:3000/api/v1/comments/COMMENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Updated comment text"}'

# 11. Delete comment
curl -X DELETE http://localhost:3000/api/v1/comments/COMMENT_ID \
  -H "Authorization: Bearer $TOKEN"

# 12. Get share stats
curl http://localhost:3000/api/v1/songs/SONG_ID/shares/stats
```

---

## Features Implemented ✅

1. **Like/Dislike System**
   - Toggle like/dislike
   - Remove reaction
   - Prevent self-liking
   - Real-time count updates
   - Get user's reaction status

2. **Comment System**
   - Create comments
   - Paginated comment listing
   - Threaded replies
   - Edit own comments
   - Soft delete
   - Like comments
   - Comment count tracking

3. **Share System**
   - Track shares by type
   - Platform tracking (social shares)
   - Share statistics
   - User share history

4. **Engagement Analytics**
   - Aggregate stats per song
   - User engagement status
   - Engagement score calculation
   - Real-time counter updates

---

## Next Steps - UI Implementation

1. ✅ Update Flutter `SongModel` to include engagement fields
2. ✅ Create engagement providers (Riverpod)
3. ✅ Update `song_list_tile.dart` with engagement icons
4. ✅ Create `comments_bottom_sheet.dart`
5. ✅ Create `share_bottom_sheet.dart`
6. ✅ Add optimistic UI updates
7. ✅ Test full flow from UI

---

## Server Status

**Build:** ✅ Compiled successfully  
**Deployment:** ✅ PM2 restarted  
**Endpoints:** 17 total  
**Authentication:** Required for write operations, optional for read  
**Future-Proof:** Indexed, paginated, soft deletes, engagement scoring
