import type { Metadata } from "next";
import React from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollProgress from "@/components/landing/ScrollProgress";
import HeroSection from "@/components/landing/sections/HeroSection";
import TrustBar from "@/components/landing/sections/TrustBar";
import FeaturesSection from "@/components/landing/sections/FeaturesSection";
import ShowcaseSection from "@/components/landing/sections/ShowcaseSection";
import HowItWorksSection from "@/components/landing/sections/HowItWorksSection";
import TestimonialsSection from "@/components/landing/sections/TestimonialsSection";
import FaqSection from "@/components/landing/sections/FaqSection";
import CTASection from "@/components/landing/sections/CTASection";

export const metadata: Metadata = {
  other: {
    "google-site-verification": "sj-BfOr8qZN6UnGoDjJE06TP124MSNYF91loN2vEYnk",
  },
};

export default function Home() {
  return (
    <div className="landing-page font-sans overflow-x-hidden bg-[var(--bg-deep)]">
      <ScrollProgress />
      <Navbar />
      <HeroSection />
      <TrustBar />
      <FeaturesSection />
      <ShowcaseSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FaqSection />
      <CTASection />
      <Footer />
    </div>
  );
}
