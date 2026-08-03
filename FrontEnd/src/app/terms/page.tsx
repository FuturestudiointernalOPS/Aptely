"use client";

import React from "react";
import {
  FileText,
  UserCheck,
  Shield,
  AlertTriangle,
  Scale,
  Lock,
  Globe,
  Mail,
  ArrowLeft,
  Gavel,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-3 text-[var(--text-primary)]">
        <span className="text-[var(--accent)]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc ml-5 text-sm text-[var(--text-secondary)] leading-relaxed space-y-2">{children}</ul>;
}

export default function TermsPage() {
  const lastUpdated = "28 mai 2026";

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Retour à l&apos;accueil
        </Link>

        <header className="space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-medium">
            <FileText className="w-3 h-3" />
            Conditions Générales d&apos;Utilisation
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            Conditions <span className="text-[var(--accent)]">d&apos;utilisation</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl">
            Ces conditions régissent l&apos;accès et l&apos;utilisation de la plateforme Aptely par les entreprises
            clientes et leurs collaborateurs. En créant un compte ou en utilisant le service, vous acceptez ces
            conditions sans réserve.
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            Dernière mise à jour : <span className="italic">{lastUpdated}</span>
          </p>
        </header>

        <main className="space-y-8">

          {/* 1. Objet et définitions */}
          <Section icon={<FileText className="w-5 h-5" />} title="1. Objet et définitions">
            <P>
              Les présentes Conditions Générales d&apos;Utilisation (ci-après « CGU ») définissent les règles d&apos;accès
              et d&apos;utilisation de la plateforme Aptely, éditée par Aptely SAS, dont les coordonnées figurent à
              l&apos;article 11.
            </P>
            <P>Au sens des présentes CGU, on entend par :</P>
            <UL>
              <li><strong className="text-[var(--text-primary)]">« Aptely »</strong> : la société Aptely SAS, éditrice de la plateforme.</li>
              <li><strong className="text-[var(--text-primary)]">« Plateforme »</strong> : l&apos;ensemble des services accessibles via aptely.com, y compris les interfaces web, les API et les intégrations tierces.</li>
              <li><strong className="text-[var(--text-primary)]">« Client »</strong> : toute entreprise ou entité juridique ayant souscrit à un abonnement Aptely.</li>
              <li><strong className="text-[var(--text-primary)]">« Utilisateur »</strong> : tout membre de l&apos;équipe du Client ayant accès à la plateforme (administrateur, RH, recruteur, manager, etc.).</li>
              <li><strong className="text-[var(--text-primary)]">« Candidat »</strong> : toute personne physique qui interagit avec la plateforme dans le cadre d&apos;un processus de recrutement.</li>
              <li><strong className="text-[var(--text-primary)]">« Données »</strong> : l&apos;ensemble des informations traitées via la plateforme, qu&apos;elles soient personnelles ou professionnelles.</li>
              <li><strong className="text-[var(--text-primary)]">« Service »</strong> : les fonctionnalités proposées par Aptely telles que décrites à l&apos;article 3.</li>
            </UL>
          </Section>

          {/* 2. Éligibilité et compte */}
          <Section icon={<UserCheck className="w-5 h-5" />} title="2. Éligibilité et compte">
            <P>
              L&apos;accès à Aptely est réservé aux personnes morales (entreprises, associations, etc.) et aux
              professionnels agissant dans le cadre de leur activité. Les personnes physiques agissant à titre
              purement personnel ne peuvent pas créer de compte Client.
            </P>
            <P>Pour créer un compte Utilisateur, vous devez :</P>
            <UL>
              <li>Être âgé de 18 ans ou plus.</li>
              <li>Disposer d&apos;une adresse e-mail professionnelle valide.</li>
              <li>Avoir été invité par un administrateur de votre organisation, ou créer l&apos;institution au nom de votre entreprise.</li>
              <li>Ne pas avoir fait l&apos;objet d&apos;une suspension ou d&apos;un bannissement antérieur de la plateforme.</li>
            </UL>
            <P>
              Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toutes les actions
              effectuées depuis votre compte. Toute utilisation suspecte ou non autorisée doit être signalée
              immédiatement à <a href="mailto:support@aptely.com" className="text-[var(--accent)] hover:underline">support@aptely.com</a>.
            </P>
            <P>
              Aptely se réserve le droit de vérifier l&apos;éligibilité d&apos;un compte et de refuser l&apos;accès
              sans justification, notamment en cas de suspicion de fraude ou d&apos;abus.
            </P>
          </Section>

          {/* 3. Description du service */}
          <Section icon={<Shield className="w-5 h-5" />} title="3. Description du service">
            <P>
              Aptely est une plateforme SaaS de gestion RH et de recrutement. Elle offre notamment :
            </P>
            <UL>
              <li>La gestion du cycle de recrutement : fiches de poste, candidatures, entretiens, décisions, offres.</li>
              <li>La gestion des collaborateurs : fiches employés, départements, postes, onboarding, offboarding.</li>
              <li>La communication interne : messagerie candidat/RH, notifications, e-mails automatisés.</li>
              <li>La signature électronique de documents (offres d&apos;embauche, contrats).</li>
              <li>Des fonctionnalités d&apos;intelligence artificielle : matching candidat/poste, génération de questions d&apos;entretien, analyse de profil (via Google Gemini).</li>
              <li>L&apos;intégration avec des services tiers : Google Calendar, Microsoft Outlook, webhooks.</li>
            </UL>
            <P>
              Aptely s&apos;engage à maintenir le service disponible au mieux, sans toutefois garantir une disponibilité
              ininterrompue. Des opérations de maintenance planifiées ou d&apos;urgence peuvent entraîner des
              interruptions temporaires, communiquées dans la mesure du possible avec un préavis raisonnable.
            </P>
            <P>
              Aptely se réserve le droit de faire évoluer les fonctionnalités du service, d&apos;en ajouter ou d&apos;en
              retirer, dans le respect de ses obligations contractuelles envers les Clients abonnés.
            </P>
          </Section>

          {/* 4. Usage acceptable */}
          <Section icon={<AlertTriangle className="w-5 h-5" />} title="4. Usage acceptable">
            <P>
              En utilisant Aptely, vous vous engagez à ne pas :
            </P>
            <UL>
              <li>Utiliser la plateforme à des fins illicites, discriminatoires, ou contraires à l&apos;ordre public.</li>
              <li>Collecter ou traiter des données de candidats à des fins autres que le recrutement et la gestion RH légitimes.</li>
              <li>Transmettre, publier ou stocker des contenus illégaux, offensants, diffamatoires ou portant atteinte à des droits de tiers.</li>
              <li>Tenter d&apos;accéder à des données d&apos;autres organisations ou de contourner les mécanismes de sécurité de la plateforme.</li>
              <li>Utiliser des outils automatisés (scrapers, bots, crawlers) pour accéder à la plateforme sans autorisation écrite préalable.</li>
              <li>Revendre, sous-licencier ou exploiter commercialement le service à des tiers sans accord contractuel spécifique.</li>
              <li>Reproduire, désassembler ou effectuer de l&apos;ingénierie inverse sur la plateforme ou ses composants.</li>
            </UL>
            <P>
              Aptely peut mettre en œuvre des mesures techniques pour détecter et prévenir les abus. Le non-respect
              de ces règles peut entraîner la suspension immédiate du compte, sans préavis ni remboursement.
            </P>
          </Section>

          {/* 5 & 6 in grid */}
          <div className="grid md:grid-cols-2 gap-8">
            <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-3 text-[var(--text-primary)]">
                <Scale className="w-5 h-5 text-[var(--accent)]" />
                5. Abonnements et facturation
              </h2>
              <P>
                L&apos;accès à certaines fonctionnalités d&apos;Aptely est conditionné à la souscription d&apos;un
                abonnement payant. Les tarifs et modalités sont communiqués au moment de la souscription.
              </P>
              <P>
                Les abonnements sont facturés mensuellement ou annuellement, selon le plan choisi. Tout mois commencé
                est dû intégralement. En cas de résiliation, l&apos;accès au service reste actif jusqu&apos;à la fin
                de la période abonnée.
              </P>
              <P>
                Aptely se réserve le droit de modifier ses tarifs avec un préavis de 30 jours. La poursuite de
                l&apos;utilisation du service après cette période vaut acceptation des nouveaux tarifs.
              </P>
            </section>

            <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-3 text-[var(--text-primary)]">
                <Lock className="w-5 h-5 text-[var(--accent)]" />
                6. Données et confidentialité
              </h2>
              <P>
                Le traitement des données personnelles effectué via Aptely est détaillé dans notre{" "}
                <Link href={ROUTES.privacy} className="text-[var(--accent)] hover:underline">
                  Politique de confidentialité
                </Link>
                , qui fait partie intégrante des présentes CGU.
              </P>
              <P>
                Le Client reste propriétaire des données qu&apos;il importe ou génère via la plateforme. Aptely agit
                en qualité de sous-traitant au sens du RGPD pour les données personnelles des candidats et
                employés, sur instruction du Client (responsable de traitement).
              </P>
              <P>
                Les données sont hébergées en Europe (Supabase — UE) et ne sont pas revendues à des tiers.
              </P>
            </section>
          </div>

          {/* 7. Intégrations tierces */}
          <Section icon={<Globe className="w-5 h-5" />} title="7. Intégrations tierces">
            <P>
              Aptely permet de connecter des services tiers, notamment Google Calendar, Microsoft Outlook et
              l&apos;API Gemini de Google. L&apos;utilisation de ces intégrations est soumise aux conditions
              générales des éditeurs respectifs.
            </P>
            <UL>
              <li>
                <strong className="text-[var(--text-primary)]">Google Calendar / Outlook :</strong> la connexion
                est optionnelle. Les événements importés sont affichés en lecture seule dans Aptely. Aptely ne
                stocke pas vos événements calendrier de manière permanente.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Google Gemini (IA) :</strong> certaines
                fonctionnalités (matching, génération de questions) transmettent des données structurées anonymisées
                à l&apos;API Gemini de Google pour traitement. Aucune donnée permettant d&apos;identifier un
                candidat spécifique n&apos;est transmise à Google dans ce cadre.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Webhooks :</strong> vous pouvez configurer des
                webhooks sortants vers vos propres systèmes. Aptely n&apos;est pas responsable de la sécurité de
                vos endpoints de réception.
              </li>
            </UL>
            <P>
              Aptely n&apos;est pas responsable des interruptions, modifications ou violations de données survenant
              côté services tiers. La déconnexion d&apos;une intégration peut être effectuée à tout moment depuis
              les paramètres de votre espace de travail.
            </P>
          </Section>

          {/* 8. Propriété intellectuelle */}
          <Section icon={<Shield className="w-5 h-5" />} title="8. Propriété intellectuelle">
            <P>
              Aptely et ses composantes (code source, interfaces, logos, marques, documentation, algorithmes) sont
              la propriété exclusive d&apos;Aptely SAS, protégée par les lois françaises et internationales relatives
              à la propriété intellectuelle.
            </P>
            <P>
              Aptely vous accorde un droit d&apos;accès non exclusif, non transférable et révocable à la plateforme,
              pour la durée de votre abonnement et uniquement dans le cadre de votre activité professionnelle
              légitime.
            </P>
            <P>
              Vous conservez la propriété pleine et entière des contenus que vous importez ou créez via la
              plateforme (fiches de poste, documents, données employés). Vous accordez à Aptely une licence
              limitée, non exclusive et révocable pour traiter ces contenus dans le seul but de vous fournir
              le service.
            </P>
            <P>
              Toute reproduction, représentation ou exploitation non autorisée des éléments appartenant à Aptely
              est strictement interdite et pourra faire l&apos;objet de poursuites.
            </P>
          </Section>

          {/* 9. Limitation de responsabilité */}
          <Section icon={<AlertTriangle className="w-5 h-5" />} title="9. Limitation de responsabilité">
            <P>
              Aptely met tout en œuvre pour assurer la fiabilité et la sécurité du service. Cependant, la
              plateforme est fournie « en l&apos;état » et Aptely ne saurait être tenue responsable :
            </P>
            <UL>
              <li>Des interruptions de service indépendantes de sa volonté (pannes d&apos;infrastructure, force majeure, attaques tiers).</li>
              <li>Des décisions de recrutement ou de gestion RH prises par le Client sur la base des informations disponibles dans la plateforme.</li>
              <li>Des pertes de données imputables à une mauvaise utilisation par l&apos;Utilisateur.</li>
              <li>Des dommages indirects, consécutifs ou immatériels (perte de chiffre d&apos;affaires, manque à gagner, atteinte à la réputation).</li>
              <li>Des contenus illicites publiés par les Utilisateurs ou les Candidats.</li>
            </UL>
            <P>
              Dans les cas où la responsabilité d&apos;Aptely serait retenue, elle serait limitée au montant des
              sommes effectivement versées par le Client au titre des 12 derniers mois précédant le sinistre.
            </P>
            <P>
              Le Client demeure seul responsable du respect de la réglementation applicable au traitement des
              données de ses candidats et employés (RGPD, droit du travail).
            </P>
          </Section>

          {/* 10. Suspension, résiliation et modifications */}
          <Section icon={<XCircle className="w-5 h-5" />} title="10. Suspension, résiliation et modifications">
            <P>
              <strong className="text-[var(--text-primary)]">Résiliation par le Client :</strong> vous pouvez
              résilier votre abonnement à tout moment depuis les paramètres de votre espace de travail ou en
              contactant{" "}
              <a href="mailto:support@aptely.com" className="text-[var(--accent)] hover:underline">support@aptely.com</a>.
              La résiliation prend effet à l&apos;échéance de la période en cours.
            </P>
            <P>
              <strong className="text-[var(--text-primary)]">Résiliation par Aptely :</strong> Aptely peut
              résilier ou suspendre votre accès immédiatement et sans préavis en cas de violation des présentes
              CGU, de non-paiement, ou d&apos;activité susceptible de nuire à la plateforme ou à ses utilisateurs.
            </P>
            <P>
              <strong className="text-[var(--text-primary)]">Données après résiliation :</strong> à l&apos;issue
              de l&apos;abonnement, vos données sont conservées pendant 30 jours, période durant laquelle vous
              pouvez en demander l&apos;export. Au-delà, elles sont supprimées de manière sécurisée.
            </P>
            <P>
              <strong className="text-[var(--text-primary)]">Modifications des CGU :</strong> Aptely se réserve
              le droit de modifier les présentes CGU. Toute modification substantielle sera notifiée par e-mail
              avec un préavis de 30 jours. La poursuite de l&apos;utilisation du service après ce délai vaut
              acceptation des nouvelles CGU.
            </P>
          </Section>

          {/* 11. Droit applicable et litiges */}
          <Section icon={<Gavel className="w-5 h-5" />} title="11. Droit applicable et litiges">
            <P>
              Les présentes CGU sont régies par le droit français. En cas de litige, les parties s&apos;efforceront
              de trouver une solution amiable dans un délai de 30 jours à compter de la notification écrite du
              différend.
            </P>
            <P>
              À défaut d&apos;accord amiable, les tribunaux compétents du ressort du siège social d&apos;Aptely SAS
              seront seuls compétents, sauf disposition légale impérative contraire.
            </P>
            <P>
              Pour tout litige relatif à la protection des données personnelles, le Client peut également
              saisir la Commission Nationale de l&apos;Informatique et des Libertés (CNIL) :{" "}
              <span className="text-[var(--text-muted)]">www.cnil.fr</span>.
            </P>
          </Section>

          {/* 12. Contact */}
          <Section icon={<Mail className="w-5 h-5" />} title="12. Contact">
            <P>Pour toute question relative aux présentes CGU ou à l&apos;utilisation du service :</P>
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg p-4 space-y-1">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Support technique</p>
                <a href="mailto:support@aptely.com" className="text-sm text-[var(--accent)] hover:underline">support@aptely.com</a>
              </div>
              <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg p-4 space-y-1">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Questions légales</p>
                <a href="mailto:legal@aptely.com" className="text-sm text-[var(--accent)] hover:underline">legal@aptely.com</a>
              </div>
            </div>
          </Section>

          <footer className="pt-12 border-t border-[var(--border)] flex flex-col items-center text-center gap-4">
            <h2 className="text-lg font-bold">Des questions sur ces conditions ?</h2>
            <a
              href="mailto:legal@aptely.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-raised)] transition-colors text-[var(--accent)] font-medium"
            >
              <Mail className="w-4 h-4" />
              Contacter notre équipe
            </a>
            <p className="text-xs text-[var(--text-muted)]">© 2026 Aptely. Tous droits réservés.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
