import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Workflow } from "@/components/landing/workflow";
import { Integrations } from "@/components/landing/integrations";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <>
      <header>
        <Navigation />
      </header>

      <main>
        <Hero />
        <Features />
        <Workflow />
        <Integrations />
        <CTASection />
      </main>

      <Footer />
    </>
  );
}
