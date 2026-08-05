import Link from "next/link";

/**
 * Primary CTA styled as a stamped wax seal — the single committed accent
 * (wax-seal red) rationed to exactly this action and "sealed/complete"
 * status, never used decoratively elsewhere on the page.
 */
export function SealButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="ll-seal-button">
      <span className="ll-seal-button-ring" aria-hidden="true" />
      <span className="ll-seal-button-label">{children}</span>
    </Link>
  );
}
