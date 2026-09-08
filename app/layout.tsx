import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Before I Knew Your Name — Shreya’s Story', description: 'A 200-page romance in English and Tamil. A wrong classroom, a younger boy, and the long way to love.' };
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
