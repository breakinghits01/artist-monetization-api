# Rising Stars Scoring System - Explained

**Date:** February 24, 2026  
**Status:** Documentation for Future Implementation

---

## Formula Overview

```javascript
risingScore = 
  (newSongsLast30Days × 200) +       // Recent uploads (HIGHEST PRIORITY)
  (newFollowersLast30Days × 100) +   // Growth momentum
  (newLikesLast30Days × 80) +        // New engagement
  (newCommentsLast30Days × 60) +     // New engagement
  (newSharesLast30Days × 40) +       // New engagement
  (totalPlayCount × 0.05) +          // Total plays
  (avgRating × 50) +                 // Average rating (5-star)
  (totalSongs × 5) +                 // Library size (SMALL MULTIPLIER)
  (totalFollowers × 2)               // Fanbase
```

---

## Key Distinction: Two Song Metrics

### 1. **Total Songs (Library Size)**
```javascript
totalSongs × 5
```
**Purpose:** Rewards having a content library  
**Weight:** SMALL (5 points per song)  
**Example:** 7 songs = 7 × 5 = **35 points**

### 2. **New Songs (Last 30 Days - Growth)**
```javascript
newSongsLast30Days × 200
```
**Purpose:** Rewards ACTIVE creators (growth/momentum)  
**Weight:** LARGE (200 points per new song)  
**Example:** 7 new songs = 7 × 200 = **1,400 points** 🔥

---

## Real Example: dekzblaster2

### Artist Stats (Feb 24, 2026):
- **Total songs:** 6
- **Songs uploaded last 30 days:** 6 (all uploaded Feb 12-24)
- **Total followers:** 1
- **New followers (30d):** 1
- **Total plays:** 67 (0+7+21+10+7+22)
- **Engagement:** 0 likes, 0 comments, 0 shares (not implemented yet)
- **Average rating:** 0 (no ratings yet)

### Score Breakdown:

| Metric | Value | Weight | Points | Impact |
|--------|-------|--------|--------|--------|
| **New songs (30d)** | 6 | × 200 | **1,200** | 🔥 BIGGEST |
| **New followers (30d)** | 1 | × 100 | **100** | ⭐ |
| **New likes (30d)** | 0 | × 80 | 0 | - |
| **New comments (30d)** | 0 | × 60 | 0 | - |
| **New shares (30d)** | 0 | × 40 | 0 | - |
| **Total plays** | 67 | × 0.05 | **3.35** | Small |
| **Avg rating** | 0 | × 50 | 0 | - |
| **Total songs** | 6 | × 5 | **30** | Small |
| **Total followers** | 1 | × 2 | **2** | Tiny |

**Total Rising Score: 1,335.35 points** 🌟

---

## Why Different Weights?

### High Priority (Growth Indicators):
- **New songs (×200):** Active creators deserve top spots
- **New followers (×100):** Growing fanbase = rising artist
- **New likes (×80):** Viral content potential
- **New comments (×60):** Strong engagement
- **New shares (×40):** Word-of-mouth growth

### Medium Priority (Quality):
- **Avg rating (×50):** 5-star quality boost
  - 5.0 rating = 250 points
  - 4.5 rating = 225 points

### Low Priority (Existing Assets):
- **Total plays (×0.05):** Prevents established artists from dominating
  - 1,000 plays = 50 points
  - 10,000 plays = 500 points
- **Total songs (×5):** Small library bonus
  - 10 songs = 50 points
  - 50 songs = 250 points
- **Total followers (×2):** Minimal impact
  - 100 followers = 200 points
  - 1,000 followers = 2,000 points

---

## Comparison: Active vs Established Artist

### Active Rising Artist (dekzblaster2):
```
New songs: 6, New followers: 1, Total songs: 6, Total followers: 1, Plays: 67
= (6 × 200) + (1 × 100) + (67 × 0.05) + (6 × 5) + (1 × 2)
= 1,200 + 100 + 3.35 + 30 + 2
= 1,335 points ⭐⭐⭐ (TOP RANK)
```

### Established Artist (No Recent Activity):
```
New songs: 0, New followers: 5, Total songs: 50, Total followers: 500, Plays: 50,000
= (0 × 200) + (5 × 100) + (50,000 × 0.05) + (50 × 5) + (500 × 2)
= 0 + 500 + 2,500 + 250 + 1,000
= 4,250 points ⭐⭐ (LOWER RANK - Not "Rising")
```

**Result:** Active creator with 6 songs ranks HIGHER than established artist with 50 songs. This is intentional - it's a "Rising Stars" ranking, not "Most Popular."

---

## Time Decay

Songs uploaded **more than 30 days ago** lose their 200-point bonus:

**Day 1-30:** Song worth **200 points** (newSongsLast30Days)  
**Day 31+:** Song worth **5 points** (totalSongs only)

**Impact:** Artists must stay active to maintain high rankings.

---

## 5-Star Rating Integration

The `avgRating × 50` converts 5-star ratings to points:

| Average Rating | Points Added |
|---------------|--------------|
| ⭐⭐⭐⭐⭐ (5.0) | 250 points |
| ⭐⭐⭐⭐½ (4.5) | 225 points |
| ⭐⭐⭐⭐ (4.0) | 200 points |
| ⭐⭐⭐½ (3.5) | 175 points |
| ⭐⭐⭐ (3.0) | 150 points |
| ⭐⭐ (2.0) | 100 points |
| ⭐ (1.0) | 50 points |

**Tip:** High-quality content gets rewarded significantly!

---

## Common Misconceptions

❌ **Wrong:** "7 songs = 100 points per song = 700 points"  
✅ **Correct:** 
- **Recent songs (30d):** 7 × 200 = **1,400 points**
- **Total songs:** 7 × 5 = **35 points**

❌ **Wrong:** "More plays = automatic high rank"  
✅ **Correct:** Plays have minimal weight (×0.05) to prevent established artists from dominating

❌ **Wrong:** "Total followers matter most"  
✅ **Correct:** NEW followers (×100) matter more than total followers (×2)

---

## Strategy Tips for Artists

### To Maximize Rising Score:

1. **Upload regularly** (200 points per song in 30-day window) 🔥
2. **Gain new followers** (100 points each)
3. **Encourage engagement** (likes/comments/shares)
4. **Maintain quality** (5-star ratings = 250 points)
5. **Stay active** (time decay after 30 days)

### What Doesn't Help Much:

- ❌ Having many old songs (only 5 points each)
- ❌ Having many old followers (only 2 points each)
- ❌ High play counts alone (×0.05 multiplier is tiny)

---

## Implementation Status

- ✅ Formula designed and documented
- ✅ Backend aggregation approach planned
- ⏸️ **ON HOLD** - Waiting for engagement features (likes, comments, shares)
- 🎯 **NEXT:** Implement Flutter UI for engagement features
- 🔄 **FUTURE:** Return to Rising Stars with complete metrics

---

## Summary

The Rising Stars formula prioritizes **ACTIVE GROWTH** over established success. An artist uploading 6 songs in 30 days (like dekzblaster2) can outrank an artist with 50 songs and 50,000 plays if the latter hasn't uploaded recently. This is by design - it's about who's "rising" right now, not who's already famous.

**Key Takeaway:** New songs = 200 points each (last 30 days), Total songs = 5 points each (lifetime)
