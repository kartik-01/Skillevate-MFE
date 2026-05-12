import { Compass, Github, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="text-foreground font-medium">Skillevate</span>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground order-last sm:order-none">
            © 2026 Skillevate. Skills + Elevate.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="mailto:hello@skillevate.app"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
