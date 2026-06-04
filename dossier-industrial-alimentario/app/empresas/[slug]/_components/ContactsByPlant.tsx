// app/empresas/[slug]/_components/ContactsByPlant.tsx — Tabs por planta + cards
'use client';

import { useState } from 'react';
import type { Plant, PlantContact } from '@prisma/client';
import { safeUrl } from '../_lib/types';

type Props = {
  plants: (Plant & { contacts: PlantContact[] })[];
};

export function ContactsByPlant({ plants }: Props) {
  const plantsWithContacts = plants.filter((p) => p.contacts.length > 0);
  if (plantsWithContacts.length === 0) return null;
  const [activeId, setActiveId] = useState<string>(plantsWithContacts[0].id);
  const active = plantsWithContacts.find((p) => p.id === activeId) ?? plantsWithContacts[0];

  return (
    <section className="empresa-section" aria-labelledby="contacts-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="contacts-heading">
            <span className="section-head-num">07</span>Contactos por planta
          </h2>
          <span className="section-head-count">
            {plants.reduce((a, p) => a + p.contacts.length, 0)} contactos · {plantsWithContacts.length} plantas
          </span>
        </div>
        <div className="contacts-shell">
          <div className="contacts-tabs" role="tablist" aria-label="Plantas con contactos">
            {plantsWithContacts.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === activeId}
                data-active={p.id === activeId}
                className="contacts-tab"
                onClick={() => setActiveId(p.id)}
              >
                {p.name} <span style={{ opacity: 0.6, marginLeft: 4 }}>({p.contacts.length})</span>
              </button>
            ))}
          </div>
          <div className="contacts-list" role="tabpanel" aria-label={`Contactos en ${active.name}`}>
            {active.contacts.map((c) => {
              const li = safeUrl(c.linkedinUrl);
              const em = c.email ? `mailto:${c.email}` : null;
              return (
                <article className="contact-card" key={c.id}>
                  <h3 className="contact-name">{c.fullName}</h3>
                  <div className="contact-role">{c.role}</div>
                  <div className="contact-links">
                    {li && <a className="contact-link" href={li} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
                    {em && <a className="contact-link" href={em}>{c.email}{c.emailVerified ? ' ✓' : ''}</a>}
                    {c.phone && <span className="contact-link">{c.phone}</span>}
                  </div>
                  {c.sourceOutlet && (
                    <div className="contact-confidence">
                      Fuente: {c.sourceOutlet} · confianza {(c.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
