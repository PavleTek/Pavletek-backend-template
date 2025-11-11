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

3. Set up the database (must have a propper databaseURL in order for prisma to connect to it):
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

4. Start the development server:
```bash
node src/index.js
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `JWT_EXPIRES_IN`: JWT token expiration time (default: 7d)
- `PORT`: Server port (default: 3001)
- `CORS_ORIGIN`: CORS origin URL (default: http://localhost:5173)

### Email Configuration

The email system uses OAuth2 refresh tokens stored per email sender in the database. Each email sender must have a refresh token configured.

#### Required Environment Variables

- `RESEND_API_KEY`: API key for the Resend email service.

**Note**:
- Email senders stored in the database only track the email address. Ensure those addresses are verified and allowed to send via Resend (configure domains/senders in the Resend dashboard).
- At least one email sender must be created through the App Settings page before attempting to send emails from the application.


### Railway steps for deployment
1) Start your backend service with this as a template
2) Start a service in railway with your repo as the source
3) Ensure to start a postgresql service in railway. once deployed, get the private url from railway and set the env variable DATABASE_URL with it
4) Set the rest of the env variables with yout resend api key, your jwt secret and expiry preference, and CORS policy
5) For the CORS variable, you can leave it as "" to allow any, or you can get your front end url and paste it there.
6) You need to set the pre-deploy commands to be "npm run migrate && npm run build && npm run seed"
7) Trigger a deploy and your backend should be running with a database and a few testing accounts.
8) you can opt to change the prisma/seed.js file if you do not wish to have these initial roles set up