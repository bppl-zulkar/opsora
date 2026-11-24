import Image from "next/image";

export function Logo({
  src,
  name = "Company",
}: {
  src?: string;
  name?: string;
}) {
  return (
    <span className="logo" aria-label={`Opsora and ${name}`}>
      <Image
        className="opsora-logo"
        src="/opsora-logo.png"
        alt="Opsora"
        width={180}
        height={58}
        unoptimized
      />
      {src && <span className="brand-divider" aria-hidden="true" />}
      {src && (
        <Image
          className="company-logo"
          src={src}
          alt={`${name} logo`}
          width={54}
          height={42}
          unoptimized
        />
      )}
    </span>
  );
}
