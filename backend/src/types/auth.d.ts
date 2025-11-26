import '@auth/core/types';

declare module '@auth/core/types' {
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

