import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-medium tracking-tight">Headroom</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Know what you can actually afford.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-base">
          Not what you spent — what you can safely do next.
        </p>
      </main>
    </div>
  );
}
