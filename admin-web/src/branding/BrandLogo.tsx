import "./brand-logo.css";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      className={`susumu-group-logo ${className}`.trim()}
      src="/branding/susumu-group-logo.jpg"
      alt="Susumu Group"
      width={976}
      height={1076}
      decoding="async"
    />
  );
}
