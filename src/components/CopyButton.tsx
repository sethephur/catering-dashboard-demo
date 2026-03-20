import React, { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Inquiry } from "../shared-types";
import {
  copyToClipboard,
  generateEmailTemplate,
} from "../utils/helpers/helpers";
import { Button } from "./ui/button";

type CopyButtonProps = {
  inquiry: Inquiry;
  template?: string;
  body?: string;
};

const CopyButton: React.FC<CopyButtonProps> = ({ inquiry, template, body }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(body ?? generateEmailTemplate(template, inquiry));
        setCopied(true);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      <span>{copied ? "Copied" : "Copy email"}</span>
    </Button>
  );
};

export default CopyButton;
