import { Brain, Target, Search, BookOpen, Trophy, Zap, Compass, BarChart3 } from 'lucide-react';
import { useScrollAnimation } from './useScrollAnimation';
import { useCardScrollAnimation } from './useCardScrollAnimation';

function FeatureCard({ badge, index }: { badge: any; index: number }) {
  const { ref, isVisible } = useCardScrollAnimation(index, 8);

  return (
    <div
      ref={ref}
      className={`glass-card rounded-2xl p-6 group cursor-pointer hover:scale-105 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
      }`}
      style={{ 
        willChange: isVisible ? 'auto' : 'transform, opacity'
      }}
    >
      <div className="relative mb-4 flex justify-center">
        <div className={`absolute inset-0 bg-gradient-to-br ${badge.gradient} dark:${badge.darkGradient} rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity`} />
        <div className={`relative w-12 h-12 bg-gradient-to-br ${badge.gradient} dark:${badge.darkGradient} rounded-xl flex items-center justify-center`}>
          <badge.icon className="w-6 h-6 text-white dark:text-white/90" />
        </div>
      </div>
      <h3 className="text-foreground mb-2">{badge.title}</h3>
      <p className="text-muted-foreground">{badge.description}</p>
    </div>
  );
}

export default function TrustBadges() {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation(0.1);
  const badges = [
    {
      icon: Brain,
      title: 'AI Skill Extraction',
      description: 'NLP extracts skills from resumes and job descriptions',
      gradient: 'from-emerald-500 to-teal-500',
      darkGradient: 'from-emerald-700 to-teal-700',
    },
    {
      icon: Target,
      title: 'Personalized Gap Analysis',
      description: 'See exactly what separates you from your target role',
      gradient: 'from-blue-500 to-cyan-500',
      darkGradient: 'from-blue-700 to-cyan-700',
    },
    {
      icon: Search,
      title: 'Role Intelligence',
      description: 'Interprets changing market expectations in context',
      gradient: 'from-teal-500 to-cyan-500',
      darkGradient: 'from-teal-700 to-cyan-700',
    },
    {
      icon: BarChart3,
      title: 'Progress Analytics',
      description: 'Track growth across prioritized skill clusters',
      gradient: 'from-orange-500 to-red-500',
      darkGradient: 'from-orange-700 to-red-700',
    },
    {
      icon: BookOpen,
      title: 'Curated Learning Paths',
      description: 'Resource recommendations from Udemy, YouTube, and more',
      gradient: 'from-emerald-500 to-teal-500',
      darkGradient: 'from-emerald-700 to-teal-700',
    },
    {
      icon: Zap,
      title: 'Actionable Weekly Plans',
      description: 'Move from analysis to execution with clear next steps',
      gradient: 'from-yellow-500 to-orange-500',
      darkGradient: 'from-yellow-700 to-orange-700',
    },
    {
      icon: Trophy,
      title: 'Gamified Motivation',
      description: 'Levels, achievements, and streaks to stay consistent',
      gradient: 'from-cyan-500 to-blue-500',
      darkGradient: 'from-cyan-700 to-blue-700',
    },
    {
      icon: Compass,
      title: 'Career Clarity',
      description: 'A focused roadmap from current state to desired role',
      gradient: 'from-pink-500 to-rose-500',
      darkGradient: 'from-pink-700 to-rose-700',
    },
  ];

  return (
    <section id="features" ref={sectionRef} className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl mb-4">
            <span className={`inline-block text-gradient ${sectionVisible ? 'animate-word-reveal' : 'opacity-0'}`} style={{ animationDelay: '0s' }}>
              Features
            </span>
          </h2>
          <p className={`text-xl text-muted-foreground max-w-2xl mx-auto transition-all duration-700 ${sectionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.4s' }}>
            Everything you need to identify skill gaps and elevate your career with confidence
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((badge, index) => {
            return <FeatureCard key={index} badge={badge} index={index} />;
          })}
        </div>


      </div>
    </section>
  );
}
