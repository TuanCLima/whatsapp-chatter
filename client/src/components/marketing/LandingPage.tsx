import { CheckCircle2, Calendar, MessageCircle, Plug, Shield, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main>
        <HeroSection />
        <SocialProof />
        <FeaturesSection />
        <HowItWorksSection />
        <ToolsSection />
        <CTASection />
      </main>

      <SiteFooter />
    </div>
  )
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-tr from-blue-600 to-emerald-500" />
          <span className="text-lg font-semibold">Atomation</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a className="text-muted-foreground hover:text-foreground" href="#features">Features</a>
          <a className="text-muted-foreground hover:text-foreground" href="#how">How it works</a>
          <a className="text-muted-foreground hover:text-foreground" href="#tools">Tools</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link to="/app">Sign in</Link>
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/app">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-20 left-[-10%] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
        <Badge className="mb-4 bg-blue-600/15 text-blue-400 hover:bg-blue-600/20 border border-blue-700/30">
          New • Google Calendar integration
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Automate WhatsApp conversations with an AI assistant
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground mx-auto max-w-2xl">
          Atomation is a SaaS platform to configure an LLM assistant that serves your customers via WhatsApp. Seamlessly manage your schedule with our native Google Calendar integration.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            <Link to="/app">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
            <a href="mailto:sales@atomation.app?subject=Atomation Demo">Book a demo</a>
          </Button>
        </div>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ValuePill icon={<Zap className="h-4 w-4" />} title="Fast setup" subtitle="Go live in minutes" />
          <ValuePill icon={<Shield className="h-4 w-4" />} title="Secure" subtitle="Best practices by default" />
          <ValuePill icon={<Plug className="h-4 w-4" />} title="Extensible" subtitle="Bring your own tools" />
        </div>
      </div>
    </section>
  )
}

function ValuePill({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-left">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  )
}

function SocialProof() {
  return (
    <section className="py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center opacity-80">
          <Logo text="WhatsApp" />
          <Logo text="Google Calendar" />
          <Logo text="Twilio" />
          <Logo text="OpenAI" />
        </div>
      </div>
    </section>
  )
}

function Logo({ text }: { text: string }) {
  return (
    <div className="flex h-12 items-center justify-center rounded-md border bg-card px-3 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function FeaturesSection() {
  const features = [
    {
      icon: <MessageCircle className="h-5 w-5" />,
      title: 'WhatsApp assistant',
      desc: 'Delight customers with instant, 24/7, human-like responses.'
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      title: 'Google Calendar built-in',
      desc: 'Let your assistant schedule, reschedule, and manage events securely.'
    },
    {
      icon: <Plug className="h-5 w-5" />,
      title: 'Extend with tools',
      desc: 'Add contact sharing, information sharing, referee contacting, image sharing, and custom tools.'
    }
  ]

  return (
    <section id="features" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to automate</h2>
          <p className="mt-4 text-muted-foreground">
            Configure powerful workflows without engineering overhead. Ship value on day one.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="border-muted/40">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {f.icon}
                  </div>
                  <CardTitle className="text-xl">{f.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const steps = [
    { title: 'Connect WhatsApp & Twilio', desc: 'Plug your number and provider. Guided setup included.' },
    { title: 'Enable Google Calendar', desc: 'Secure OAuth connection to manage your events.' },
    { title: 'Add tools', desc: 'Pick from built-ins or define custom tools for your workflows.' },
    { title: 'Launch', desc: 'Share your WhatsApp number and start serving customers.' }
  ]

  return (
    <section id="how" className="py-16 md:py-24 border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
          <p className="mt-4 text-muted-foreground">Four simple steps to go from zero to automated.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <Card key={s.title}>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">Step {i + 1}</Badge>
                <CardTitle className="mt-2 text-xl">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function ToolsSection() {
  const tools = [
    'Contact sharing',
    'Information sharing',
    'Referee contacting',
    'Image sharing',
    'Custom tool definition'
  ]
  return (
    <section id="tools" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Built-in tools</h2>
          <p className="mt-4 text-muted-foreground">Mix and match tools to fit your business processes.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border bg-gradient-to-br from-blue-600/15 via-transparent to-emerald-500/15 p-8 md:p-12 text-center">
          <h3 className="text-2xl md:text-3xl font-semibold">Ready to automate with Atomation?</h3>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Configure your AI assistant once. Scale to every customer conversation across WhatsApp.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <Link to="/app">Create your assistant</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="mailto:sales@atomation.app?subject=Atomation Demo">Talk to sales</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-tr from-blue-600 to-emerald-500" />
          <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Atomation</span>
        </div>
        <div className="text-sm text-muted-foreground">
          <a className="hover:text-foreground" href="mailto:support@atomation.app">Support</a>
        </div>
      </div>
    </footer>
  )
}


