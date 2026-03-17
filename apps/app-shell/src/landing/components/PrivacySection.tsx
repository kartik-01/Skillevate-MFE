import { Shield, Briefcase, AlertTriangle, Rocket, Code, Target } from 'lucide-react';
import { useScrollAnimation } from './useScrollAnimation';
import { useCardScrollAnimation } from './useCardScrollAnimation';

function PrivacyCard({ feature, index }: { feature: any; index: number }) {
  const { ref, isVisible } = useCardScrollAnimation(index, 3);

  return (
    <div
      ref={ref}
      className={`glass-card rounded-3xl p-8 hover:scale-105 cursor-pointer transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
      }`}
      style={{ 
        willChange: isVisible ? 'auto' : 'transform, opacity'
      }}
    >
      {/* Icon & Stat */}
      <div className="relative mb-6 flex justify-center">
        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} dark:${feature.darkGradient} rounded-2xl blur-2xl opacity-50`} />
        <div className={`relative w-20 h-20 bg-gradient-to-br ${feature.gradient} dark:${feature.darkGradient} rounded-2xl flex items-center justify-center`}>
          <feature.icon className="w-10 h-10 text-white dark:text-white/90" />
        </div>
      </div>

      {/* Stat Number */}
      <div 
        className={`text-center mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} 
        style={{ transitionDelay: isVisible ? '0.3s' : '0s' }}
      >
        <div className="text-6xl sm:text-7xl text-gradient mb-2">{feature.stat}</div>
        <h3 className="text-2xl text-foreground">{feature.title}</h3>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-6 text-center">
        {feature.description}
      </p>

      {/* Details List */}
      <div className="space-y-3">
        {feature.details.map((detail: string, idx: number) => (
          <div key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${feature.gradient} dark:${feature.darkGradient}`} />
            <span>{detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdditionalPrivacyInfo() {
  const { ref, isVisible } = useCardScrollAnimation(3, 4);

  return (
    <div 
      ref={ref}
      className={`glass-card rounded-3xl p-8 sm:p-12 hover:scale-[1.02] cursor-pointer transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`} 
      style={{ 
        willChange: isVisible ? 'auto' : 'transform, opacity'
      }}
    >
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 gradient-primary rounded-2xl blur-xl opacity-50" />
          <div className="relative w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-2xl text-foreground mb-3">
            Skillevate = Skills + Elevate
          </h3>
          <p className="text-muted-foreground mb-4">
            Skillevate transforms scattered learning into a structured, motivating journey. Instead of generic catalogs, 
            learners get role-specific direction, measurable milestones, and curated resources that map directly to career outcomes.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Code className="w-4 h-4 text-cyan-400 dark:text-cyan-500/70" />
              <span className="text-cyan-400 dark:text-cyan-500/70">NLP Skill Extraction</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Target className="w-4 h-4 text-emerald-400 dark:text-emerald-500/70" />
              <span className="text-emerald-400 dark:text-emerald-500/70">Role-Aligned Roadmaps</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Rocket className="w-4 h-4 text-purple-400 dark:text-purple-500/70" />
              <span className="text-purple-400 dark:text-purple-500/70">Gamified Momentum</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrivacySection() {
  const { ref, isVisible } = useScrollAnimation(0.1);

  const privacyFeatures = [
    {
      icon: Briefcase,
      stat: '2026',
      title: 'The Setting',
      description: 'In today\'s highly competitive job market, professionals struggle to identify and acquire the right skills for evolving roles. Most learning platforms offer broad content, but not a personalized pathway aligned to specific career goals.',
      details: [
        'Evolving job expectations',
        'Too many disconnected resources',
        'Need for role-specific direction',
        'Demand for intelligent guidance'
      ],
      gradient: 'from-cyan-500 to-blue-500',
      darkGradient: 'from-cyan-700 to-blue-700',
    },
    {
      icon: AlertTriangle,
      stat: '3x',
      title: 'The Problem',
      description: 'Traditional skill platforms overwhelm learners with generic catalogs and no contextualized roadmap. Users often cannot see the gap between current skills and target job requirements, and motivation drops without clear milestones.',
      details: [
        'No personalized gap clarity',
        'Generic, non-goal-oriented plans',
        'Weak motivation loops',
        'Slower career progression'
      ],
      gradient: 'from-emerald-500 to-teal-500',
      darkGradient: 'from-emerald-700 to-teal-700',
    },
    {
      icon: Rocket,
      stat: 'AI',
      title: 'The Solution',
      description: 'Skillevate applies NLP to extract skills from resumes and job descriptions, performs personalized gap analysis, and recommends targeted resources from platforms like Udemy and YouTube. Gamification keeps the journey consistent and engaging.',
      details: [
        'Resume + JD skill extraction',
        'Personalized learning recommendations',
        'Progress levels and achievements',
        'Clear path to career advancement'
      ],
      gradient: 'from-purple-500 to-pink-500',
      darkGradient: 'from-purple-700 to-pink-700',
    },
  ];

  return (
    <section id="privacy" ref={ref} className="relative pt-24 pb-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-cyan-500/5 to-background">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl mb-4">
            <span className={`inline-block ${isVisible ? 'animate-word-reveal' : 'opacity-0'}`} style={{ animationDelay: '0s' }}>
              Problem to
            </span>
            {' '}
            <span className={`inline-block text-gradient ${isVisible ? 'animate-word-reveal' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
              Elevation
            </span>
          </h2>
          <p className={`text-xl text-muted-foreground max-w-2xl mx-auto transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.8s' }}>
            Skillevate bridges the gap between who you are now and the role you want next, with an intelligent and motivating roadmap.
          </p>
        </div>

        {/* Privacy Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {privacyFeatures.map((feature, index) => (
            <PrivacyCard key={index} feature={feature} index={index} />
          ))}
        </div>

        {/* Additional Privacy Info */}
        <AdditionalPrivacyInfo />
      </div>
    </section>
  );
}
