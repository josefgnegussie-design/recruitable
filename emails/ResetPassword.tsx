import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/Layout";

export interface ResetPasswordEmailProps {
  userName?: string;
  resetLink: string;
}

export default function ResetPasswordEmail({ userName, resetLink }: ResetPasswordEmailProps) {
  return (
    <EmailLayout previewText="Återställ ditt lösenord på Recruitable">
      <Text className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.5px] text-muted-soft">Återställ lösenord</Text>
      <Heading className="m-0 mb-4 text-[20px] font-semibold text-ink">
        {userName ? `Hej ${userName}` : "Återställ ditt lösenord"}
      </Heading>
      <Text className="m-0 mb-4 text-[15px] leading-[1.6] text-body">
        Vi har fått en begäran om att återställa lösenordet för ditt konto på recruitable.se. Klicka på knappen
        nedan för att välja ett nytt.
      </Text>
      <Button
        href={resetLink}
        className="mt-1.5 inline-block rounded-[8px] bg-rust px-[22px] py-[12px] text-[14px] font-semibold text-white no-underline"
      >
        Återställ lösenord
      </Button>
      <Text className="m-0 mt-[22px] text-[12.5px] text-muted">
        Om du inte bett om det här kan du ignorera mejlet — ditt lösenord ändras inte förrän du klickar på länken
        och väljer ett nytt.
      </Text>
    </EmailLayout>
  );
}

ResetPasswordEmail.PreviewProps = {
  userName: "Anna",
  resetLink: "https://recruitable.se/aterstall-losenord?token=exempel",
} as ResetPasswordEmailProps;
