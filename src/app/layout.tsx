import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Samjhao",
  description:
    "A live Hinglish doubt tutor that explains notes with grounded Indian analogies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
