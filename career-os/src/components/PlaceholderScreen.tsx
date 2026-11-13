export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{note}</p>
      </div>
    </div>
  );
}
