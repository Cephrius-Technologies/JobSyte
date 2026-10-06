
export function MainView({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      {children}
    </div>
  );
}
