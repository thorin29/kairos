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
    <ButtonLink href={href} variant="filled" size="md">
      <ArrowLeftIcon className="h-4 w-4" />
      <HomeIcon className="h-4 w-4" />
      {label}
    </ButtonLink>
  );
}
