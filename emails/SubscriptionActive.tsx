import { Button, Column, Heading, Hr, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/Layout";

export interface SubscriptionActiveEmailProps {
  userName: string;
  planName: string;
  priceLabel?: string;
  renewsAt?: string;
  manageLink?: string;
}

export default function SubscriptionActiveEmail({
  userName,
  planName,
  priceLabel,
  renewsAt,
  manageLink = "https://recruitable.se/mina-sidor",
}: SubscriptionActiveEmailProps) {
  return (
    <EmailLayout previewText={`Er prenumeration på ${planName} är aktiv`}>
      <Text className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.5px] text-muted-soft">Prenumeration aktiv</Text>
      <Heading className="m-0 mb-4 text-[20px] font-semibold text-ink">Tack, {userName}!</Heading>
      <Text className="m-0 mb-4 text-[15px] leading-[1.6] text-body">
        Er prenumeration är aktiverad och ert bolag har nu tillgång till premiumfunktionerna på Recruitable.
      </Text>

      <Section className="mb-4 rounded-[10px] border border-solid border-border bg-warm px-5 py-4">
        <Row>
          <Column>
            <Text className="m-0 text-[11px] uppercase tracking-[0.4px] text-muted-soft">Plan</Text>
            <Text className="m-0 mt-0.5 text-[15px] font-semibold text-ink">{planName}</Text>
          </Column>
          {priceLabel ? (
            <Column className="text-right">
              <Text className="m-0 text-[11px] uppercase tracking-[0.4px] text-muted-soft">Pris</Text>
              <Text className="m-0 mt-0.5 text-[15px] font-semibold text-ink">{priceLabel}</Text>
            </Column>
          ) : null}
        </Row>
        {renewsAt ? (
          <>
            <Hr className="my-3 border-border" />
            <Text className="m-0 text-[13px] text-muted">Förnyas {renewsAt}</Text>
          </>
        ) : null}
      </Section>

      <Button
        href={manageLink}
        className="mt-1.5 inline-block rounded-[8px] bg-rust px-[22px] py-[12px] text-[14px] font-semibold text-white no-underline"
      >
        Hantera prenumeration
      </Button>
      <Text className="m-0 mt-[22px] text-[12.5px] text-muted">
        Ni kan när som helst avsluta eller ändra er prenumeration under Mina sidor.
      </Text>
    </EmailLayout>
  );
}

SubscriptionActiveEmail.PreviewProps = {
  userName: "Anna",
  planName: "Premium",
  priceLabel: "990 kr/mån",
  renewsAt: "12 september 2026",
  manageLink: "https://recruitable.se/mina-sidor",
} as SubscriptionActiveEmailProps;
