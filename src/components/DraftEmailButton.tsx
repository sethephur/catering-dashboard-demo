import React from "react";
import { MailPlus } from "lucide-react";
import { Inquiry } from "../shared-types";
import { generateEmailTemplate } from "../utils/helpers/helpers";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { EMAIL_SUBJECT_PREFIX } from "@/config/appInfo";

type DraftEmailButtonProps = {
  inquiry: Inquiry;
  template?: string;
  body?: string;
};

const DraftEmailButton: React.FC<DraftEmailButtonProps> = ({
  inquiry,
  template,
  body,
}) => {
  const handleDraftEmail = () => {
    const subject = `${EMAIL_SUBJECT_PREFIX} — ${
      inquiry.company
        ? inquiry.company
        : inquiry.firstName + ` ` + inquiry.lastName
    }`;
    const renderedBody = body ?? generateEmailTemplate(template, inquiry);
    const email = inquiry?.email || "";
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(renderedBody)}`;
    window.location.href = mailtoLink;
    toast.success("Drafting you new email!", {
      position: "top-center",
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={(e) => {
        e.stopPropagation();
        handleDraftEmail();
      }}
    >
      <MailPlus className="size-4" />
      <span>Draft email</span>
    </Button>
  );
};

export default DraftEmailButton;
