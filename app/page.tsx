import { GetSignal } from "@/components/landing/get-signal";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingHero } from "@/components/landing/hero";
import { ProductStory } from "@/components/landing/product-story";
import { SignalMarquee } from "@/components/landing/signal-marquee";
import { SourceGrid } from "@/components/landing/sources";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1">
        <LandingHero />
        <SignalMarquee />
        <ProductStory />
        <HowItWorks />
        <SourceGrid />
        <GetSignal />
      </main>
      <SiteFooter />
    </div>
  );
}
