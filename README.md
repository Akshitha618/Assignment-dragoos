# Enterprise Backend API

## Overview
A secure and scalable backend API built with Node.js, Express, and SQLite. Includes JWT authentication, role-based access control, input validation, and automated testing.

## Key Features

### Authentication & Authorization
- **JWT Authentication**: Secure token-based authentication with registration, login, and token refresh
- **User Management**: Complete CRUD operations with role-based access control (user/admin)
- **Password Security**: Secure password hashing with bcrypt (12 rounds)
- **Session Management**: Proper token validation and refresh mechanisms

### Database & Data Management
- **SQLite Database**: Lightweight, file-based database with optimized schema design
- **Relational Design**: Well-structured tables with foreign key relationships
- **Data Operations**: Generic data storage system with categorization and tagging
- **Data Integrity**: Proper constraints, indexes, and cascade operations

### Security & Performance
- **Input Validation**: Comprehensive validation using Joi schemas
- **Rate Limiting**: API rate limiting to prevent abuse (100 req/15min)
- **Security Headers**: Helmet.js for security headers and XSS protection
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Monitoring & Testing
- **Health Monitoring**: Comprehensive health check endpoints with system metrics
- **Test Coverage**: 43 test cases with 76%+ coverage across all modules
- **Logging**: Structured logging with Winston for monitoring and debugging
- **API Documentation**: Complete endpoint documentation with usage examples

## Technology Stack

- **Backend Framework**: Node.js with Express.js
- **Database**: SQLite with proper indexing and relationships
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi for input validation
- **Security**: Helmet, bcrypt, CORS, rate limiting
- **Testing**: Jest with Supertest for API testing
- **Logging**: Winston for structured logging
- **Code Quality**: ESLint for code linting
- **Containerization**: Docker with multi-stage builds

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Akshitha618/Assignment-dragoos.git
   cd Assignment-dragoos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Run tests**
   ```bash
   # Run all tests
   npm test
   
   # Run tests with coverage
   npm run test:coverage
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/refresh` - Refresh JWT token

### User Management
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `POST /api/users/:id/change-password` - Change password
- `DELETE /api/users/:id` - Delete user (admin only)

### Data Management
- `GET /api/data` - Get data entries with pagination/search
- `POST /api/data` - Create new data entry
- `GET /api/data/:id` - Get specific data entry
- `PUT /api/data/:id` - Update data entry
- `DELETE /api/data/:id` - Delete data entry
- `GET /api/data/categories/list` - Get categories list

### Health & Monitoring
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system information

## API Usage Examples

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Create data entry
```bash
curl -X POST http://localhost:3000/api/data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "My Data Entry",
    "content": "This is some content",
    "category": "general",
    "tags": ["important", "work"],
    "isPublic": false
  }'
```

## Database Schema

### Users Table
- `id` (Primary Key)
- `username` (Unique)
- `email` (Unique)
- `password_hash`
- `role` (user/admin)
- `is_active`
- `created_at`
- `updated_at`

### Data Entries Table
- `id` (Primary Key)
- `user_id` (Foreign Key)
- `title`
- `content`
- `category`
- `tags` (JSON)
- `metadata` (JSON)
- `is_public`
- `created_at`
- `updated_at`

### API Keys Table
- `id` (Primary Key)
- `user_id` (Foreign Key)
- `key_name`
- `api_key`
- `permissions` (JSON)
- `is_active`
- `expires_at`
- `created_at`

### Audit Logs Table
- `id` (Primary Key)
- `user_id` (Foreign Key)
- `action`
- `resource_type`
- `resource_id`
- `details` (JSON)
- `ip_address`
- `user_agent`
- `created_at`

## Security Features

- **Password Security**: bcrypt with 12 salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: 100 requests per 15-minute window
- **Input Validation**: Comprehensive Joi validation schemas
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Helmet.js security headers
- **CORS Configuration**: Controlled cross-origin access
- **Role-Based Access**: User and admin role separation

## Testing

The application includes good test coverage:

- **Authentication Tests**: Registration, login, token validation
- **User Management Tests**: CRUD operations, permissions
- **Data Management Tests**: Data operations, access control
- **Health Check Tests**: System monitoring endpoints
- **Security Tests**: Authentication, authorization, validation

Run tests with:
```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
```

## Docker Deployment

### Build and run with Docker
```bash
# Build image
docker build -t dragos-backend .

# Run container
docker run -p 3000:3000 -e JWT_SECRET=your-secret dragos-backend
```

### Using Docker Compose
```bash
docker-compose up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `DB_PATH` | SQLite database path | ./data/database.sqlite |
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_EXPIRES_IN` | JWT expiration time | 24h |
| `API_RATE_LIMIT` | Rate limit per window | 100 |
| `API_RATE_WINDOW` | Rate limit window (minutes) | 15 |
| `LOG_LEVEL` | Logging level | info |

## Performance Considerations

- **Database Indexing**: Proper indexes on frequently queried columns
- **Connection Pooling**: Efficient database connection management
- **Response Compression**: Gzip compression for API responses
- **Memory Management**: Optimized memory usage with streaming
- **Caching Headers**: Appropriate cache control headers

## Monitoring & Logging

- **Structured Logging**: JSON-formatted logs with Winston
- **Health Checks**: Comprehensive system health monitoring
- **Error Tracking**: Centralized error handling and logging
- **Performance Metrics**: Response time and resource usage tracking

## Development Guidelines

- **Code Style**: ESLint configuration for consistent code style
- **Git Hooks**: Pre-commit hooks for code quality
- **Error Handling**: Consistent error response format
- **API Versioning**: Structured for future API versions
- **Documentation**: Comprehensive inline code documentation

## Production Deployment

1. **Environment Setup**
   - Set production environment variables
   - Configure secure JWT secret
   - Set up proper logging directory

2. **Security Hardening**
   - Use HTTPS in production
   - Configure firewall rules
   - Set up monitoring and alerting

3. **Database Backup**
   - Regular SQLite database backups
   - Backup rotation strategy

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
