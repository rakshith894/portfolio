import type { Metadata } from 'next';
import './globals.css';
const origin = 'https://nocturne-rakshith.rrrrrr666666rrr666.chatgpt.site';
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: 'Nocturne — Rakshith | Creative Developer',
  description:
    'Some stories refuse to stay buried. Enter Nocturne, an atmospheric interactive portfolio by Rakshith.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Nocturne — A world by Rakshith',
    description:
      'An interactive portfolio. Some stories refuse to stay buried.',
    type: 'website',
    url: origin,
    images: [
      {
        url: `${origin}/og.png`,
        width: 1734,
        height: 907,
        alt: 'Nocturne. A world by Rakshith. Some stories refuse to stay buried.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nocturne — A world by Rakshith',
    description:
      'An interactive portfolio. Some stories refuse to stay buried.',
    images: [`${origin}/og.png`],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
