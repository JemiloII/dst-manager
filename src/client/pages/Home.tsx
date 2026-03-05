import { Link } from 'react-router-dom';

const features = [
  { icon: '/images/servericons/dedicated.png', title: 'Server Management', desc: 'Create, start, stop, and configure multiple DST servers from one dashboard.', lighten: false },
  { icon: '/images/button_icons/world.png', title: 'World Customization', desc: 'Fine-tune every world setting with an icon-based UI — seasons, mobs, resources, and more.', lighten: false },
  { icon: '/images/button_icons/mods.png', title: 'Steam Workshop Mods', desc: 'Search, install, and configure mods directly from the Steam Workshop.', lighten: false },
  { icon: '/images/button_icons/profile.png', title: 'Multi-User Roles', desc: 'Invite friends with share links. Admin, user, and guest roles with different permissions.', lighten: false },
  { icon: '/images/button_icons/more_info.png', title: 'Real-Time Logs', desc: 'Stream Master and Caves server logs live with SSE — no page refreshing needed.', lighten: true },
  { icon: '/images/button_icons/update.png', title: 'Export & Backup', desc: 'Download your entire server cluster as a .zip file for safekeeping or migration.', lighten: false },
];

const demos = [
  { src: '/images/demo/dashboard.png', caption: 'Server Dashboard' },
  { src: '/images/demo/config.png', caption: 'Server Configuration' },
  { src: '/images/demo/world.png', caption: 'World Settings' },
  { src: '/images/demo/mods.png', caption: 'Mod Management' },
  { src: '/images/demo/logs.png', caption: 'Real-Time Logs' },
  { src: '/images/demo/suggestions.png', caption: 'Mod Suggestions' },
];

export default function Home() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <h1 className="landing-hero-title">Don't Starve Together<br />Server Manager</h1>
        <p className="landing-hero-subtitle">
          Create, configure, and manage your dedicated servers — all from your browser.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="btn btn-primary landing-hero-btn">Get Started</Link>
          <Link to="/login" className="btn btn-secondary landing-hero-btn">Login</Link>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">Features</h2>
        <div className="landing-features-grid">
          {features.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <img src={f.icon} alt={f.title} className={`landing-feature-icon${f.lighten ? ' landing-feature-icon-light' : ''}`} />
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-demos">
        <h2 className="landing-section-title">See It In Action</h2>
        <div className="landing-demos-grid">
          {demos.map((d) => (
            <figure key={d.caption} className="landing-demo-item">
              <figcaption className="landing-demo-caption">{d.caption}</figcaption>
              <img src={d.src} alt={d.caption} className="landing-demo-img" />
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2 className="landing-cta-title">Ready to survive together?</h2>
        <p className="landing-cta-subtitle">Set up your first server in under a minute.</p>
        <Link to="/register" className="btn btn-primary landing-hero-btn">Create Account</Link>
      </section>
    </div>
  );
}
