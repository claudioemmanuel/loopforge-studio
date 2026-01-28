import { cn } from "@/lib/utils";

interface ProseContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ProseContent({ children, className }: ProseContentProps) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div
        className={cn(
          "prose prose-lg dark:prose-invert max-w-none",
          "prose-headings:font-serif prose-headings:tracking-tight",
          "prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4",
          "prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3",
          "prose-p:text-muted-foreground prose-p:leading-relaxed",
          "prose-li:text-muted-foreground",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-strong:text-foreground prose-strong:font-semibold",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
