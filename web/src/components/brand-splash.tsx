export function BrandSplashLockup({ className }: { className?: string }) {
  return (
    <div className={className ?? 'flex flex-col items-center px-8'}>
      <p className="font-sans text-5xl font-extrabold tracking-tight text-accent lowercase">potto</p>
      <p className="mt-3.5 text-center text-base text-[#5F6F66]">Your group. Your money. One Pot.</p>
      <div className="mt-5 h-1.5 w-9 rounded-full bg-accent" />
    </div>
  );
}
