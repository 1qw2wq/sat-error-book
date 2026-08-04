import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'SAT Error Book',
  description: 'AI-Powered SAT Error Log with instant screenshot auto-extraction, active recall flashcards, and weak spot analytics.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
