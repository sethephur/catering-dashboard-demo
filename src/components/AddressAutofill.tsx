import * as React from "react";
import "@mapbox/search-js-web";
import { Input } from "@/components/ui/input";

// Local typing for the Mapbox web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "mapbox-address-autofill": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "access-token"?: string;
        country?: string;
      };
    }
  }
}

export type AddressAutofillProps = {
  value: string;
  onChange: (v: string) => void;
  onSelected?: (formattedAddress: string) => void;
  token?: string;
  placeholder?: string;
};

export const AddressAutofill: React.FC<AddressAutofillProps> = ({
  value,
  onChange,
  onSelected,
  token = import.meta.env.VITE_MAPBOX_TOKEN,
  placeholder = "Start typing an address…",
}) => {
  const wrapperRef = React.useRef<any>(null);

  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: any) => {
      const f = e?.detail?.features?.[0];
      const formatted = f?.properties?.full_address || f?.place_name;
      if (formatted) onSelected?.(formatted);
    };
    el.addEventListener("retrieve", handler);
    return () => el.removeEventListener("retrieve", handler);
  }, [onSelected]);

  return (
    // @ts-ignore – web component
    <mapbox-address-autofill ref={wrapperRef} access-token={token} country="us">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </mapbox-address-autofill>
  );
};

export default AddressAutofill;
