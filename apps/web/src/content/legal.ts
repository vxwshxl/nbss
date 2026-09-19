import { site } from "@/content/site";

/**
 * The two legal documents, as typed data like every other page's copy.
 *
 * Both are written against what this codebase actually does — the three forms
 * in `app/actions.ts`, the file store in `lib/store.ts`, the staff-only session
 * cookie in `lib/session.ts`, the self-hosted fonts in `fonts.css` — rather
 * than copied from a template that promises cookie banners the site does not
 * have and analytics it does not run. If the site's behaviour changes, these
 * documents must change with it: that is the point of keeping them here, one
 * import away from the code they describe.
 *
 * The same discipline as `site.ts` applies: no invented facts. There is no
 * registration number and no email address here because the client has
 * confirmed neither. Contact routes are the phone number and the registered
 * office, which are published everywhere else on the site.
 */

export type LegalSection = {
  /** Anchor id, stable once published — external links may point at it. */
  id: string;
  heading: string;
  /** Paragraphs before the list. */
  body: string[];
  list?: string[];
  /** Paragraphs after the list. */
  after?: string[];
};

export type LegalDoc = {
  href: string;
  /** Document title on the page masthead. */
  title: string;
  /** Name used in breadcrumbs, cross-links and the footer. */
  shortTitle: string;
  lede: string;
  /** Display date and its machine form, updated whenever the text changes. */
  updated: string;
  updatedISO: string;
  sections: LegalSection[];
};

export const privacyPolicy: LegalDoc = {
  href: "/privacy-policy",
  title: "Plain words about your information.",
  shortTitle: "Privacy Policy",
  lede: "What this website collects, why, where it goes and the rights you hold over it — written to match what the site actually does, not what a template promises.",
  updated: "19 August 2026",
  updatedISO: "2026-08-19",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are and how to reach us",
      body: [
        `National Bodo Security Service ("NBSS", "we") is a security service provider with its registered office in Kokrajhar, Bodoland Territorial Council (BTC), Assam, India. For the purposes of the Digital Personal Data Protection Act, 2023, NBSS is the data fiduciary for the personal information collected through this website.`,
        `Every question, correction or complaint under this policy goes to the office: call ${site.phone}, or write to the registered office at Kokrajhar, BTC, Assam. It is answered by the management directly, not a call centre.`,
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect, and only when you send it",
      body: [
        "This website collects personal information in exactly one way: you type it into one of its three forms and press submit. Nothing is gathered silently in the background while you read.",
      ],
      list: [
        "Enquiry form — your name, phone number, subject and message, plus an email address and organisation name if you choose to give them.",
        "Quotation form — your name, phone number, organisation, the service and district in question, the type of site, an approximate headcount and start timeframe, plus an email address and notes if you choose to give them.",
        "Job application form — your name, phone number, age, district, education and work experience, plus an email address if you choose to give one.",
      ],
      after: [
        "Alongside each submission the server records the time it arrived, the sending device's IP address and its browser identifier. These are kept solely to tell genuine submissions from automated spam.",
        "Identity and address documents are never collected through this website. Candidates who are shortlisted bring them in person to a verification interview at the Kokrajhar office.",
      ],
    },
    {
      id: "what-we-do-not-collect",
      heading: "What we do not collect",
      body: [
        "There is no analytics script, no advertising pixel and no social-media tracker on this site. Fonts and every other asset are served from our own address, so reading these pages sends your browser to no third-party server.",
        "Ordinary visitors are never given a cookie. The one cookie the site sets is the sign-in session for NBSS staff opening the operations area, and it exists only on their own browsers.",
        "The infrastructure the site runs on keeps standard technical server logs, as effectively all web hosting does.",
      ],
    },
    {
      id: "why-we-use-it",
      heading: "Why we use it",
      body: [
        "Each form asks for your consent before it will submit, and what you send is used for the purpose stated on that form and nothing else:",
      ],
      list: [
        "Enquiries — to call or write back with an answer.",
        "Quotation requests — to arrange a site visit and prepare a costed proposal.",
        "Job applications — to shortlist, verify and contact candidates about the role applied for.",
      ],
      after: [
        "We do not use any of it for marketing, we do not build profiles, and we do not add you to a mailing list — the site does not have one.",
      ],
    },
    {
      id: "storage-and-sharing",
      heading: "Where it is stored and who sees it",
      body: [
        "Submissions are stored on this website's own server and are readable only by authorised NBSS staff through a password-protected operations area.",
        "We do not sell personal information and we do not share it with anyone for their marketing. It leaves NBSS in only two situations: the infrastructure provider that hosts the site processes it in the ordinary course of running the server, and a court, the police or another authority may lawfully require it.",
      ],
    },
    {
      id: "retention",
      heading: "How long we keep it",
      body: [
        "Submissions are kept for as long as it takes to deal with them — answer the enquiry, close out the quotation, complete the recruitment round — and for any period the law requires records to be held after that. When a submission no longer serves the purpose it was given for, it is deleted.",
        `If you want yours removed sooner, ask. Call ${site.phone} and quote the reference number every submission is given (it looks like NBSS-00123), and it will be erased unless a legal obligation requires keeping it.`,
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      body: ["Under the Digital Personal Data Protection Act, 2023 you may:"],
      list: [
        "Ask what personal information of yours we hold and receive a summary of it.",
        "Have inaccurate or incomplete information corrected or updated.",
        "Have your information erased once it is no longer needed for the purpose you gave it for.",
        "Withdraw the consent you gave on a form, with effect going forward.",
        "Nominate another person to exercise these rights for you if you are unable to.",
        "Raise a grievance and receive an answer.",
      ],
      after: [
        `To exercise any of these, call ${site.phone} or write to the registered office, quoting your reference number if you have one. If you believe a grievance has not been resolved, you may complain to the Data Protection Board of India.`,
      ],
    },
    {
      id: "children",
      heading: "Children",
      body: [
        "This website offers services to organisations, and the careers form accepts applicants aged 18 to 60. The site is not directed at children and we do not knowingly collect personal information from anyone under 18. If you believe a child's information has reached us, call the office and it will be deleted.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      body: [
        "If what the site collects or does ever changes, this page changes with it and the date at the top moves. The version published here is always the one in force.",
      ],
    },
  ],
};

