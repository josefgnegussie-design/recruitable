import { Body, Column, Container, Head, Html, Preview, Row, Section, Tailwind, Text } from "@react-email/components";
import * as React from "react";

// Delad ram för alla React Email-mallar — samma Recruitable-branding (mörk
// header med loggan, vitt kort) som redan används i lib/email.js, så de två
// mejlsystemen inte kan glida isär visuellt. Egna färger istället för
// Tailwinds standardpalett, hämtade rakt av från app/globals.css.
const emailColors = {
  navy: "#0f2229",
  rust: "#d97b3f",
  cream: "#f2efe9",
  warm: "#f4f2ee",
  border: "#ddd9d1",
  ink: "#16211f",
  body: "#3d4644",
  muted: "#6b7573",
  "muted-soft": "#828b89",
};

interface EmailLayoutProps {
  previewText: string;
  children: React.ReactNode;
}

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html lang="sv">
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind config={{ theme: { extend: { colors: emailColors } } }}>
        <Body className="bg-warm font-sans">
          <Container className="mx-auto max-w-[560px] py-10">
            <Section className="rounded-t-[10px] bg-navy px-7 py-[22px]">
              <Row>
                <Column className="w-[26px]">
                  <div
                    style={{ width: 15, height: 15, transform: "rotate(45deg)" }}
                    className="rounded-[3px] bg-rust"
                  />
                </Column>
                <Column>
                  <Text className="m-0 text-[19px] font-semibold tracking-[0.2px] text-cream">Recruitable</Text>
                </Column>
              </Row>
            </Section>
            <Section className="rounded-b-[10px] border border-t-0 border-solid border-border bg-white px-7 py-7">
              {children}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
