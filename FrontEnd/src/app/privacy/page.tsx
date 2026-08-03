"use client";

import React from "react";
import {
  Shield,
  Lock,
  Eye,
  ArrowLeft,
  Mail,
  Calendar,
  Server,
  Users,
  FileText,
  Globe,
  Trash2,
  Database,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { getClientLocale, t } from "@/lib/i18n";

export default function PrivacyPage() {
  const locale = getClientLocale();

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          {t(locale, "privacy.back", "Retour à l'accueil")}
        </Link>

        <header className="space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Shield className="w-3 h-3" />
            {t(locale, "privacy.badge", "Protection des données — RGPD")}
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            Politique de{" "}
            <span className="text-[var(--accent)]">Confidentialité</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl">
            Chez Aptely, la protection de vos données personnelles et
            professionnelles est notre priorité absolue. Ce document explique
            avec transparence ce que nous collectons, pourquoi, et vos droits.
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            Dernière mise à jour : 28 mai 2026
          </p>
        </header>

        <main className="space-y-10">

          {/* 1 — Responsable du traitement */}
          <Section icon={<Shield className="w-5 h-5 text-[var(--accent)]" />} title="1. Responsable du traitement">
            <p>
              Le responsable du traitement des données est <strong>Aptely</strong>,
              joignable à l&apos;adresse <a href="mailto:privacy@aptely.com" className="text-[var(--accent)] underline">privacy@aptely.com</a>.
              Pour toute question relative à vos données personnelles, contactez
              notre équipe dédiée à la même adresse.
            </p>
          </Section>

          {/* 2 — Données collectées */}
          <Section icon={<Database className="w-5 h-5 text-[var(--accent)]" />} title="2. Données collectées">
            <p className="mb-4">
              Aptely est une plateforme RH complète. Les données traitées varient
              selon votre rôle.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <DataBox title="Utilisateurs RH / Entreprise" color="orange" items={[
                "Nom complet, adresse e-mail, mot de passe hashé",
                "Photo de profil (avatar)",
                "Rôle et permissions au sein de l'institution",
                "Jetons OAuth Google / Microsoft (calendrier, chiffrés AES-256)",
                "Adresse IP, données de session",
              ]} />
              <DataBox title="Candidats" color="blue" items={[
                "Nom, e-mail, mot de passe hashé",
                "CV, lettre de motivation, certificats, portfolio",
                "Informations de profil (compétences, expériences, formation)",
                "Statut de candidature, score de matching, notes d'entretien",
                "Retour de décision (feedback structuré)",
                "Données de signature électronique (canvas PNG + IP signataire)",
                "Documents d'onboarding",
              ]} />
              <DataBox title="Employés (post-recrutement)" color="emerald" items={[
                "Type de contrat, statut, rémunération brute/nette",
                "Manager, département, poste",
                "Demandes de congés et soldes",
                "Évaluations de performance (notes 1–5, commentaires)",
                "Données d'offboarding (raison de départ, date de fin)",
              ]} />
            </div>
          </Section>

          {/* 3 — Base légale */}
          <Section icon={<FileText className="w-5 h-5 text-[var(--accent)]" />} title="3. Base légale du traitement (RGPD Art. 6)">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Finalité</Th>
                  <Th>Base légale</Th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <Tr a="Gestion du compte et fourniture du service" b="Exécution du contrat (Art. 6.1.b)" />
                <Tr a="Traitement des candidatures et recrutement" b="Intérêt légitime de l'institution cliente (Art. 6.1.f)" />
                <Tr a="Envoi d'e-mails transactionnels (notifications, invitations)" b="Exécution du contrat (Art. 6.1.b)" />
                <Tr a="Matching IA (analyse des CVs via Gemini API)" b="Intérêt légitime — amélioration de la qualité du recrutement (Art. 6.1.f)" />
                <Tr a="Intégration calendrier Google / Outlook" b="Consentement explicite via OAuth (Art. 6.1.a)" />
                <Tr a="Signature électronique des offres" b="Exécution du contrat (Art. 6.1.b)" />
                <Tr a="Données salariales des employés" b="Obligation légale de l'employeur (Art. 6.1.c)" />
                <Tr a="Journaux d'audit et sécurité" b="Intérêt légitime — sécurité et intégrité (Art. 6.1.f)" />
                <Tr a="Consentement aux cookies non-essentiels" b="Consentement (Art. 6.1.a)" />
              </tbody>
            </table>
          </Section>

          {/* 4 — Google API */}
          <Section icon={<Calendar className="w-5 h-5 text-blue-400" />} title="4. Utilisation des données Google API" id="google-scopes">
            <p className="mb-4">
              Aptely utilise Google Calendar API uniquement pour planifier des
              entretiens. Nous ne demandons que les accès strictement nécessaires
              et nous limitons le traitement aux actions déclenchées par l&apos;utilisateur.
            </p>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 rounded-xl mb-4">
              <h3 className="font-semibold mb-3 text-sm">Scopes demandés</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>
                  <code className="text-blue-300 text-xs">https://www.googleapis.com/auth/calendar.readonly</code>
                  {" "}— Lecture des disponibilités (FreeBusy) pour éviter les conflits. Nous ne lisons pas le contenu des événements privés.
                </li>
                <li>
                  <code className="text-blue-300 text-xs">https://www.googleapis.com/auth/calendar.events</code>
                  {" "}— Création d&apos;un événement d&apos;entretien et génération du lien Google Meet.
                </li>
              </ul>
            </div>
            <p className="text-sm text-[var(--text-muted)] italic">
              L&apos;utilisation des données reçues de Google APIs respecte la{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                Google API Services User Data Policy
              </a>
              , y compris les exigences d&apos;utilisation limitée (Limited Use).
              Les données Google ne sont <strong>jamais</strong> partagées avec des
              tiers à des fins publicitaires ou commerciales.
            </p>
          </Section>

          {/* 5 — Sous-traitants */}
          <Section icon={<Globe className="w-5 h-5 text-[var(--accent)]" />} title="5. Sous-traitants et transferts">
            <p className="mb-4 text-[var(--text-secondary)]">
              Aptely fait appel aux sous-traitants suivants. Tous opèrent sous contrat
              de traitement de données et dans le respect du RGPD.
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Prestataire</Th>
                  <Th>Rôle</Th>
                  <Th>Localisation</Th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <Tr a="Supabase" b="Base de données, authentification, stockage fichiers" c="EU (AWS Frankfurt)" />
                <Tr a="Vercel" b="Hébergement frontend" c="EU (AWS Frankfurt)" />
                <Tr a="Render" b="Hébergement backend API" c="US (Oregon) — transfert couvert par SCC" />
                <Tr a="Resend" b="Envoi d'e-mails transactionnels" c="US — transfert couvert par SCC" />
                <Tr a="Google (Gemini AI)" b="Analyse IA des CVs et matching" c="US — transfert couvert par SCC" />
                <Tr a="Google / Microsoft" b="Intégration calendrier (OAuth, optionnel)" c="EU disponible" />
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              SCC = Clauses Contractuelles Types approuvées par la Commission européenne (Art. 46 RGPD).
            </p>
          </Section>

          {/* 6 — Durées de conservation */}
          <Section icon={<Server className="w-5 h-5 text-[var(--accent)]" />} title="6. Durées de conservation">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Données</Th>
                  <Th>Durée</Th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <Tr a="Compte utilisateur actif" b="Durée du contrat + 30 jours après suppression demandée" />
                <Tr a="Candidatures et CVs" b="2 ans à compter de la dernière activité (recommandation CNIL)" />
                <Tr a="Données d'audit et journaux de sécurité" b="12 mois glissants" />
                <Tr a="Données de paie et RH" b="5 ans (obligation légale comptable)" />
                <Tr a="Jetons OAuth calendrier" b="Jusqu'à révocation de l'accès ou déconnexion" />
                <Tr a="Données de signature électronique" b="10 ans (valeur probatoire légale)" />
                <Tr a="Cookies essentiels" b="Session + 365 jours (préférence consentement)" />
              </tbody>
            </table>
          </Section>

          {/* 7 — Sécurité */}
          <Section icon={<Lock className="w-5 h-5 text-[var(--accent)]" />} title="7. Sécurité des données">
            <ul className="space-y-2 text-[var(--text-secondary)] text-sm list-disc ml-5">
              <li>Chiffrement en transit : TLS 1.2+ sur toutes les connexions</li>
              <li>Chiffrement au repos : AES-256 via Supabase (AWS)</li>
              <li>Mots de passe : jamais stockés en clair, hashés par Supabase Auth (bcrypt)</li>
              <li>Tokens OAuth calendrier : chiffrés AES-256-GCM côté applicatif avant stockage</li>
              <li>Secrets webhook : chiffrés AES-256-GCM (clé en variable d&apos;environnement)</li>
              <li>Cookies d&apos;authentification : <code className="text-xs">HttpOnly; SameSite=Strict; Secure</code></li>
              <li>Row-Level Security (RLS) activée : isolation stricte des données par institution</li>
              <li>Accès aux données de production limité aux membres de l&apos;équipe technique avec authentification multi-facteurs</li>
            </ul>
          </Section>

          {/* 8 — Droits */}
          <Section icon={<Users className="w-5 h-5 text-[var(--accent)]" />} title="8. Vos droits (RGPD Art. 15–22)">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Accès (Art. 15)", "Obtenir une copie de toutes les données vous concernant."],
                ["Rectification (Art. 16)", "Corriger des données inexactes ou incomplètes."],
                ["Effacement (Art. 17)", "Demander la suppression de vos données (« droit à l'oubli »)."],
                ["Limitation (Art. 18)", "Restreindre temporairement le traitement."],
                ["Portabilité (Art. 20)", "Recevoir vos données dans un format structuré et lisible par machine."],
                ["Opposition (Art. 21)", "Vous opposer au traitement fondé sur intérêt légitime."],
                ["Retrait du consentement", "Révoquer à tout moment un consentement (calendrier, cookies)."],
                ["Réclamation", "Saisir la CNIL (cnil.fr) en cas de traitement non conforme."],
              ].map(([right, desc]) => (
                <div key={right} className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 rounded-xl">
                  <p className="font-semibold mb-1 text-[var(--text-primary)]">{right}</p>
                  <p className="text-[var(--text-secondary)]">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Pour exercer vos droits, écrivez à{" "}
              <a href="mailto:privacy@aptely.com" className="text-[var(--accent)] underline">
                privacy@aptely.com
              </a>.
              Nous répondons dans un délai maximal de <strong>30 jours</strong>.
            </p>
          </Section>

          {/* 9 — Cookies */}
          <Section icon={<Eye className="w-5 h-5 text-[var(--accent)]" />} title="9. Cookies et traceurs">
            <table className="w-full text-sm border-collapse mb-3">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Cookie</Th>
                  <Th>Nature</Th>
                  <Th>Finalité</Th>
                  <Th>Durée</Th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <Tr a="hr_access_token" b="Essentiel" c="Jeton d'authentification (HttpOnly)" d="~1 heure" />
                <Tr a="hr_refresh_token" b="Essentiel" c="Renouvellement de session (HttpOnly)" d="7 jours" />
                <Tr a="hr_token_expiry" b="Essentiel" c="Planification du renouvellement côté client" d="~1 heure" />
                <Tr a="user_email" b="Essentiel" c="Pré-remplissage de l'interface" d="30 jours" />
                <Tr a="aptely_cookie_consent" b="Fonctionnel" c="Mémorisation du choix de consentement" d="365 jours" />
              </tbody>
            </table>
            <p className="text-sm text-[var(--text-secondary)]">
              Aptely n&apos;utilise pas de cookies publicitaires ou de tracking tiers.
              Vous pouvez refuser les cookies non-essentiels via le bandeau affiché
              lors de votre première visite.
            </p>
          </Section>

          {/* 10 — Mineurs */}
          <Section icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} title="10. Mineurs">
            <p className="text-[var(--text-secondary)] text-sm">
              Aptely est une plateforme réservée aux professionnels. Nous ne
              collectons pas sciemment de données sur des personnes de moins de
              16 ans. Si vous pensez qu&apos;un mineur a créé un compte, contactez-nous
              immédiatement.
            </p>
          </Section>

          {/* 11 — Modifications */}
          <Section icon={<FileText className="w-5 h-5 text-[var(--accent)]" />} title="11. Modifications de cette politique">
            <p className="text-[var(--text-secondary)] text-sm">
              Nous pouvons mettre à jour cette politique pour refléter des
              évolutions légales ou de nos pratiques. La date en haut de page
              indique la version en vigueur. En cas de modification substantielle,
              nous vous notifierons par e-mail.
            </p>
          </Section>

          {/* Contact */}
          <footer className="pt-10 border-t border-[var(--border)] text-center space-y-4">
            <h2 className="text-lg font-bold">Une question sur vos données ?</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Notre équipe vous répond sous 30 jours ouvrés.
            </p>
            <a
              href="mailto:privacy@aptely.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-colors font-medium text-[var(--accent)]"
            >
              <Mail className="w-4 h-4" />
              privacy@aptely.com
            </a>
            <p className="text-xs text-[var(--text-muted)] pt-4">© 2026 Aptely. Tous droits réservés.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  id,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="space-y-4" id={id}>
      <h2 className="text-xl font-bold flex items-center gap-3">
        {icon}
        {title}
      </h2>
      <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function DataBox({
  title,
  color,
  items,
}: {
  title: string;
  color: "orange" | "blue" | "emerald";
  items: string[];
}) {
  const colorMap = {
    orange: "text-[var(--accent)] border-[var(--accent)]/20",
    blue: "text-blue-400 border-blue-500/20",
    emerald: "text-emerald-400 border-emerald-500/20",
  };
  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border)] p-4 rounded-xl`}>
      <p className={`font-semibold text-sm mb-3 ${colorMap[color].split(" ")[0]}`}>{title}</p>
      <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc ml-4">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
      {children}
    </th>
  );
}

function Tr({ a, b, c, d }: { a: string; b: string; c?: string; d?: string }) {
  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{a}</td>
      <td className="py-2 px-3">{b}</td>
      {c !== undefined && <td className="py-2 px-3">{c}</td>}
      {d !== undefined && <td className="py-2 px-3">{d}</td>}
    </tr>
  );
}
