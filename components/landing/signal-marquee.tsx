const phrases = [
  "Resolve identity",
  "Connect evidence",
  "Preserve uncertainty",
  "Synthesize the signal",
] as const;

export function SignalMarquee() {
  return (
    <div className="signal-ticker overflow-hidden py-5" aria-hidden="true">
      <div className="signal-marquee-track flex w-max items-center">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {phrases.map((phrase) => (
              <span
                key={`${copy}-${phrase}`}
                className="flex items-center gap-8 pr-8 font-mono text-[10px] tracking-[0.22em] uppercase"
              >
                {phrase}
                <span className="size-1 rounded-full" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
