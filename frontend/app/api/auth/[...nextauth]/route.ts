import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Destructuring breaks with process.env
const envApiUrl = process.env['NEXT_PUBLIC_API_URL'];
const API_URL = typeof envApiUrl === 'string' ? envApiUrl : 'http://localhost:3001';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_REDIRECT = 302;

// Helper to validate credentials
function isValidCredentials(
  email: unknown,
  password: unknown,
): email is string {
  return (
    typeof email === 'string' &&
    email !== '' &&
    typeof password === 'string' &&
    password !== ''
  );
}

// Helper to authenticate user with backend
async function authenticateUser(email: string, password: string): Promise<unknown> {
  // First, get CSRF token from backend (Auth.js requires this)
  await fetch(`${API_URL}/auth/signin/credentials`, {
    method: 'GET',
    credentials: 'include',
  });

  // Call backend Auth.js signin endpoint
  const response = await fetch(`${API_URL}/auth/signin/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      email,
      password,
    }),
    credentials: 'include',
    redirect: 'manual',
  });

  // Check if authentication was successful (302 redirect or 200 OK)
  if (response.status !== HTTP_STATUS_OK && response.status !== HTTP_STATUS_REDIRECT) {
    return null;
  }

  // Get user info from backend /api/v1/web/auth/me
  const sessionResponse = await fetch(`${API_URL}/api/v1/web/auth/me`, {
    credentials: 'include',
  });

  if (!sessionResponse.ok) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response is unknown from backend
  const sessionData = await sessionResponse.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Response structure is dynamic
  return sessionData.user ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- NextAuth returns a handler function
const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Reduce complexity by extracting validation and fetch logic
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (!isValidCredentials(email, password)) {
          return null;
        }

        try {
          return await authenticateUser(email, password);
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // user is only present on initial sign-in
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- user is optional based on callback timing
      if (user !== undefined) {
        const { id, email, name, roles } = user;
        // eslint-disable-next-line no-param-reassign -- NextAuth requires mutating token object
        token.id = id;
        // eslint-disable-next-line no-param-reassign -- NextAuth requires mutating token object
        token.email = email;
        // eslint-disable-next-line no-param-reassign -- NextAuth requires mutating token object
        token.name = name;
        // eslint-disable-next-line no-param-reassign -- NextAuth requires mutating token object
        token.roles = roles;
      }
      return token;
    },
    session({ session, token }) {
      const { user } = session;
      // user object exists in all valid sessions
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- user could theoretically be undefined
      if (user !== undefined) {
        const { id: tokenId, email: tokenEmail, name: tokenName, roles: tokenRoles } = token;

        user.id = typeof tokenId === 'string' ? tokenId : '';

        user.email = typeof tokenEmail === 'string' ? tokenEmail : null;

        user.name = typeof tokenName === 'string' ? tokenName : '';

        user.roles = tokenRoles;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});

export { handler as GET, handler as POST };
