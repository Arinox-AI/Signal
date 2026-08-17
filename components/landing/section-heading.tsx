export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.2em] text-blue-200/65 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl leading-[1.02] font-medium tracking-[-0.055em] text-balance text-white sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}
