import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string | null;
      name: string;
      roles?: string[];
    };
  }

  interface User {
    id: string;
    email: string | null;
    name: string;
    roles?: string[];
  }
}
