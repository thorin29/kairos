"use client";

import { useState, useTransition } from "react";
import { setUserKind } from "@/lib/actions/people";
import { Segmented } from "./segmented";

export function KindToggle({
  userId,
  isParent,
  lockedParent,
}: {
  userId: string;
  isParent: boolean;
  /** Admins are always parents, so their kind can't be changed here. */
  lockedParent: boolean;
}) {
  const [value, setValue] = useState(isParent ? "PARENT" : "CHILD");
  const [pending, start] = useTransition();

  return (
    <Segmented
      options={[
        { value: "CHILD", label: "Child" },
        { value: "PARENT", label: "Parent" },
      ]}
      value={value}
      busy={pending}
      // Admins must stay Parent — lock the Child option.
      disabledValues={lockedParent ? ["CHILD"] : []}
      onSelect={(next) =>
        start(async () => {
          const r = await setUserKind({
            userId,
            kind: next === "PARENT" ? "PARENT" : "CHILD",
          });
          if (!r.error) setValue(next);
          else alert(r.error);
        })
      }
    />
  );
}
