// Initialize the database and create collections with validation
db = db.getSiblingDB('artist_monetization');

// Create users collection with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role', 'tokens'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string'
        },
        role: {
          enum: ['artist', 'fan', 'admin']
        },
        tokens: {
          bsonType: 'number',
          minimum: 0
        },
        username: {
          bsonType: 'string'
        },
        avatar: {
          bsonType: 'string'
        },
        bio: {
          bsonType: 'string'
        },
        createdAt: {
          bsonType: 'date'
        },
        updatedAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

// Create indexes for users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true, sparse: true });
db.users.createIndex({ role: 1 });

// Create songs collection
db.createCollection('songs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['artistId', 'title', 'price', 'audioUrl'],
      properties: {
        artistId: {
          bsonType: 'objectId'
        },
        title: {
          bsonType: 'string'
        },
        duration: {
          bsonType: 'number',
          minimum: 0
        },
        price: {
          bsonType: 'number',
          minimum: 0
        },
        coverArt: {
          bsonType: 'string'
        },
        audioUrl: {
          bsonType: 'string'
        },
        exclusive: {
          bsonType: 'bool'
        },
        genre: {
          bsonType: 'string'
        },
        playCount: {
          bsonType: 'number',
          minimum: 0
        },
        featured: {
          bsonType: 'bool'
        }
      }
    }
  }
});

db.songs.createIndex({ artistId: 1 });
db.songs.createIndex({ title: 'text' });
db.songs.createIndex({ genre: 1 });
db.songs.createIndex({ createdAt: -1 });

// Create bundles collection
db.createCollection('bundles');
db.bundles.createIndex({ artistId: 1 });

// Create purchases collection
db.createCollection('purchases');
db.purchases.createIndex({ userId: 1 });
db.purchases.createIndex({ itemId: 1 });
db.purchases.createIndex({ createdAt: -1 });

// Create ratings collection
db.createCollection('ratings');
db.ratings.createIndex({ userId: 1, songId: 1 }, { unique: true });
db.ratings.createIndex({ songId: 1 });

// Create tips collection
db.createCollection('tips');
db.tips.createIndex({ fromUserId: 1 });
db.tips.createIndex({ toUserId: 1 });
db.tips.createIndex({ createdAt: -1 });

// Create treasure chests collection
db.createCollection('treasureChests');
db.treasureChests.createIndex({ contentId: 1 });
db.treasureChests.createIndex({ rarity: 1 });

// Create transactions collection
db.createCollection('transactions');
db.transactions.createIndex({ userId: 1 });
db.transactions.createIndex({ createdAt: -1 });

// Create follows collection
db.createCollection('follows');
db.follows.createIndex({ followerId: 1, followingId: 1 }, { unique: true });
db.follows.createIndex({ followerId: 1 });
db.follows.createIndex({ followingId: 1 });

print('Database initialized successfully!');
