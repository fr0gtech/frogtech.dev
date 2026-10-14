export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="container mx-auto max-w-7xl px-6 pt-24 flex flex-col items-center justify-center gap-4 pb-10">
      <div className="inline-block w-full text-center justify-center">
        {children}
      </div>
    </section>
  );
}
