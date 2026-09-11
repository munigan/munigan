export default function EntryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
