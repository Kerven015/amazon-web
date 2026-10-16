import { Logo } from "./logo";

/** Full-page shell for 404 / error states (rendered outside the shop layout). */
export function StatusPage({
  code,
  title,
  body,
  children,
}: {
  code: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b px-4 py-5 text-center">
        <Logo />
      </header>
      <main id="main" className="grid flex-1 place-items-center px-4 py-16">
        <div className="max-w-lg text-center">
          <p className="font-serif text-8xl text-muted-foreground/60 sm:text-9xl">
            {code}
          </p>
          <h1 className="mt-4 text-balance text-4xl [overflow-wrap:anywhere] hyphens-auto sm:text-5xl">{title}</h1>
          <p className="mt-2 text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">{children}</div>
        </div>
      </main>
    </div>
  );
}
