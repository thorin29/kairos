"use client";

import { useEffect, useState } from "react";
import { Combobox } from "@/components/combobox";
import { listEventNames } from "@/lib/actions/event-names";

/**
 * The event-name field: a styled combobox over the remembered event names
 * (alphabetical). You can still type a brand-new name — it saves and is added to
 * the list on submit. Fetches the name list itself so the event form doesn't
 * have to thread it through.
 */
export function EventNameCombobox(props: {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  fieldClassName?: string;
  autoFocus?: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    listEventNames()
      .then((r) => {
        if (alive) setOptions(r.names);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return <Combobox {...props} options={options} />;
}
