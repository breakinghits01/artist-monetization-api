# Dynamic Artist Monetization - Backend API

Node.js/Express backend API for the Dynamic Artist Monetization platform with MongoDB database.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose installed
- Git

### 1. Start MongoDB with Docker

```bash
# From the dynamic_artist_monetization folder (Flutter project root)
cd /Users/DekZ/Development/projects/app\ monitization/dynamic_artist_monetization
docker-compose up -d
```

This will start:
- **MongoDB** on `localhost:27017`
- **Mongo Express** (Web UI) on `http://localhost:8081`

**Mongo Express Credentials:**
- Username: `admin`
- Password: `pass`

### 2. Install Backend Dependencies

```bash
cd ../api_dynamic_artist_monetization
npm install
```

### 3. Configure Environment

The `.env` file is already created. Update these values:
- `STRIPE_SECRET_KEY` - Your Stripe test key
- `JWT_SECRET` - Change to a secure random string
- Other values as needed

### 4. Run the Backend

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000`

---

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `POST /refresh` - Refresh JWT token
- `POST /logout` - Logout user

### Users (`/api/v1/users`)
- `GET /profile/:id` - Get user profile
- `PUT /profile` - Update own profile
- `POST /avatar` - Upload avatar

### Songs (`/api/v1/songs`)
- `POST /upload` - Upload new song
- `GET /:id` - Get song details
- `PUT /:id` - Update song
- `DELETE /:id` - Delete song
- `GET /artist/:id` - Get artist's songs
- `POST /:id/purchase` - Purchase song

### Bundles (`/api/v1/bundles`)
- `POST /` - Create bundle
- `GET /:id` - Get bundle details
- `PUT /:id` - Update bundle
- `DELETE /:id` - Delete bundle

### Ratings (`/api/v1/ratings`)
- `POST /songs/:id/rate` - Rate a song
- `PUT /:id` - Update rating
- `GET /songs/:id` - Get song ratings

### Tips (`/api/v1/tips`)
- `POST /send` - Send tip
- `GET /history` - Tip history
- `GET /leaderboard` - Tip leaderboard

### Tokens (`/api/v1/tokens`)
- `POST /purchase` - Purchase tokens (Stripe)
- `GET /balance` - Get token balance
- `GET /transactions` - Transaction history

### Treasure (`/api/v1/treasure`)
- `GET /chests` - Get treasure chests
- `POST /:id/unlock` - Unlock chest

### Analytics (`/api/v1/analytics`)
- `GET /artist/earnings` - Artist earnings
- `GET /artist/engagement` - Engagement metrics
- `GET /fan/stats` - Fan statistics

---

## 🗄️ Database Structure

### Collections

1. **users** - User accounts (artists, fans, admins)
2. **songs** - Music tracks (max 10 per artist)
3. **bundles** - Song packages with discounts
4. **purchases** - Purchase records with platform tracking
5. **ratings** - Song ratings and reviews
6. **tips** - Peer-to-peer tipping
7. **transactions** - Token transaction history
8. **treasureChests** - Discovery mechanism content
9. **follows** - User follow relationships

### Key Features

- **10 Song Limit**: Enforced at model level for artists
- **Web Discount**: 30% automatic discount for web platform
- **Token Economy**: 1 token = $0.10 USD
- **Treasure Rarity**: Common, Rare, Legendary tiers
- **Artist Protection**: Artists can't rate own songs or follow themselves

---

## 🐳 Docker Commands

### Start MongoDB
```bash
docker-compose up -d
```

### Stop MongoDB
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f mongodb
```

### Reset Database (WARNING: Deletes all data)
```bash
docker-compose down -v
docker-compose up -d
```

### Access MongoDB Shell
```bash
docker exec -it dynamic_artist_mongodb mongosh -u admin -p adminpassword --authenticationDatabase admin
```

---

## 📁 Project Structure

```
api_dynamic_artist_monetization/
├── src/
│   ├── config/
│   │   ├── database.ts          # MongoDB connection
│   │   └── logger.ts             # Winston logger
│   ├── middleware/
│   │   ├── errorHandler.ts      # Global error handling
│   │   └── notFound.ts           # 404 handler
│   ├── models/
│   │   ├── User.model.ts         # User schema
│   │   ├── Song.model.ts         # Song schema
│   │   ├── Bundle.model.ts       # Bundle schema
│   │   ├── Purchase.model.ts     # Purchase schema
│   │   ├── Rating.model.ts       # Rating schema
│   │   ├── Tip.model.ts          # Tip schema
│   │   ├── Transaction.model.ts  # Transaction schema
│   │   ├── TreasureChest.model.ts # Treasure schema
│   │   └── Follow.model.ts       # Follow schema
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── song.routes.ts
│   │   ├── bundle.routes.ts
│   │   ├── rating.routes.ts
│   │   ├── tip.routes.ts
│   │   ├── token.routes.ts
│   │   ├── treasure.routes.ts
│   │   └── analytics.routes.ts
│   └── server.ts                 # Express app
├── logs/                         # Application logs
├── uploads/                      # File uploads (local dev)
├── .env                          # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
└── init-mongo.js                 # DB initialization
```

---

## 🔧 Development Scripts

```bash
# Development with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production
npm start

# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

---

## 🌐 Environment Variables

Key variables in `.env`:

```env
# MongoDB
MONGODB_URI=mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Platform
WEB_DISCOUNT_PERCENTAGE=0.30
MAX_SONGS_PER_ARTIST=10
TOKEN_VALUE_USD=0.10
```

---

## 🔐 Security Features

- Helmet for security headers
- CORS protection
- Rate limiting
- MongoDB injection protection
- JWT authentication
- Password hashing with bcrypt
- Input validation with Joi

---

## 📝 Next Steps

1. ✅ MongoDB set up with Docker
2. ✅ Database models created
3. ✅ Express server structure
4. ⏳ Implement authentication controllers
5. ⏳ Implement CRUD operations
6. ⏳ Add JWT middleware
7. ⏳ Set up file upload (Multer/S3)
8. ⏳ Integrate Stripe payment
9. ⏳ Add validation middleware
10. ⏳ Write API tests

---

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if container is running
docker ps

# Restart container
docker-compose restart mongodb

# Check logs
docker-compose logs mongodb
```

### Port Already in Use
```bash
# Find process on port 3000
lsof -ti:3000

# Kill process
kill -9 <PID>
```

---

## 📚 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB 7.0
- **ODM**: Mongoose
- **Authentication**: JWT
- **Payment**: Stripe
- **Logger**: Winston
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run tests
4. Submit pull request

---

## 📄 License

ISC
