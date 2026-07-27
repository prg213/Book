import { Link } from 'wouter';

const BASE = import.meta.env.BASE_URL;

export default function Terms() {
  const s = {
    h2: { fontFamily: 'Fredoka, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#1a0e08', margin: '2rem 0 0.5rem' } as React.CSSProperties,
    p: { color: '#5a3820', lineHeight: 1.75, margin: '0 0 0.75rem', fontSize: '0.95rem' } as React.CSSProperties,
    li: { color: '#5a3820', lineHeight: 1.75, fontSize: '0.95rem', marginBottom: '0.35rem' } as React.CSSProperties,
    a: { color: '#e8855a', textDecoration: 'none', fontWeight: 600 } as React.CSSProperties,
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#fdf8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(253,248,240,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(232,133,90,0.14)',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/">
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b4a30', fontSize: '0.88rem', fontWeight: 600, padding: '6px 2px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <img src={`${BASE}app-icon.png`} alt="" style={{ width: 26, height: 26, borderRadius: 6 }} />
            <span style={{ fontFamily: 'Fredoka, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#1a0e08' }}>MyStoryBook</span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px' }}>

        <h1 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 700, color: '#1a0e08', margin: '0 0 6px' }}>
          Terms &amp; Conditions
        </h1>
        <p style={{ color: '#a07055', fontSize: '0.85rem', margin: '0 0 32px' }}>
          Last updated: 27 July 2026
        </p>

        <p style={s.p}>
          Welcome to <strong>MyStoryBook</strong> ("we", "us", "our"). By accessing or using our website at{' '}
          <a href="https://mystorybook.world" style={s.a}>mystorybook.world</a> or our Android application, you agree to
          be bound by these Terms &amp; Conditions. Please read them carefully before using the service.
        </p>

        {/* 1 */}
        <h2 style={s.h2}>1. About the Service</h2>
        <p style={s.p}>
          MyStoryBook is an AI-powered personalised children's storybook generator. Users upload a photo, choose a
          story theme, and our service produces an illustrated children's book featuring the uploaded subject as the
          main character. Stories are generated using third-party AI models and are delivered digitally within the app.
        </p>

        {/* 2 */}
        <h2 style={s.h2}>2. Eligibility</h2>
        <p style={s.p}>
          You must be at least 18 years old to create an account and purchase credits. Children may use the app under
          the supervision and responsibility of a parent or legal guardian who holds the account.
        </p>

        {/* 3 */}
        <h2 style={s.h2}>3. User Accounts</h2>
        <p style={s.p}>
          You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us
          immediately of any unauthorised use of your account. We reserve the right to suspend or terminate accounts
          that violate these terms.
        </p>

        {/* 4 */}
        <h2 style={s.h2}>4. Uploaded Content &amp; Photos</h2>
        <p style={s.p}>
          When you upload a photo, you confirm that:
        </p>
        <ul style={{ paddingLeft: '1.4rem', margin: '0 0 0.75rem' }}>
          <li style={s.li}>You own the photo or have the explicit permission of the person depicted to use their likeness.</li>
          <li style={s.li}>The photo does not contain offensive, illegal, or adult content.</li>
          <li style={s.li}>You are not uploading images of minors without the consent of their parent or guardian.</li>
          <li style={s.li}>You grant MyStoryBook a limited licence to process the image solely for the purpose of generating your story.</li>
        </ul>
        <p style={s.p}>
          We do not sell, share, or use your uploaded photos for any purpose other than generating your requested storybook.
          Photos are stored securely and may be deleted upon request.
        </p>

        {/* 5 */}
        <h2 style={s.h2}>5. AI-Generated Content</h2>
        <p style={s.p}>
          Stories and illustrations are generated by artificial intelligence and may occasionally contain inaccuracies,
          stylistic inconsistencies, or unexpected results. We do not guarantee that all outputs will match your exact
          expectations. Generated content is provided for personal, non-commercial enjoyment only.
        </p>
        <p style={s.p}>
          You own the generated storybook for personal use. You may not resell, redistribute, or claim copyright over
          AI-generated content as original artwork.
        </p>

        {/* 6 */}
        <h2 style={s.h2}>6. Payments &amp; Refunds</h2>
        <p style={s.p}>
          Certain features of MyStoryBook require a paid credit or subscription. All payments are processed securely
          via Stripe. Prices are displayed in GBP (£) and are inclusive of any applicable taxes.
        </p>
        <p style={s.p}>
          Due to the nature of AI generation (credits are consumed upon story creation), we generally do not offer
          refunds once a story has been successfully generated. If you experience a technical failure where a story
          fails to generate and credits were charged, please contact us and we will investigate and issue a refund or
          credit where appropriate.
        </p>

        {/* 7 */}
        <h2 style={s.h2}>7. Prohibited Use</h2>
        <p style={s.p}>You must not use MyStoryBook to:</p>
        <ul style={{ paddingLeft: '1.4rem', margin: '0 0 0.75rem' }}>
          <li style={s.li}>Upload or generate content that is illegal, obscene, or harmful to minors.</li>
          <li style={s.li}>Impersonate or use the likeness of a real person without their consent.</li>
          <li style={s.li}>Attempt to reverse-engineer, scrape, or abuse our AI systems.</li>
          <li style={s.li}>Use the service for commercial resale or to build a competing product.</li>
          <li style={s.li}>Circumvent any access controls, rate limits, or payment requirements.</li>
        </ul>

        {/* 8 */}
        <h2 style={s.h2}>8. Intellectual Property</h2>
        <p style={s.p}>
          The MyStoryBook name, logo, website design, and underlying software are the intellectual property of
          MyStoryBook and its developers. Nothing in these terms grants you any rights to use our branding or
          technology outside of normal use of the service.
        </p>

        {/* 9 */}
        <h2 style={s.h2}>9. Privacy &amp; Data</h2>
        <p style={s.p}>
          We collect only the data necessary to provide the service: your email address (via authentication), uploaded
          photos (processed and stored for story generation), and story content. We do not sell personal data to third
          parties. Data is stored on secure cloud infrastructure in the EU/UK.
        </p>
        <p style={s.p}>
          By using the service you consent to this data processing. You may request deletion of your data at any time
          by contacting us at the address below.
        </p>

        {/* 10 */}
        <h2 style={s.h2}>10. Disclaimer of Warranties</h2>
        <p style={s.p}>
          The service is provided "as is" without warranty of any kind. We do not guarantee uninterrupted availability,
          error-free operation, or that generated content will meet your specific requirements. To the maximum extent
          permitted by law, we exclude all implied warranties.
        </p>

        {/* 11 */}
        <h2 style={s.h2}>11. Limitation of Liability</h2>
        <p style={s.p}>
          To the fullest extent permitted by applicable law, MyStoryBook shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of the service. Our total liability
          shall not exceed the amount you paid us in the 30 days prior to the event giving rise to the claim.
        </p>

        {/* 12 */}
        <h2 style={s.h2}>12. Changes to These Terms</h2>
        <p style={s.p}>
          We may update these Terms &amp; Conditions from time to time. We will notify registered users of material
          changes via email or an in-app notice. Continued use of the service after changes take effect constitutes
          acceptance of the new terms.
        </p>

        {/* 13 */}
        <h2 style={s.h2}>13. Governing Law</h2>
        <p style={s.p}>
          These terms are governed by and construed in accordance with the laws of England and Wales. Any disputes
          shall be subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>

        {/* 14 */}
        <h2 style={s.h2}>14. Contact Us</h2>
        <p style={s.p}>
          If you have any questions about these terms, or wish to raise a complaint or request data deletion, please
          contact us:
        </p>
        <p style={{ ...s.p, fontWeight: 600 }}>
          Email:{' '}
          <a href="mailto:support@mystorybook.world" style={s.a}>support@mystorybook.world</a>
        </p>
        <p style={s.p}>
          Or use the <strong>Support</strong> button in the app to raise a ticket directly.
        </p>

        {/* Divider */}
        <div style={{ margin: '40px 0 0', paddingTop: 28, borderTop: '1px solid rgba(232,133,90,0.18)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/"><span style={{ ...s.a, fontSize: '0.88rem' }}>Home</span></Link>
          <Link href="/sign-in"><span style={{ ...s.a, fontSize: '0.88rem' }}>Sign in</span></Link>
          <Link href="/sign-up"><span style={{ ...s.a, fontSize: '0.88rem' }}>Sign up</span></Link>
        </div>
      </div>
    </div>
  );
}
