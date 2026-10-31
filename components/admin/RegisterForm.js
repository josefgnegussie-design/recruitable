"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { YRKESOMRADEN, TJANSTER } from "@/lib/taxonomy";
import { domanMatchar } from "@/lib/overtagande";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import MultiSelectField from "@/components/MultiSelectField";
import PasswordField from "@/components/PasswordField";
import ForetagsSok from "@/components/admin/ForetagsSok";
import SkrappostPaminnelse from "@/components/SkrappostPaminnelse";

const EMPTY_FORM = {
  steg: "bolag",
  name: "",
  email: "",
  companyName: "",
  orgNumber: "",
  gatuadress: "",
  postnummer: "",
  postort: "",
  website: "",
  focusAreas: [],
  services: [],
};

// Bolag som redan finns i registret behöver bara välja bolag och skapa konto:
// allt annat kan fyllas i på Mina sidor. Bara ett bolag som saknas i registret
// går via uppgiftssteget, eftersom kortet då skapas ur ansökan.
export default function RegisterForm({ forifyllt = null, inloggadEpost = null }) {
  const router = useRouter();

  // Allt utom lösenordet sparas som utkast, så att stegen går att backa i och
  // rätta — även efter en omladdning eller webbläsarens bakåtknapp.
  const { state: form, patch, restored, clearDraft } = useSessionDraft("registrera-v2", EMPTY_FORM);

  // Lösenordet ligger utanför utkastet och överlever därför varken omladdning
  // eller stängd flik.
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [klar, setKlar] = useState(null);
  const [skickatIgen, setSkickatIgen] = useState("");
  const [kontoFinns, setKontoFinns] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileFailed, setTurnstileFailed] = useState(false);
  const handleTurnstileVerify = useCallback((token) => setTurnstileToken(token), []);
  const handleTurnstileError = useCallback((failed) => setTurnstileFailed(failed), []);

  const [lookup, setLookup] = useState({ status: "idle", info: null, message: "" });
  const lastLookedUpOrgnr = useRef("");

  // Registrets svar på valt bolag. Forifyllt är samma sak, känt från start.
  const [register, setRegister] = useState(forifyllt ? { finns: true, ...forifyllt } : null);

  const { steg, email, website } = form;
  const epost = inloggadEpost || email;
  const iRegistret = Boolean(register?.finns);
  const stegen = iRegistret ? ["bolag", "konto"] : ["bolag", "uppgifter", "konto"];

  // Ett bolag från en inbjudan är redan valt, så första steget har inget att fråga.
  useEffect(() => {
    if (restored && forifyllt && steg === "bolag") patch({ steg: "konto" });
  }, [restored, forifyllt, steg, patch]);

  // Webbplatsen fylls åt användaren när den går att härleda, men rör aldrig
  // något hen själv skrivit.
  useEffect(() => {
    if (steg !== "uppgifter" || website) return;
    const domain = String(email || "").split("@")[1];
    if (domain) patch({ website: `www.${domain.trim().toLowerCase()}` });
  }, [steg, website, email, patch]);

  // Registrets svar sparas inte i utkastet, så en omladdning mitt i formuläret
  // måste fråga igen. Annars skulle ett bolag i registret se ut som ett nytt.
  useEffect(() => {
    if (restored && !forifyllt && form.orgNumber) slaUpp(form.orgNumber);
    // Bara när utkastet lästs in; slaUpp skyddar sig mot upprepade uppslag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  async function slaUpp(rawOrgnr) {
    const digits = String(rawOrgnr || "").replace(/\D/g, "");
    if (digits.length !== 10 || digits === lastLookedUpOrgnr.current) return;
    lastLookedUpOrgnr.current = digits;

    setRegister(null);
    setLookup({ status: "loading", info: null, message: "" });

    try {
      // Först: svaret avgör vilka steg som återstår, så Nästa väntar in det.
      const status = await fetch(`/api/foretag/registerstatus?orgnr=${digits}`);
      setRegister(status.ok ? await status.json() : null);

      const res = await fetch(`/api/foretag/uppslag?orgnr=${encodeURIComponent(digits)}`);
      const body = await res.json();
      if (!res.ok) {
        setLookup({ status: "miss", info: null, message: body.error || "Hittade inget bolag." });
        return;
      }
      // Skriv bara i fält som är tomma — det användaren själv fyllt i väger tyngre
      // än registerdatan, t.ex. när kontoret ligger på en annan adress än sätet.
      patch((prev) => ({
        orgNumber: body.orgnr || prev.orgNumber,
        companyName: prev.companyName || body.namn || "",
        gatuadress: prev.gatuadress || body.gatuadress || "",
        postnummer: prev.postnummer || body.postnummer || "",
        postort: prev.postort || body.postort || "",
      }));
      setLookup({ status: "ok", info: body, message: "" });
    } catch {
      setLookup({ status: "miss", info: null, message: "Kunde inte nå registret just nu." });
    }
  }

  function handleSelectCompany(candidate) {
    lastLookedUpOrgnr.current = "";
    patch({
      companyName: candidate.namn,
      orgNumber: candidate.orgnr,
      gatuadress: candidate.gatuadress || "",
      postnummer: candidate.postnummer || "",
      postort: candidate.postort || "",
    });
    slaUpp(candidate.orgnr);
  }

  function nasta(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("idle");
    patch({ steg: stegen[stegen.indexOf(steg) + 1] });
  }

  function goBack() {
    setErrorMsg("");
    setStatus("idle");
    patch({ steg: stegen[Math.max(0, stegen.indexOf(steg) - 1)] });
  }

  function removeFocusArea(area) {
    patch({ focusAreas: form.focusAreas.filter((a) => a !== area) });
  }

  function removeService(service) {
    patch({ services: form.services.filter((s) => s !== service) });
  }

  // Stämmer inte adressen får personen veta det här, innan något skickats, och
  // väljer själv om ansökan ska granskas för hand.
  const adressMatchar = domanMatchar(epost, register?.doman ? `https://${register.doman}` : null);
  const felDoman = Boolean(iRegistret && register.doman && String(epost).includes("@") && !adressMatchar);

  async function skicka(manuell = false) {
    setErrorMsg("");
    setKontoFinns(false);

    if (!iRegistret && (form.focusAreas.length === 0 || form.services.length === 0)) {
      setStatus("error");
      setErrorMsg("Välj minst ett yrkesområde och minst en tjänst.");
      return;
    }

    setStatus("loading");

    const res = await fetch("/api/auth/registrera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namn: form.name,
        epost,
        losenord: inloggadEpost ? undefined : password,
        companySlug: iRegistret ? register.slug : null,
        nyttBolag: iRegistret
          ? null
          : {
              companyName: form.companyName,
              orgNumber: form.orgNumber,
              gatuadress: form.gatuadress,
              postnummer: form.postnummer,
              postort: form.postort,
              website: form.website,
              focusAreas: form.focusAreas,
              services: form.services,
            },
        manuell,
        turnstileToken,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(body.error || "Något gick fel. Kontakta info@recruitable.se.");
      setKontoFinns(body.kod === "konto_finns");
      return;
    }

    // Begäran är inne — utkastet ska inte ligga kvar och dyka upp nästa gång.
    clearDraft();

    if (body.aktiverad) {
      router.push("/mina-sidor?valkommen=1");
      router.refresh();
      return;
    }

    setKlar({ lage: body.lage, epost: body.epost });
    setStatus("success");
  }

  async function skickaIgen() {
    setSkickatIgen("");
    const { error } = await createClient().auth.resend({ type: "signup", email: klar.epost });
    setSkickatIgen(error ? "Vänta en minut och försök igen." : "Ett nytt mejl är på väg.");
  }

  // Vänta med att rita formuläret tills utkastet lästs in, så att användaren inte
  // hinner se tomma fält som en sekund senare fylls i.
  if (!restored) {
    return <div className="auth-panel" aria-busy="true" />;
  }

  if (status === "success" && klar) {
    const automatisk = klar.lage === "automatisk";
    return (
      <div className="auth-panel granskning-ruta" role="status">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Ett steg kvar</div>
        <h2 className="filter-title" style={{ fontSize: 20, marginBottom: 10 }}>
          Öppna mejlet till {klar.epost}
        </h2>
        <ol className="granskning-steg">
          <li className="klart">{inloggadEpost ? "Ansökan är inskickad" : "Kontot är skapat"}</li>
          {!inloggadEpost && <li className="pagar">Klicka på länken i mejlet för att bekräfta adressen</li>}
          {automatisk ? (
            <li>Då är du bolagets administratör direkt och kommer till Mina sidor</li>
          ) : (
            <li className={inloggadEpost ? "pagar" : undefined}>
              Recruitable granskar ansökan, oftast inom en till två arbetsdagar, och du får besked via mejl
            </li>
          )}
        </ol>
        <SkrappostPaminnelse adress={klar.epost} />
        {!inloggadEpost && (
          <p style={{ fontSize: 14, marginBottom: 0 }}>
            Inget mejl?{" "}
            <button type="button" className="link-btn" onClick={skickaIgen}>
              Skicka igen
            </button>{" "}
            {skickatIgen}
          </p>
        )}
      </div>
    );
  }

  const stegText = `Steg ${stegen.indexOf(steg) + 1} av ${stegen.length}`;

  if (steg === "bolag") {
    return (
      <form className="auth-panel" onSubmit={nasta}>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
          {stegText} — Ert bolag
        </p>
        <div className="field">
          <label htmlFor="reg-company-name">Företagsnamn</label>
          <ForetagsSok
            id="reg-company-name"
            value={form.companyName}
            onChange={(value) => patch({ companyName: value })}
            onSelect={handleSelectCompany}
          />
          <p className="hint">Börja skriva så söker vi upp bolaget åt dig.</p>
        </div>
        <div className="field">
          <label htmlFor="reg-org-number">Org.nummer</label>
          <input
            id="reg-org-number"
            type="text"
            placeholder="XXXXXX-XXXX"
            value={form.orgNumber}
            onChange={(e) => patch({ orgNumber: e.target.value })}
            onBlur={(e) => slaUpp(e.target.value)}
            required
          />
          {lookup.status === "loading" && <p className="hint">Hämtar uppgifter…</p>}
          {lookup.status === "miss" && <p className="hint">{lookup.message}</p>}
          {(lookup.info?.avregistrerad || lookup.info?.aktiv === false) && (
            <p className="hint" style={{ color: "#c0392b" }}>
              Registret anger bolaget som {lookup.info.avregistrerad ? "avregistrerat" : "ej verksamt"} — kontrollera
              att org.numret stämmer.
            </p>
          )}
          {register?.finns && !register.hinder && (
            <p className="hint" style={{ color: "var(--color-success)" }}>
              {register.namn} finns i registret.
              {register.doman ? ` Du behöver en adress på @${register.doman}.` : ""}
            </p>
          )}
          {register?.hinder && (
            <p className="hint" style={{ color: "#c0392b" }}>
              {register.hinder}
            </p>
          )}
          {register && !register.finns && lookup.status === "ok" && (
            <p className="hint">Bolaget finns inte i registret än. Vi lägger till det efter en kort granskning.</p>
          )}
        </div>
        <button className="qs-btn" type="submit" disabled={Boolean(register?.hinder) || lookup.status === "loading"}>
          Nästa
        </button>
      </form>
    );
  }

  if (steg === "uppgifter") {
    return (
      <form className="auth-panel" onSubmit={nasta}>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
          {stegText} — Uppgifter om {form.companyName || "bolaget"}
        </p>
        <div className="field">
          <label htmlFor="reg-website">Webbplats</label>
          <input
            id="reg-website"
            type="text"
            placeholder="www.bolaget.se"
            value={form.website}
            onChange={(e) => patch({ website: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-gatuadress">Gatuadress</label>
          <input
            id="reg-gatuadress"
            type="text"
            placeholder="Storgatan 1"
            value={form.gatuadress}
            onChange={(e) => patch({ gatuadress: e.target.value })}
            autoComplete="street-address"
            required
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="reg-postnummer">Postnummer</label>
            <input
              id="reg-postnummer"
              type="text"
              inputMode="numeric"
              placeholder="411 34"
              value={form.postnummer}
              onChange={(e) => patch({ postnummer: e.target.value })}
              autoComplete="postal-code"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reg-postort">Postort</label>
            <input
              id="reg-postort"
              type="text"
              placeholder="Göteborg"
              value={form.postort}
              onChange={(e) => patch({ postort: e.target.value })}
              autoComplete="address-level2"
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="reg-add-service">Tjänster</label>
          <MultiSelectField
            id="reg-add-service"
            options={TJANSTER}
            selected={form.services}
            onChange={(services) => patch({ services })}
            placeholder="Välj tjänster..."
          />
          {form.services.length > 0 && (
            <div className="chip-list">
              {form.services.map((service) => (
                <span className="chip" key={service}>
                  {service}
                  <button type="button" onClick={() => removeService(service)} aria-label={`Ta bort ${service}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="reg-add-area">Yrkesområden ni rekryterar inom</label>
          <MultiSelectField
            id="reg-add-area"
            options={Object.keys(YRKESOMRADEN)}
            selected={form.focusAreas}
            onChange={(focusAreas) => patch({ focusAreas })}
            placeholder="Välj yrkesområden..."
          />
          {form.focusAreas.length > 0 && (
            <div className="chip-list">
              {form.focusAreas.map((area) => (
                <span className="chip" key={area}>
                  {area}
                  <button type="button" onClick={() => removeFocusArea(area)} aria-label={`Ta bort ${area}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="step-nav">
          <button className="btn btn-ghost" type="button" onClick={goBack}>
            &larr; Tillbaka
          </button>
          <button className="qs-btn" type="submit">Nästa</button>
        </div>
      </form>
    );
  }

  const utanTurnstile = TURNSTILE_SITE_KEY && !turnstileToken;

  return (
    <form
      className="auth-panel"
      onSubmit={(e) => {
        e.preventDefault();
        skicka(false);
      }}
    >
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
        {stegText} — Ditt konto{register?.namn ? ` för ${register.namn}` : ""}
      </p>
      <div className="field">
        <label htmlFor="reg-name">För- & Efternamn</label>
        <input
          id="reg-name"
          type="text"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          autoComplete="name"
          required
        />
      </div>
      {inloggadEpost ? (
        <p className="hint" style={{ marginTop: 0 }}>Du ansöker som {inloggadEpost}.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="reg-email">E-post på bolagets domän</label>
            <input
              id="reg-email"
              type="email"
              placeholder={register?.doman ? `namn@${register.doman}` : "namn@bolaget.se"}
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
              autoComplete="email"
              required
            />
            {adressMatchar && (
              <p className="hint" style={{ color: "var(--color-success)" }}>
                Adressen matchar bolagets webbplats. Du blir administratör så snart den är bekräftad.
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="reg-password">Lösenord</label>
            <PasswordField id="reg-password" value={password} onChange={setPassword} required minLength={8} />
          </div>
        </>
      )}

      {felDoman && (
        <div className="login-notis" role="alert">
          <p style={{ marginTop: 0 }}>
            Adressen matchar inte bolagets webbplats ({register.doman}). Byt till din adress på @{register.doman}{" "}
            så går det direkt.
          </p>
          <p style={{ marginBottom: 0 }}>
            Har ni en annan mejldomän, till exempel en koncernadress?{" "}
            <button
              type="button"
              className="link-btn"
              disabled={status === "loading" || utanTurnstile}
              onClick={() => skicka(true)}
            >
              Skicka för granskning i stället
            </button>
          </p>
        </div>
      )}

      {iRegistret && !register.doman && (
        <p className="hint">
          Bolaget saknar webbplats i registret, så en person på Recruitable granskar ansökan. Det tar oftast en till två
          arbetsdagar.
        </p>
      )}

      <Turnstile onVerify={handleTurnstileVerify} onError={handleTurnstileError} />

      {turnstileFailed && (
        <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>
          Robotkontrollen kunde inte genomföras, så det går inte att skicka just nu. Ladda om sidan
          och försök igen — dina uppgifter finns kvar. Kvarstår felet, hör av dig till
          info@recruitable.se så tar vi emot er begäran manuellt.
        </p>
      )}

      {status === "error" && (
        <p style={{ color: "#c0392b", fontSize: 13, marginTop: 16 }}>
          {errorMsg}{" "}
          {kontoFinns && (
            <Link
              href={`/logga-in?next=${encodeURIComponent(
                `/for-bolag/registrera${register?.slug ? `?bolag=${register.slug}` : ""}`
              )}`}
            >
              Logga in
            </Link>
          )}
        </p>
      )}
      <div className="step-nav" style={{ marginTop: 20 }}>
        {!forifyllt && (
          <button className="btn btn-ghost" type="button" onClick={goBack} disabled={status === "loading"}>
            &larr; Tillbaka
          </button>
        )}
        <button className="qs-btn" type="submit" disabled={status === "loading" || utanTurnstile || felDoman}>
          {status === "loading" ? "Skickar..." : iRegistret ? "Skapa konto och ta över" : "Skicka ansökan"}
        </button>
      </div>
    </form>
  );
}
