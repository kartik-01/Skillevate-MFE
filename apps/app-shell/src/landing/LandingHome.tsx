import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import Footer from "./components/Footer";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Upload Your Resume",
    description: "Drop your resume and paste a job description. Our NLP engine extracts your current skills and the role's requirements in seconds.",
  },
  {
    step: "02",
    title: "See Your Skill Gap",
    description: "Get a clear, visual breakdown of exactly which skills you have, which you're missing, and how large each gap is for your target role.",
  },
  {
    step: "03",
    title: "Follow Your Roadmap",
    description: "Receive a prioritized learning path with curated resources from YouTube, Udemy, and more — tailored to close your specific gaps.",
  },
];

type LandingHomeProps = {
  onLogin: () => void;
};

export default function LandingHome({ onLogin }: LandingHomeProps) {
  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLearnMore = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Header onTryDemo={onLogin} onLogoClick={handleLogoClick} />
      <HeroSection onTryNow={onLogin} onLearnMore={handleLearnMore} />

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl tracking-tight mb-3">How it works</h2>
            <p className="text-muted-foreground">Three steps from resume to roadmap.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col gap-4">
                <span className="text-5xl font-bold text-gradient opacity-60">{step}</span>
                <h3 className="text-foreground text-lg">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}