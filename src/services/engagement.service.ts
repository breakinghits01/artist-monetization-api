import Comment from '../models/Comment.model';
import SongLike from '../models/SongLike.model';
import SongShare from '../models/SongShare.model';
import mongoose from 'mongoose';

/**
 * Populate engagement metrics for a single song
 */
export async function populateSongEngagement(song: any): Promise<any> {
  const songId = song._id || song.id;
  
  const [commentCount, likeStats, shareCount] = await Promise.all([
    Comment.countDocuments({ songId, deletedAt: null }),
    SongLike.aggregate([
      { $match: { songId: new mongoose.Types.ObjectId(songId) } },
      { $group: {
        _id: null,
        likeCount: { $sum: { $cond: [{ $eq: ['$isLike', true] }, 1, 0] } },
        dislikeCount: { $sum: { $cond: [{ $eq: ['$isLike', false] }, 1, 0] } }
      }}
    ]),
    SongShare.countDocuments({ songId })
  ]);

  return {
    ...song,
    commentCount: commentCount || 0,
    likeCount: likeStats[0]?.likeCount || 0,
    dislikeCount: likeStats[0]?.dislikeCount || 0,
    shareCount: shareCount || 0
  };
}

/**
 * Populate engagement metrics for multiple songs
 */
export async function populateSongsEngagement(songs: any[]): Promise<any[]> {
  if (!songs || songs.length === 0) return songs;

  const songIds = songs.map(song => new mongoose.Types.ObjectId(song._id || song.id));

  // Get all engagement metrics in parallel
  const [commentCounts, likeCounts, shareCounts] = await Promise.all([
    // Comment counts
    Comment.aggregate([
      { $match: { songId: { $in: songIds }, deletedAt: null } },
      { $group: { _id: '$songId', count: { $sum: 1 } } }
    ]),
    // Like/Dislike counts
    SongLike.aggregate([
      { $match: { songId: { $in: songIds } } },
      { $group: {
        _id: '$songId',
        likeCount: { $sum: { $cond: [{ $eq: ['$isLike', true] }, 1, 0] } },
        dislikeCount: { $sum: { $cond: [{ $eq: ['$isLike', false] }, 1, 0] } }
      }}
    ]),
    // Share counts
    SongShare.aggregate([
      { $match: { songId: { $in: songIds } } },
      { $group: { _id: '$songId', count: { $sum: 1 } } }
    ])
  ]);

  // Create lookup maps
  const commentMap = new Map(commentCounts.map(c => [c._id.toString(), c.count]));
  const likeMap = new Map(likeCounts.map(l => [l._id.toString(), { likes: l.likeCount, dislikes: l.dislikeCount }]));
  const shareMap = new Map(shareCounts.map(s => [s._id.toString(), s.count]));

  // Add engagement metrics to each song
  return songs.map(song => {
    const songId = (song._id || song.id).toString();
    const likes = likeMap.get(songId);
    
    return {
      ...song,
      commentCount: commentMap.get(songId) || 0,
      likeCount: likes?.likes || 0,
      dislikeCount: likes?.dislikes || 0,
      shareCount: shareMap.get(songId) || 0
    };
  });
}
