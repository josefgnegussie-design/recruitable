import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/Layout";

export interface WelcomeConfirmEmailProps {
  userName: string;
  confirmLink: string;
}

export default function WelcomeConfirmEmail({ userName, confirmLink }: WelcomeConfirmEmailProps) {
  return (
    <EmailLayout previewText="Bekräfta ditt konto på Recruitable">
      <Text className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.5px] text-muted-soft">Bekräfta konto</Text>
      <Heading className="m-0 mb-4 text-[20px] font-semibold text-ink">Välkommen till Recruitable, {userName}!</Heading>
      <Text className="m-0 mb-4 text-[15px] leading-[1.6] text-body">
        Klicka på knappen nedan för att bekräfta din e-postadress och aktivera ditt konto.
      </Text>
      <Text className="m-0 mb-4 text-[15px] leading-[1.6] text-body">
        När det är gjort granskar vi er begäran manuellt — ni får besked så snart kontot är godkänt.
      </Text>
      <Button
        href={confirmLink}
        className="mt-1.5 inline-block rounded-[8px] bg-rust px-[22px] py-[12px] text-[14px] font-semibold text-white no-underline"
      >
        Bekräfta konto
      </Button>
      <Text className="m-0 mt-[22px] text-[12.5px] text-muted">
        Om du inte skapat ett konto på recruitable.se kan du ignorera det här mejlet.
      </Text>
    </EmailLayout>
  );
}

WelcomeConfirmEmail.PreviewProps = {
  userName: "Anna",
  confirmLink: "https://recruitable.se/verifiera?token=exempel",
} as WelcomeConfirmEmailProps;
