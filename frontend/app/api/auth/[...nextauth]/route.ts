import NextAuth, { type User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Destructuring breaks with process.env
const envApiUrl = process.env['NEXT_PUBLIC_API_URL'];
const API_URL = typeof envApiUrl === 'string' ? envApiUrl : 'http://localhost:3001';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_REDIRECT = 302;

// Helper to validate credentials
function isValidCredentials(
  credentials: { email?: string; password?: string } | undefined
): credentials is { email: string; password: string } {
  return (
    credentials !== undefined &&
    typeof credentials.email === 'string' &&
    credentials.email !== '' &&
    typeof credentials.password === 'string' &&
    credentials.password !== ''
  );
}

// Helper to authenticate user with backend
async function authenticateUser(email: string, password: string): Promise<User | null> {
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- Response structure is dynamic
  const userData = sessionData.user as User | undefined;
  return userData ?? null;
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
      async authorize(credentials): Promise<User | null> {
        if (!isValidCredentials(credentials)) {
          return null;
        }

        try {
          return await authenticateUser(credentials.email, credentials.password);
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
        // eslint-disable-next-line no-param-reassign, @typescript-eslint/prefer-destructuring, @typescript-eslint/dot-notation -- NextAuth requires mutating token object, TS4111 requires bracket notation
        token['id'] = user['id'];
        // eslint-disable-next-line no-param-reassign, @typescript-eslint/prefer-destructuring, @typescript-eslint/dot-notation -- NextAuth requires mutating token object, TS4111 requires bracket notation
        token['email'] = user['email'];
        // eslint-disable-next-line no-param-reassign, @typescript-eslint/prefer-destructuring, @typescript-eslint/dot-notation -- NextAuth requires mutating token object, TS4111 requires bracket notation
        token['name'] = user['name'];
        // eslint-disable-next-line no-param-reassign, @typescript-eslint/prefer-destructuring, @typescript-eslint/dot-notation -- NextAuth requires mutating token object, TS4111 requires bracket notation
        token['roles'] = user['roles'];
      }
      return token;
    },
    session({ session, token }) {
      const { user } = session;
      // user object exists in all valid sessions
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- user could theoretically be undefined
      if (user !== undefined) {
        // Destructure standard JWT properties
        const { email: tokenEmail, name: tokenName } = token;
        // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Cannot destructure index signature properties
        const tokenId = token['id'];
        // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Cannot destructure index signature properties
        const tokenRoles = token['roles'];

        user.id = typeof tokenId === 'string' ? tokenId : '';

        user.email = typeof tokenEmail === 'string' ? tokenEmail : null;

        user.name = typeof tokenName === 'string' ? tokenName : '';

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Type guard ensures array
        user.roles = Array.isArray(tokenRoles) ? (tokenRoles as string[]) : [];
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
