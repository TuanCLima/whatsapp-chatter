import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Code2,
  Github,
  MessageCircle,
  MoreHorizontal,
  PlugZap,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import './landing.css'

const repositoryUrl = 'https://github.com/TuanCLima/whatsapp-chatter'

export default function LandingPage() {
  return (
    <div className="landing">
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav landing-shell">
        <Link className="landing-brand" to="/" aria-label="Atomation home">
          <span className="landing-brand-mark">
            <MessageCircle size={20} />
          </span>
          atomation<span className="landing-brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#features">Capabilities</a>
          <a href="#how">How it works</a>
          <a href={repositoryUrl}>
            Source code <ArrowRight size={14} />
          </a>
        </nav>
        <Link className="landing-button landing-button-small" to="/app">
          Open workspace <ArrowRight size={16} />
        </Link>
      </header>

      <main id="main-content">
        <section className="landing-hero landing-shell">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span /> WHATSAPP, WITH A LITTLE MORE POSSIBILITY
            </span>
            <h1>
              Good conversations.
              <br />
              <em>Less busywork.</em>
            </h1>
            <p className="landing-intro">
              An AI assistant for your WhatsApp conversations. Answer questions,
              coordinate appointments, and keep a human in the loop — from one
              workspace.
            </p>
            <div className="landing-actions">
              <Link className="landing-button" to="/app">
                Open workspace <ArrowRight size={18} />
              </Link>
              <a className="landing-text-link" href={repositoryUrl}>
                <Github size={18} /> Explore the project
              </a>
            </div>
            <p className="landing-project-note">
              A full-stack side project by Tuan Lima.
              <br />
              Built with React, TypeScript, Node.js, and PostgreSQL.
            </p>
          </div>
          <ConversationPreview />
        </section>

        <div
          className="landing-integrations landing-shell"
          aria-label="Project integrations"
        >
          <span>CONNECTING THE DOTS</span>
          <strong>
            WhatsApp <small>via Twilio</small>
          </strong>
          <strong>Google Calendar</strong>
          <strong>LLM tools</strong>
          <a href="#features" aria-label="Explore capabilities">
            <ArrowDown size={19} />
          </a>
        </div>

        <section id="features" className="landing-section landing-shell">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">01 / CAPABILITIES</span>
            <h2>
              From a message
              <br />
              to a useful next step.
            </h2>
            <p>
              Give your assistant context and tools. Follow the conversation in
              a responsive inbox, and take over when it needs your attention.
            </p>
          </div>
          <div className="landing-feature-grid">
            <Feature
              icon={<MessageCircle />}
              number="01"
              title="One inbox, a clearer picture"
              description="Browse contacts, read conversations, track unread messages, and pause the assistant for a manual reply."
            />
            <Feature
              icon={<CalendarDays />}
              number="02"
              title="Scheduling that fits"
              description="Connect Google Calendar. Configure working hours and notice periods for appointment availability and booking tools."
            />
            <Feature
              icon={<PlugZap />}
              number="03"
              title="Your workflow, your tools"
              description="Configure the assistant's instructions and tools for contact sharing, images, information, and custom actions."
            />
          </div>
        </section>

        <section id="how" className="landing-how">
          <div className="landing-shell landing-how-grid">
            <div>
              <span className="landing-eyebrow">02 / THE WORKFLOW</span>
              <h2>
                Your number.
                <br />
                Your assistant.
                <br />
                <em>Your way.</em>
              </h2>
              <p>
                Each account has its own Twilio configuration, assistant
                instructions, and conversation workspace.
              </p>
              <Link className="landing-text-link" to="/app">
                Configure your workspace <ArrowRight size={18} />
              </Link>
            </div>
            <ol className="landing-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Connect your channel</h3>
                  <p>
                    Add your Twilio account and WhatsApp sender. Point incoming
                    messages to the app's webhook.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Give it context</h3>
                  <p>
                    Write your assistant's instructions, choose its tools, and
                    optionally connect your calendar.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Keep the conversation moving</h3>
                  <p>
                    Review messages in the inbox. Let the assistant respond, or
                    pause automation and reply yourself.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="landing-build landing-shell">
          <div className="landing-build-icon">
            <Code2 size={26} />
          </div>
          <div>
            <span className="landing-eyebrow">BUILT IN THE OPEN</span>
            <h2>Curious about the engineering?</h2>
            <p>
              Explore the React interface, messaging webhooks, LLM tool
              execution, and database design. The README covers architecture,
              local setup, and current limitations.
            </p>
          </div>
          <a className="landing-button" href={repositoryUrl}>
            <Github size={18} /> View on GitHub
          </a>
        </section>
      </main>

      <footer className="landing-footer landing-shell">
        <span className="landing-brand">
          atomation<span className="landing-brand-dot">.</span>
        </span>
        <p>WhatsApp Chatter · A project by Tuan Lima</p>
        <a href={repositoryUrl}>
          Code & documentation <ArrowRight size={15} />
        </a>
      </footer>
    </div>
  )
}

function Feature({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode
  number: string
  title: string
  description: string
}) {
  return (
    <article className="landing-feature">
      <div className="landing-feature-top">
        <span>{icon}</span>
        <small>{number}</small>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}

function ConversationPreview() {
  return (
    <figure className="landing-preview">
      <div className="landing-preview-label">
        <span>
          <Sparkles size={14} /> A CONVERSATION IN ACTION
        </span>
        <span>ILLUSTRATIVE PREVIEW</span>
      </div>
      <div className="landing-chat">
        <div className="landing-chat-header">
          <span className="landing-avatar">JL</span>
          <div>
            <strong>Jordan Lee</strong>
            <span>Appointment enquiry</span>
          </div>
          <MoreHorizontal size={20} aria-hidden="true" />
        </div>
        <div className="landing-chat-body">
          <div className="landing-chat-date">TODAY</div>
          <div className="landing-bubble">
            Hi! Do you have time for a consultation tomorrow?<span>10:24</span>
          </div>
          <div className="landing-tool-event">
            <CalendarDays size={13} /> Calendar availability checked
          </div>
          <div className="landing-bubble landing-bubble-assistant">
            Of course. There are openings at 10:00 and 14:30. Which works better
            for you?
            <span>
              10:24 <CheckCheck size={13} />
            </span>
          </div>
          <div className="landing-bubble">
            14:30 would be great, thanks!<span>10:25</span>
          </div>
          <div className="landing-appointment">
            <span className="landing-appointment-icon">
              <Check size={18} />
            </span>
            <div>
              <strong>Consultation confirmed</strong>
              <p>Tomorrow · 14:30–15:00</p>
              <small>Google Calendar</small>
            </div>
          </div>
          <div className="landing-bubble landing-bubble-assistant">
            You're all set. See you tomorrow!
            <span>
              10:25 <CheckCheck size={13} />
            </span>
          </div>
        </div>
        <div className="landing-chat-status">
          <span />
          <strong>Assistant enabled</strong>
          <span className="landing-status-note">You can take over anytime</span>
        </div>
      </div>
      <figcaption>
        Fictional messages illustrating the scheduling workflow.
      </figcaption>
    </figure>
  )
}
