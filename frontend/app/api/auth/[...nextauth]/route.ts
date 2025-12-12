import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Destructuring breaks with process.env
const envApiUrl = process.env['NEXT_PUBLIC_API_URL'];
const API_URL = typeof envApiUrl === 'string' ? envApiUrl : 'http://localhost:3001';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_REDIRECT = 302;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- NextAuth returns a handler function
const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (
          typeof email !== 'string' ||
          email === '' ||
          typeof password !== 'string' ||
          password === ''
        ) {
          return null;
        }

        try {
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


          const sessionData = (await sessionResponse.json()) as { user?: unknown };
          const { user: userData } = sessionData;

          return userData ?? null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user !== null && user !== undefined) {
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
      if (user !== null && user !== undefined) {
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
