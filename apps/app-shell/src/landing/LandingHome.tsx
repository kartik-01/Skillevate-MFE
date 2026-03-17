import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import TrustBadges from "./components/TrustBadges";
import PrivacySection from "./components/PrivacySection";
import Footer from "./components/Footer";

type LandingHomeProps = {
  onLogin: () => void;
};

export default function LandingHome({ onLogin }: LandingHomeProps) {
  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLearnMore = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Header onTryDemo={onLogin} onLogoClick={handleLogoClick} />
      <HeroSection onTryNow={onLogin} onLearnMore={handleLearnMore} />
      <TrustBadges />
      <PrivacySection />
      <Footer />
    </div>
  );
}