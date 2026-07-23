import { ArrowLeftIcon, HomeIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";

/** Primary way back up a level, sized as a real target for tablet use. */
export function BackLink({
  href = "/",
  label = "Dashboard",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <ButtonLink href={href} variant="tonal" size="md">
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </ButtonLink>
  );
}

/** Repeated at the foot of long lists so leaving never needs a scroll up. */
export function DoneBar({
  href = "/",
  label = "Back to dashboard",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <div className="mt-10 border-t border-hairline pt-6">
      <ButtonLink href={href} variant="filled" size="lg" className="w-full">
        <HomeIcon className="h-5 w-5" />
        {label}
      </ButtonLink>
    </div>
  );
}
