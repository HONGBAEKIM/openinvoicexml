import type { JSX } from "react";
import { Header } from "../100-layout/Header";
import { Footer } from "../100-layout/Footer";
import { StatusList } from "../800-beta/StatusList";
import { useTranslation, usePageMeta } from "../000-core/i18n";
import { appDict } from "./App.i18n";

export function App(): JSX.Element {
  const { t } = useTranslation(appDict);
  usePageMeta({ title: t.metaTitle, description: t.metaDescription });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[720px] space-y-10 px-5 pt-12 pb-20">
        <section>
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <div className="rounded-[10px] border border-border bg-surface px-5 py-4">
              <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">
                {t.today}
              </p>
              <p className="text-3xl">📄</p>
              <p className="mt-2 text-sm text-text-muted">{t.todayFormat}</p>
            </div>
            <span aria-hidden="true" className="text-xl text-text-muted">
              →
            </span>
            <div className="rounded-[10px] border border-border bg-surface px-5 py-4">
              <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">
                {t.future}
              </p>
              <p className="text-3xl">📄 + XML</p>
              <p className="mt-2 text-sm text-text-muted">{t.futureFormat}</p>
            </div>
          </div>
        </section>

        <section className="text-center">
          {/* <h1 className="mb-4 text-[2.1rem] leading-[1.3] text-text">{t.heading}</h1> */}
          <ul className="mb-6 list-none space-y-1 p-0 text-[1.05rem] text-text">
            <p className="mb-6 text-[1.05rem] text-text">{t.intro}</p>
            <li>{t.fundedByGovernment}</li>
            <li>{t.freeOpenSource}</li>
            {/* <li>{t.privacyFirst}</li> */}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
            {/* <a
              className="text-text-muted no-underline hover:underline"
              href="https://www.prototypefund.de/projects/openinvoicexml"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.fundedByLink}
            </a>
            <a
              className="text-text-muted no-underline hover:underline"
              href="https://github.com/HongbaeKim/openinvoicexml"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.github}
            </a>
            <a className="text-text-muted no-underline hover:underline" href="privacy.html">
              {t.privacyFirstLink}
            </a> */}
          </div>
        </section>

        <section>
          {/* <h2 className="mb-4 text-xl text-text">{t.lookingForHeading}</h2> */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch">
            <div className="flex flex-col rounded-[10px] border border-border bg-surface p-5">
              <h3 className="mb-1 text-lg text-text">{t.createInvoicesTitle}</h3>
              <p className="mb-3 text-sm text-text-muted">{t.createInvoicesDescription}</p>
              <a
                className="mt-auto inline-block self-start rounded-md bg-accent px-[1.1rem] py-[0.55rem] text-sm font-semibold text-accent-text no-underline hover:opacity-90"
                href="beta.html"
              >
                {t.joinBeta}
              </a>
            </div>
            <div className="flex flex-col rounded-[10px] border border-border bg-surface p-5">
              <h3 className="mb-1 text-lg text-text">{t.buildTitle}</h3>
              <p className="mb-3 text-sm text-text-muted">{t.buildDescription}</p>
              <a
                className="mt-auto inline-block self-start rounded-md bg-accent px-[1.1rem] py-[0.55rem] text-sm font-semibold text-accent-text no-underline hover:opacity-90"
                href="developer.html"
              >
                {t.shareNeeds}
              </a>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.statusHeading}</h2>
          <StatusList />
          <p className="mt-3 text-[0.85rem]">{t.statusNote}</p>
        </section>
      </main>

      <Footer />
    </>
  );
}
