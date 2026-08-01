import type { JSX } from "react";
import { useTranslation } from "../000-core/i18n";
import { footerDict } from "./footer.i18n";

export function Footer(): JSX.Element {
  const { t, lang } = useTranslation(footerDict);

  return (
    <footer className="w-full border-t border-border px-5 pt-8 pb-10 text-[0.85rem]">
      <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
        <div>
          <a
            href="index.html"
            className="inline-flex items-center gap-2 text-sm font-semibold text-text no-underline hover:underline"
          >
            <img src="/logo/OIX.png" alt="" className="h-6 w-6 rounded-full" />
            OpenInvoiceXML
          </a>
          <ul className="mt-3 list-none space-y-1.5 p-0">
            <li>
              <a
                className="text-text-muted no-underline hover:underline"
                href="https://www.prototypefund.de/projects/openinvoicexml"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.project}
              </a>
            </li>
            <li>
              <a
                className="text-text-muted no-underline hover:underline"
                href="https://github.com/HongbaeKim/openinvoicexml/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.license}
              </a>
            </li>
            <li>
              <a
                className="text-text-muted no-underline hover:underline"
                href="https://github.com/HongbaeKim/openinvoicexml"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.github}
              </a>
            </li>
            <li>
              <a className="text-text-muted no-underline hover:underline" href="privacy.html">
                {t.privacy}
              </a>
            </li>
            <li>
              <a className="text-text-muted no-underline hover:underline" href="impressum.html">
                {t.impressum}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">
            {t.funding}
          </p>
          <div className="flex flex-row items-center gap-3">
            <img
              src={`/logo/${lang}/BMFTR_${lang}.png`}
              alt={t.bmftrAlt}
              className="h-30 w-auto rounded-md bg-white px-2.5 py-2"
            />
            <img
              src={`/logo/${lang}/P_${lang}.png`}
              alt={t.prototypeFundAlt}
              className="h-30 w-auto rounded-md bg-white px-2.5 py-2"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
