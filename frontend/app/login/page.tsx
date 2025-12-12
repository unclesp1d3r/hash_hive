import { LoginForm } from '../../components/auth/login-form';

/**
 * Login page that renders the LoginForm component.
 *
 * @returns A React element containing the login page with the LoginForm component
 */
export default function LoginPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign in to HashHive</h1>
        <LoginForm />
      </div>
    </main>
  );
}
