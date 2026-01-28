import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
import { FeaturesExpanded } from "@/components/landing/features-expanded";
import { Integrations } from "@/components/landing/integrations";
import { ComparisonBento } from "@/components/landing/comparison-bento";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";
import { ParallaxSection } from "@/components/landing/parallax-section";

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
