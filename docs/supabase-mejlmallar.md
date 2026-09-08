# Supabases auth-mejl

Kontobekräftelse och lösenordsåterställning skickas av Supabase Auth, inte av
`lib/email.js`. Mallarna redigeras i dashboarden och ligger alltså inte i git —
den här filen är källan, så att en ändring går att granska och återställa.

Redigeras på `https://supabase.com/dashboard/project/_/auth/templates`.

## Innan mallarna klistras in

1. **Eget SMTP** måste vara på (`.../auth/smtp`), annars gäller Supabases
   delade avsändare och taket på 2 mejl i timmen. Avsändare: `info@recruitable.se`,
   värd `smtp.resend.com`, port 465, användarnamn `resend`, lösenord = en
   Resend-nyckel avsedd bara för detta.
2. **Site URL** ska vara `https://recruitable.se` (`.../auth/url-configuration`).
   Det är den `{{ .SiteURL }}` nedan expanderar till.
3. **Stäng av extern klickspårning** i Resend för de här utskicken. Spårning
   skriver om länkarna, och då går token-hashen sönder.

## Varför länkarna ser ut som de gör

Webbläsarklienten bygger på `@supabase/ssr` och kör PKCE. Standardmallarnas
`{{ .ConfirmationURL }}` fungerar bara när länken öppnas i samma webbläsare som
begärde den — mejlet läses i praktiken ofta i mobilen medan begäran gjordes på
datorn. Mallarna pekar därför på `/auth/confirm` med en token-hash, som
`app/auth/confirm/route.js` växlar in mot en session på servern.

Ändras `next=`-värdet nedan måste sökvägen finnas i appen. Rutten släpper bara
igenom sökvägar på den egna sajten.

## Reset password

Ämnesrad: `Återställ ditt lösenord`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#16211f;">
  <div style="background:#0f2229;padding:22px 28px;border-radius:10px 10px 0 0;">
    <span style="color:#f2efe9;font-size:19px;font-weight:600;letter-spacing:0.2px;">Recruitable</span>
  </div>
  <div style="border:1px solid #ddd9d1;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
    <p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 10px;">Återställ lösenord</p>
    <h2 style="margin:0 0 16px;font-size:20px;">Välj ett nytt lösenord</h2>
    <div style="font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">Någon har begärt ett nytt lösenord för kontot <b>{{ .Email }}</b> på Recruitable. Klicka på knappen för att välja ett nytt.</p>
      <p style="margin:0;">Länken gäller en kort stund och bara en gång.</p>
    </div>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/aterstall-losenord"
       style="display:inline-block;background:#d97b3f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:22px;">Välj nytt lösenord</a>
    <p style="margin:22px 0 0;font-size:12.5px;color:#828b89;">Var det inte du som begärde det? Då behöver du inte göra något — lösenordet ändras inte förrän någon följt länken. Hör gärna av dig till <a href="mailto:info@recruitable.se" style="color:#828b89;">info@recruitable.se</a>.</p>
  </div>
</div>
```

## Confirm sign up

Ämnesrad: `Bekräfta din e-postadress`

`type=email` är den typ Supabase själva använder för registreringsbekräftelser.
`app/auth/confirm/route.js` godtar även `type=signup`, som äldre mallar använder.

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#16211f;">
  <div style="background:#0f2229;padding:22px 28px;border-radius:10px 10px 0 0;">
    <span style="color:#f2efe9;font-size:19px;font-weight:600;letter-spacing:0.2px;">Recruitable</span>
  </div>
  <div style="border:1px solid #ddd9d1;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
    <p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 10px;">Bekräfta e-postadressen</p>
    <h2 style="margin:0 0 16px;font-size:20px;">Välkommen till Recruitable</h2>
    <div style="font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">Bekräfta att <b>{{ .Email }}</b> är er adress, så att vi vet att kontot hör till er.</p>
      <p style="margin:0;">Därefter granskar vi ansökan och hör av oss när kontot är godkänt. Först då går det att logga in och fylla i profilen.</p>
    </div>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/mina-sidor"
       style="display:inline-block;background:#d97b3f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:22px;">Bekräfta e-postadressen</a>
    <p style="margin:22px 0 0;font-size:12.5px;color:#828b89;">Har ni inte ansökt om ett konto hos Recruitable kan ni bortse från det här mejlet.</p>
  </div>
</div>
```

## Change email address

Ämnesrad: `Bekräfta din nya e-postadress`

Skickas till den nya adressen när ett konto byter e-post.

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#16211f;">
  <div style="background:#0f2229;padding:22px 28px;border-radius:10px 10px 0 0;">
    <span style="color:#f2efe9;font-size:19px;font-weight:600;letter-spacing:0.2px;">Recruitable</span>
  </div>
  <div style="border:1px solid #ddd9d1;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
    <p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 10px;">Byte av e-postadress</p>
    <h2 style="margin:0 0 16px;font-size:20px;">Bekräfta den nya adressen</h2>
    <div style="font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">Kontot <b>{{ .Email }}</b> håller på att byta e-postadress till <b>{{ .NewEmail }}</b>.</p>
      <p style="margin:0;">Bekräfta bytet nedan. Fram till dess gäller den gamla adressen.</p>
    </div>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/mina-sidor"
       style="display:inline-block;background:#d97b3f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:22px;">Bekräfta bytet</a>
    <p style="margin:22px 0 0;font-size:12.5px;color:#828b89;">Känner ni inte igen bytet, hör av er till <a href="mailto:info@recruitable.se" style="color:#828b89;">info@recruitable.se</a> omgående.</p>
  </div>
</div>
```

## Mallar som ska lämnas orörda

- **Magic Link**, **Invite user**, **Reauthentication** — utlöses inte av någon
  kod i projektet.
- **Password changed** och de övriga säkerhetsnotiserna — `sendPasswordChangedEmail`
  i `lib/email.js` skickar redan det mejlet. Slås Supabases variant på får
  bolaget två mejl om samma sak, från två avsändare.
