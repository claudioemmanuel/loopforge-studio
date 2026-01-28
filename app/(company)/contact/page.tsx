import { Github, Twitter, Mail } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";
import { ContactForm } from "@/components/institutional/contact-form";

const contactMethods = [
  {
    icon: Github,
    title: "GitHub",
    description: "Open an issue or start a discussion",
    href: "https://github.com/claudioemmanuel/loopforge-studio",
    linkText: "Visit Repository",
  },
  {
    icon: Twitter,
    title: "Twitter",
    description: "Follow for updates and announcements",
    href: "https://twitter.com/loopforgestudio",
    linkText: "@loopforgestudio",
  },
  {
    icon: Mail,
    title: "Email",
    description: "For business inquiries",
    href: "mailto:hello@loopforge.dev",
    linkText: "hello@loopforge.dev",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Contact Us"
        subtitle="Have questions? We'd love to hear from you."
      />

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact form */}
          <div>
            <h2 className="text-xl font-semibold mb-6">Send us a message</h2>
            <ContactForm />
          </div>

          {/* Contact methods */}
          <div>
            <h2 className="text-xl font-semibold mb-6">
              Other ways to reach us
            </h2>
            <div className="space-y-4">
              {contactMethods.map((method) => (
                <Link
                  key={method.title}
                  href={method.href}
                  target={method.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    method.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <method.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{method.title}</h3>
                    <p className="text-sm text-muted-foreground mb-1">
                      {method.description}
                    </p>
                    <span className="text-sm text-primary">
                      {method.linkText}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Response time note */}
            <div className="mt-8 p-4 rounded-xl bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Response time:</strong> We
                typically respond within 24-48 hours. For urgent issues, please
                open a GitHub issue for faster visibility.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
