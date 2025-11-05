Backend template for dashboard webapps (JavaScript version).
In the future more will be added here

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and JWT secret
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `JWT_EXPIRES_IN`: JWT token expiration time (default: 7d)
- `PORT`: Server port (default: 3001)
- `CORS_ORIGIN`: CORS origin URL (default: http://localhost:5173)

### Email Configuration

#### Gmail
- `GMAIL_CLIENT_ID`: Gmail OAuth2 client ID (optional, for OAuth2)
- `GMAIL_CLIENT_SECRET`: Gmail OAuth2 client secret (optional, for OAuth2)
- `GMAIL_REFRESH_TOKEN`: Gmail OAuth2 refresh token (optional, for OAuth2)
- `GMAIL_APP_PASSWORD`: Gmail app password (alternative to OAuth2)

#### Outlook
- `OUTLOOK_CLIENT_ID`: Outlook OAuth2 client ID (optional, for OAuth2)
- `OUTLOOK_CLIENT_SECRET`: Outlook OAuth2 client secret (optional, for OAuth2)
- `OUTLOOK_REFRESH_TOKEN`: Outlook OAuth2 refresh token (optional, for OAuth2)
- `OUTLOOK_APP_PASSWORD`: Outlook app password (recommended)

**Note**: For Gmail, you can use either OAuth2 credentials or an App Password. For Outlook, App Password is recommended. Make sure to add email senders through the App Settings page in the frontend before sending emails.

