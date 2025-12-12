import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HashHive',
  description: 'Distributed password cracking platform',
};

/**
 * Render the application's root HTML layout and wrap content with app providers.
 *
 * @param children - The React nodes to render inside the document body; they are wrapped with the app's Providers.
 * @returns The root React element containing an `<html lang="en">` element and a `<body>` that applies the Inter font and renders the providers-wrapped children.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
