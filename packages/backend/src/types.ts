export type AppEnv = {
  Variables: {
    requestId: string;
    currentUser: {
      userId: number;
      email: string;
    };
  };
};
