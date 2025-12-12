'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from '../../lib/auth';

const MIN_PASSWORD_LENGTH = 1;

const loginSchema = z.object({
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().email() is the recommended pattern for now
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(MIN_PASSWORD_LENGTH, { message: 'Password is required' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Render a login form that authenticates using credentials and navigates to the dashboard on success.
 *
 * The form validates email and password with the Zod schema, shows per-field and general error messages,
 * disables inputs and the submit button while signing in, and redirects to `/dashboard` after a successful sign-in.
 *
 * @returns A React element containing the login form
 */
export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error !== undefined) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      // Redirect to dashboard on success
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('An error occurred during login');
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="space-y-4"
    >
      {error !== null && error !== '' && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={errors.email === undefined ? 'false' : 'true'}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          disabled={isLoading}
        />
        {errors.email?.message !== undefined && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          disabled={isLoading}
        />
        {errors.password?.message !== undefined && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}
