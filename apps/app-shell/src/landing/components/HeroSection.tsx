import { ArrowRight, Sparkles, Brain, Target } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface HeroSectionProps {
  onTryNow: () => void;
  onLearnMore: () => void;
}

export default function HeroSection({ onTryNow, onLearnMore }: HeroSectionProps) {
  return (
    <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 gradient-mesh opacity-40" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 dark:bg-emerald-500/15 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex animate-slide-in-up">
            <Badge className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-500/70 border-cyan-500/20 px-4 py-2 gap-2 hover:bg-cyan-500/20 transition-colors">
              <Sparkles className="w-4 h-4" />
              AI-Powered Career Skill Intelligence
            </Badge>
          </div>

          {/* Main Heading with Typing Animation */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight">
            <span className="inline-block animate-typing" style={{ animationDelay: '0.1s', animationDuration: '1.2s' }}>
              Build Skills,
            </span>
            <br />
            <span className="inline-block text-gradient animate-word-reveal" style={{ animationDelay: '1.6s' }}>
              Elevate
            </span>
            {' '}
            <span className="inline-block text-gradient animate-word-reveal" style={{ animationDelay: '2.2s' }}>
              Your Career
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-slide-in-up" style={{ animationDelay: '2.5s' }}>
            In a highly competitive job market, Skillevate helps professionals identify the right skills for evolving roles and follows a personalized, goal-driven roadmap toward their target jobs.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 justify-center animate-slide-in-up" style={{ animationDelay: '2.7s' }}>
            <Button
              onClick={onTryNow}
              size="lg"
              className="gradient-primary hover:opacity-90 transition-all hover:shadow-xl hover:shadow-cyan-500/50 gap-2 group"
            >
              Start My Skill Path
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={onLearnMore}
              size="lg"
              variant="outline"
              className="glass-card border-border hover:border-cyan-500/50 gap-2"
            >
              <Sparkles className="w-4 h-4" />
              See How It Works
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-3 gap-6 pt-12 animate-slide-in-up" style={{ animationDelay: '2.9s' }}>
            <div className="flex items-center gap-3 justify-center">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-emerald-600 dark:text-emerald-500/70" />
              </div>
              <div className="text-left">
                <p className="text-foreground">AI Skill Extraction</p>
                <p className="text-muted-foreground">Resume + JD intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-cyan-600 dark:text-cyan-500/70" />
              </div>
              <div className="text-left">
                <p className="text-foreground">Gap Analysis</p>
                <p className="text-muted-foreground">Current vs target role</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-500/70" />
              </div>
              <div className="text-left">
                <p className="text-foreground">Gamified Progress</p>
                <p className="text-muted-foreground">Levels and achievements</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