export const termsAndConditions: LegalDoc = {
  href: "/terms-and-conditions",
  title: "The terms this website is offered on.",
  shortTitle: "Terms & Conditions",
  lede: "What using this site means, what its pages do and do not promise, and how quotations and job applications actually work.",
  updated: "19 August 2026",
  updatedISO: "2026-08-19",
  sections: [
    {
      id: "who-they-bind",
      heading: "These terms, and who they are between",
      body: [
        `This website is published by National Bodo Security Service ("NBSS", "we"), a security service provider with its registered office in Kokrajhar, Bodoland Territorial Council (BTC), Assam, India. By using the site you accept these terms; if you do not accept them, do not use the site.`,
        "These terms govern the website only. Guarding, facility and manpower services are governed by the separate written agreement signed for each engagement, and if these terms and a signed agreement ever differ, the signed agreement prevails.",
      ],
    },
    {
      id: "using-the-site",
      heading: "Using the site",
      body: [
        "You may browse, search and submit the forms for their intended purposes. In return we ask what any operator would:",
      ],
      list: [
        "Give accurate information in the forms — quotations, call-backs and interviews are arranged on the strength of what you type.",
        "Do not submit automated, bulk or deliberately false entries, and do not probe, overload or interfere with the site or its operations area.",
        "Do not use the site for anything unlawful.",
      ],
    },
    {
      id: "information-not-offer",
      heading: "Information, not an offer",
      body: [
        "The pages of this site describe who NBSS is and what it does. They are general information, not a contractual offer: no engagement, price or deployment exists until a written quotation or agreement is accepted by both sides.",
        "We keep the content accurate — the site states facts drawn from the company's own records, and where a fact is unconfirmed it is left out rather than guessed — but we do not warrant that the site is free of errors or interruptions.",
      ],
    },
    {
      id: "quotations",
      heading: "Quotations",
      body: [
        "Submitting the quotation form starts a conversation; it does not create a contract or reserve personnel. A field officer visits the site, and the written quotation that follows sets out the wage, the applicable statutory heads and the agency service charge separately. A quotation is an invitation to conclude an agreement and stays open for the period stated on it.",
      ],
    },
    {
      id: "job-applications",
      heading: "Job applications",
      body: [
        "Submitting an application does not guarantee an interview or employment. Shortlisting is at NBSS's discretion, and every appointment is conditional on the police verification and document checks completed before deployment.",
        `NBSS never asks for money through this website — no application fee, no processing fee, no deposit for a uniform or a posting. If anyone demands payment in NBSS's name for a job, do not pay: report it to the office on ${site.phone}.`,
      ],
    },
    {
      id: "names-marks-content",
      heading: "Names, marks and content",
      body: [
        "The NBSS name, the shield-and-Aronai mark and the text of this site belong to NBSS and may not be reproduced in a way that suggests an endorsement or affiliation that does not exist.",
        "Some photographs in the gallery are the work of third parties, used under the Creative Commons licences credited beside them. Those images remain under their own licences, and their credits must travel with them.",
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      body: [
        "The site is provided as-is, for information. To the extent Indian law allows, NBSS is not liable for loss arising from reliance on the website's content, from interruption or unavailability of the site, or from third-party services reached through links published here, such as the map service. Nothing in these terms limits any liability that cannot lawfully be limited.",
      ],
    },
    {
      id: "personal-information",
      heading: "Personal information",
      body: [
        "What the site collects through its forms, and the rights you hold over it, are set out in the Privacy Policy, which forms part of these terms.",
      ],
    },
    {
      id: "governing-law",
      heading: "Governing law and jurisdiction",
      body: [
        "These terms are governed by the laws of India. Subject to any law that confers jurisdiction elsewhere, disputes arising from this website are subject to the courts at Kokrajhar, Assam.",
      ],
    },
    {
      id: "changes-and-contact",
      heading: "Changes and contact",
      body: [
        `These terms may be revised as the site changes; the date at the top identifies the version in force, and continued use after a revision is acceptance of it. Questions about these terms go to the office: ${site.phone}, or the registered office at Kokrajhar, BTC, Assam.`,
      ],
    },
  ],
};
