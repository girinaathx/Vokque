import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Avenxa" },
      {
        name: "description",
        content:
          "How Avenxa collects, uses, stores, and protects your information.",
      },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "1. About Avenxa",
    body: [
      "Avenxa is an AI-powered educational assistant designed to help students and users learn, create, research, and solve problems safely and responsibly.",
      "Avenxa is intended for users aged 13 years and older.",
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      "We may collect:",
      "• Account information (such as email address and profile information)",
      "• Chat conversations and prompts submitted to the platform",
      "• Files, images, and documents voluntarily uploaded by users",
      "• Device and technical information necessary for security and service operation",
      "• Usage analytics to improve performance and reliability",
    ],
  },
  {
    title: "3. How We Use Information",
    body: [
      "We use information to:",
      "• Provide AI-powered responses and features",
      "• Improve platform quality and user experience",
      "• Detect abuse, fraud, or harmful activities",
      "• Maintain security and platform integrity",
      "• Comply with applicable laws and regulations",
    ],
  },
  {
    title: "4. Chat Privacy",
    body: [
      "Avenxa is designed with privacy in mind.",
      "• User chats are not publicly visible.",
      "• We do not sell chat data to advertisers.",
      "• Conversations are protected using industry-standard security measures.",
      "• Only authorized systems and services required to operate the platform may process conversations.",
    ],
  },
  {
    title: "5. Student Safety",
    body: [
      "Avenxa is committed to maintaining a safe environment for students. The platform does not promote, encourage, or exploit:",
      "• Violence",
      "• Self-harm",
      "• Illegal activities",
      "• Sexual exploitation",
      "• Child exploitation",
      "• Harassment or bullying",
      "• Hate speech or extremist content",
      "Content may be filtered, restricted, or removed to protect users and comply with safety standards.",
    ],
  },
  {
    title: "6. Age Requirement",
    body: [
      "Users must be at least 13 years old to use Avenxa.",
      "Users under the applicable minimum age in their region may not create an account without appropriate permissions where required by law.",
    ],
  },
  {
    title: "7. Data Security",
    body: [
      "We implement reasonable administrative, technical, and organizational safeguards to protect user information against unauthorized access, disclosure, alteration, or destruction.",
      "While no online service can guarantee absolute security, we continuously work to maintain a secure platform.",
    ],
  },
  {
    title: "8. Data Sharing",
    body: [
      "Avenxa does not sell personal information. Information may be shared only when:",
      "• Required by law or legal process",
      "• Necessary to protect users or platform security",
      "• Required to operate trusted service providers supporting the platform",
    ],
  },
  {
    title: "9. User Controls",
    body: [
      "Users may:",
      "• Access their account information",
      "• Edit saved memories",
      "• Export available data",
      "• Delete chats",
      "• Delete memories",
      "• Request account deletion",
    ],
  },
  {
    title: "10. Account Deletion",
    body: [
      "Users may permanently delete their account through Settings.",
      "Upon deletion, associated account data may be removed or anonymized in accordance with applicable laws and operational requirements.",
    ],
  },
  {
    title: "11. Compliance",
    body: [
      "Avenxa follows applicable laws, regulations, and government requirements in jurisdictions where the service is provided.",
      "We cooperate with lawful requests from authorized government authorities when legally required.",
    ],
  },
  {
    title: "12. Changes to This Policy",
    body: [
      "We may update this Privacy Policy periodically. Significant changes will be communicated through the platform or other appropriate methods.",
    ],
  },
  {
    title: "13. Contact",
    body: [
      "For privacy-related questions, concerns, or requests, please contact:",
      "Avenxa Support",
      "support: openiplatforms@gmail",
    ],
  },
];

function PrivacyPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-32 lg:pt-12">
        <div className="animate-fade-up mb-8 flex items-center gap-3">
          <div className="glass flex h-11 w-11 items-center justify-center rounded-2xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground text-sm">Last updated: June 2026</p>
          </div>
        </div>

        <div className="glass-strong animate-fade-up rounded-3xl p-6 sm:p-8 [animation-delay:80ms]">
          <p className="text-sm leading-relaxed">
            Welcome to Avenxa. Your privacy and trust are important to us.
            This Privacy Policy explains how Avenxa collects, uses, stores,
            and protects your information.
          </p>

          <div className="mt-6 space-y-7">
            {SECTIONS.map((s) => (
              <section key={s.title}>
                <h2 className="font-display mb-2 text-base font-semibold tracking-tight">
                  {s.title}
                </h2>
                <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                  {s.body.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="text-muted-foreground mt-8 border-t border-foreground/10 pt-6 text-xs">
            By using Avenxa, you acknowledge that you have read and
            understood this Privacy Policy.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
