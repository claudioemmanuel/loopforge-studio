import dynamic from "next/dynamic";
import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
import { ParallaxSection } from "@/components/landing/parallax-section";
import { Footer } from "@/components/landing/footer";

const FeaturesExpanded = dynamic(() =>
  import("@/components/landing/features-expanded").then(
    (mod) => mod.FeaturesExpanded,
  ),
);

const Integrations = dynamic(() =>
  import("@/components/landing/integrations").then((mod) => mod.Integrations),
);

const ComparisonBento = dynamic(() =>
  import("@/components/landing/comparison-bento").then(
    (mod) => mod.ComparisonBento,
  ),
);

const CTASection = dynamic(() =>
  import("@/components/landing/cta-section").then((mod) => mod.CTASection),
);

export default function Home() {
  return (
    <>
      <header>
        <Navigation />
      </header>

      <main>
        <ParallaxSection zIndex={60}>
          <Hero />
        </ParallaxSection>

        <ParallaxSection showShadow zIndex={50}>
          <FeaturesExpanded />
        </ParallaxSection>

        <ParallaxSection zIndex={40}>
          <Integrations />
        </ParallaxSection>

        <ParallaxSection showShadow zIndex={20}>
          <ComparisonBento />
        </ParallaxSection>

        <ParallaxSection zIndex={5}>
          <CTASection />
        </ParallaxSection>
      </main>

      <Footer />
    </>
  );
}
