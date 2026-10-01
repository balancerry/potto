import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Link-preview banner for Slack, WhatsApp, X, iMessage, etc. Rendered once at build time.

export const alt = 'Potto: one shared pot for trips, events, and group funds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Mirrors the tokens in globals.css (ImageResponse can't read CSS variables).
const c = {
  ink: '#23211d',
  inkSoft: '#655f52',
  paper: '#f5f0e4',
  surface: '#fffdf7',
  sunk: '#efe9d9',
  line: '#e2d8be',
  accent: '#1e3a2b',
  pos: '#2e7d5b',
  posSoft: '#e2f1e8',
  neg: '#b3462f',
  negSoft: '#fbeae1',
  gold: '#c08a2e',
  goldSoft: '#f1e1bc',
};

// Literal paths keep Turbopack's file tracing scoped to these files.
const [displayFont, bodyMedium, bodyBold, logo] = await Promise.all([
  readFile(join(process.cwd(), 'assets', 'fonts', 'Fraunces-SemiBold.ttf')),
  readFile(join(process.cwd(), 'assets', 'fonts', 'PlusJakartaSans-Medium.ttf')),
  readFile(join(process.cwd(), 'assets', 'fonts', 'PlusJakartaSans-Bold.ttf')),
  readFile(join(process.cwd(), 'public', 'icon-512.png')),
]);
const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

const MEMBERS = [
  { initial: 'A', bg: '#f1e1bc', fg: '#8a5f17' },
  { initial: 'M', bg: '#e2f1e8', fg: '#2e7d5b' },
  { initial: 'R', bg: '#fbeae1', fg: '#b3462f' },
  { initial: 'S', bg: '#e1e8dd', fg: '#1e3a2b' },
];

const ACTIVITY = [
  { title: 'Aarav added money', meta: 'Contribution', amount: '+₹6,000', fg: c.pos, bg: c.posSoft, mark: '+' },
  { title: 'Beach shack dinner', meta: 'Food · split 6 ways', amount: '−₹4,200', fg: c.neg, bg: c.negSoft, mark: '−' },
];

const TAGS = ['Trips', 'Events', 'Flatmates', 'Group funds'];

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: c.accent,
          backgroundImage:
            'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.10), rgba(255,255,255,0) 45%), radial-gradient(circle at 85% 90%, rgba(192,138,46,0.28), rgba(192,138,46,0) 50%)',
          fontFamily: 'Jakarta',
          color: c.paper,
        }}
      >
        {/* The gold "coin" from the logo, oversized behind the card. */}
        <div
          style={{
            position: 'absolute',
            right: -120,
            top: -150,
            width: 520,
            height: 520,
            borderRadius: 9999,
            backgroundImage: 'radial-gradient(circle at 35% 35%, #f3c75a, #c08a2e 70%)',
            opacity: 0.9,
          }}
        />

        {/* Left: pitch */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 660, padding: '56px 0 56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={logoSrc} alt="" width={60} height={60} style={{ borderRadius: 16 }} />
            <div style={{ fontFamily: 'Fraunces', fontSize: 40, letterSpacing: -0.5 }}>Potto</div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 44,
              fontFamily: 'Fraunces',
              fontSize: 60,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            <div>One shared pot.</div>
            <div style={{ color: c.goldSoft }}>Zero awkward math.</div>
          </div>

          <div style={{ marginTop: 24, fontSize: 24, lineHeight: 1.45, color: 'rgba(245,240,228,0.78)', maxWidth: 560 }}>
            Collect money, log every expense, and settle up fairly. No chasing friends.
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
            {TAGS.map((tag) => (
              <div
                key={tag}
                style={{
                  display: 'flex',
                  padding: '8px 16px',
                  borderRadius: 9999,
                  border: '1.5px solid rgba(245,240,228,0.28)',
                  fontSize: 19,
                  color: 'rgba(245,240,228,0.92)',
                }}
              >
                {tag}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '16px 28px',
                borderRadius: 16,
                backgroundColor: c.gold,
                color: '#1b140a',
                fontWeight: 700,
                fontSize: 24,
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              }}
            >
              Start a pot
              <div style={{ display: 'flex', fontSize: 26 }}>→</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.paper }}>trypotto.in</div>
          </div>
        </div>

        {/* Right: product peek */}
        <div style={{ display: 'flex', position: 'relative', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* Back card for depth */}
          <div
            style={{
              position: 'absolute',
              width: 420,
              height: 470,
              borderRadius: 28,
              backgroundColor: c.goldSoft,
              transform: 'rotate(7deg) translate(28px, 6px)',
              opacity: 0.55,
            }}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 430,
              padding: 30,
              borderRadius: 28,
              backgroundColor: c.surface,
              color: c.ink,
              transform: 'rotate(-3deg)',
              boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontFamily: 'Fraunces', fontSize: 32, letterSpacing: -0.5 }}>Goa Trip</div>
                <div style={{ fontSize: 16, color: c.inkSoft, marginTop: 2 }}>6 members · Dec 12–16</div>
              </div>
              <div style={{ display: 'flex' }}>
                {MEMBERS.map((m, i) => (
                  <div
                    key={m.initial}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 38,
                      height: 38,
                      marginLeft: i === 0 ? 0 : -10,
                      borderRadius: 9999,
                      border: `3px solid ${c.surface}`,
                      backgroundColor: m.bg,
                      color: m.fg,
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {m.initial}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22, padding: 20, borderRadius: 18, backgroundColor: c.paper }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.inkSoft, letterSpacing: 1 }}>POOL BALANCE</div>
              <div style={{ fontFamily: 'Fraunces', fontSize: 46, letterSpacing: -1, marginTop: 2 }}>₹29,400</div>
              <div style={{ display: 'flex', height: 10, marginTop: 12, borderRadius: 9999, backgroundColor: c.sunk }}>
                <div style={{ width: '76%', borderRadius: 9999, backgroundColor: c.gold }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 15, color: c.inkSoft }}>
                <div>₹36,400 of ₹48,000 collected</div>
                <div style={{ fontWeight: 700, color: c.ink }}>76%</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
              {ACTIVITY.map((a, i) => (
                <div
                  key={a.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '11px 2px',
                    borderTop: i === 0 ? 'none' : `1px solid ${c.line}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: a.bg,
                      color: a.fg,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {a.mark}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 12, flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{a.title}</div>
                    <div style={{ fontSize: 14, color: c.inkSoft }}>{a.meta}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: a.fg }}>{a.amount}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating "settled" badge */}
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 42,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 16,
              backgroundColor: c.surface,
              color: c.ink,
              fontSize: 18,
              fontWeight: 700,
              transform: 'rotate(-6deg)',
              boxShadow: '0 16px 36px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 9999,
                backgroundColor: c.pos,
              }}
            >
              {/* CSS checkmark: two borders of a rotated box. */}
              <div
                style={{
                  width: 8,
                  height: 14,
                  marginTop: -3,
                  borderRight: '3px solid #ffffff',
                  borderBottom: '3px solid #ffffff',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            Every rupee accounted for
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: displayFont, style: 'normal', weight: 600 },
        { name: 'Jakarta', data: bodyMedium, style: 'normal', weight: 500 },
        { name: 'Jakarta', data: bodyBold, style: 'normal', weight: 700 },
      ],
    },
  );
}
