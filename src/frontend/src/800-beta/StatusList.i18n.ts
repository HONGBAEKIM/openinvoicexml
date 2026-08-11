import type { Lang } from "../000-core/i18n";

export type PhaseStatus = "done" | "progress" | "upcoming";

export interface Phase {
  title: string;
  shortLabel: string;
  period: string;
  description: string;
  subItems: string[];
  status: PhaseStatus;
}

export const phasesDict: Record<Lang, Phase[]> = {
  de: [
    {
      title: "Phase 1 — Architektur & internes Schema",
      shortLabel: "Jun",
      period: "Jun 2026",
      description:
        "Öffentliches Repo, dokumentiertes internes Rechnungsschema, modulare Architektur.",
      subItems: [
        "Repo & Grundgerüst",
        "Rechnungsschema v0.1",
        "USt-Block & Normalisierung",
        "Architekturdokumentation",
      ],
      status: "done",
    },
    {
      title: "Phase 2 — XML-Engine & Validierung",
      shortLabel: "Jul",
      period: "Jul 2026",
      description: "XRechnung-XML-Erstellung, validiert mit dem offiziellen KoSIT-Validator.",
      subItems: ["XML-Generator", "KoSIT-Validierung", "USt-Regeldurchsetzung", "Tests"],
      status: "done",
    },
    {
      title: "Phase 3 — Deutsche Rechtskonformität & Testfälle",
      shortLabel: "Aug",
      period: "Aug 2026",
      description: "Erweiterte USt-/Rechtslogik, 30+ KoSIT-validierte Testfälle.",
      subItems: [
        "§19-/§13b-USt-Logik",
        "Gutschriften & Korrekturen",
        "Anzahlungsrechnungen",
        "30+ Testfälle",
      ],
      status: "progress",
    },
    {
      title: "Phase 4 — Hybrider PDF/A-3-Export",
      shortLabel: "Sep",
      period: "Sep 2026",
      description:
        "Stabiler hybrider PDF/A-3-Export mit Unterstützung für Factur-X/ZUGFeRD-Profile.",
      subItems: [
        "PDF/A-3-Erstellung",
        "veraPDF-Konformität",
        "Factur-X/ZUGFeRD-Profile",
        "40+ Testfälle",
      ],
      status: "upcoming",
    },
    {
      title: "Phase 5.1 — Tests, Sicherheit & Dokumentation",
      shortLabel: "Okt",
      period: "Okt 2026",
      description: "Vollständige automatisierte Testsuite, Sicherheitsprüfung und Dokumentation.",
      subItems: [
        "Vollständige Testsuite",
        "Sicherheitsprüfung",
        "Performance-Tests",
        "Dokumentation",
      ],
      status: "upcoming",
    },
    {
      title: "Phase 5.2 — Refactoring & Release",
      shortLabel: "Nov",
      period: "Nov 2026",
      description: "Abschließende Konformitätsprüfung und das v1.0.0-Prototype-Release.",
      subItems: [
        "Refactoring & Aufräumen",
        "Abschließende Konformitätsprüfung",
        "Entwicklerdokumentation & Mitwirken",
        "v1.0.0-Release",
      ],
      status: "upcoming",
    },
  ],
  en: [
    {
      title: "Phase 1 — Architecture & Internal Schema",
      shortLabel: "Jun",
      period: "Jun 2026",
      description: "Public repo, documented internal invoice schema, modular architecture.",
      subItems: [
        "Repo & skeleton",
        "Invoice schema v0.1",
        "VAT block & normalization",
        "Architecture docs",
      ],
      status: "done",
    },
    {
      title: "Phase 2 — XML Engine & Validation",
      shortLabel: "Jul",
      period: "Jul 2026",
      description: "XRechnung XML generation, validated against the official KoSIT validator.",
      subItems: ["XML Generator", "KoSIT Validation", "VAT Rule Enforcement", "Tests"],
      status: "done",
    },
    {
      title: "Phase 3 — German Law Compliance & Test Fixtures",
      shortLabel: "Aug",
      period: "Aug 2026",
      description: "Expanded VAT/legal scenario logic, 30+ KoSIT-validated fixtures.",
      subItems: [
        "§19 / §13b VAT logic",
        "Credit notes & corrections",
        "Down payment invoices",
        "30+ fixtures",
      ],
      status: "progress",
    },
    {
      title: "Phase 4 — Hybrid PDF/A-3 Export",
      shortLabel: "Sep",
      period: "Sep 2026",
      description: "Stable hybrid PDF/A-3 export with Factur-X/ZUGFeRD profile support.",
      subItems: [
        "PDF/A-3 generation",
        "veraPDF compliance",
        "Factur-X/ZUGFeRD profiles",
        "40+ fixtures",
      ],
      status: "upcoming",
    },
    {
      title: "Phase 5.1 — Testing, Security & Documentation",
      shortLabel: "Oct",
      period: "Oct 2026",
      description: "Full automated test suite, security review, and documentation.",
      subItems: ["Full test suite", "Security review", "Performance testing", "Documentation"],
      status: "upcoming",
    },
    {
      title: "Phase 5.2 — Refactoring & Release",
      shortLabel: "Nov",
      period: "Nov 2026",
      description: "Final compliance verification and the v1.0.0-prototype release.",
      subItems: [
        "Refactoring & cleanup",
        "Final compliance check",
        "Dev docs & contributing",
        "v1.0.0 release",
      ],
      status: "upcoming",
    },
  ],
};

export const statusLabelDict: Record<Lang, Record<PhaseStatus, string>> = {
  de: {
    done: "Fertig",
    progress: "In Arbeit",
    upcoming: "Geplant",
  },
  en: {
    done: "Done",
    progress: "Building",
    upcoming: "Upcoming",
  },
};
