import { Compass, Github, Mail, Heart } from 'lucide-react';
import { useScrollAnimation } from './useScrollAnimation';

export default function Footer() {
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <footer ref={ref} className="relative border-t border-border glass-card mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className={`md:col-span-2 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '0s' }}>
            <div className="flex items-center gap-3 mb-4 group">
              <div className="relative">
                <div className="absolute inset-0 gradient-primary rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                  <Compass className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-xl text-foreground tracking-tight">Skillevate</span>
            </div>
            <p className="text-muted-foreground max-w-md mb-6">
              Personalized skill intelligence and learning roadmaps for professionals.
              Turn career ambition into measurable progress.
            </p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-red-400 fill-red-400" />
              <span>for career growth</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-foreground mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Learning Roadmap
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Career FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-foreground mb-4">Connect</h4>
            <div className="space-y-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>GitHub</span>
              </a>
              <a
                href="mailto:hello@skillevate.app"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Contact</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-center sm:text-left">
            © 2026 Skillevate. Skills + Elevate.
          </p>
          <div className="flex items-center gap-6 text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Platform Policy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Trust
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
