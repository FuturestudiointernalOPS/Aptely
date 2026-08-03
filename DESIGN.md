# DESIGN.md — Système de design Aptely

> Référence obligatoire pour tout contributeur touchant l'UI. Lire avant de coder la moindre interface.

---

## 1. Identité visuelle

**Aptely = marque, pas un template IA.**
Style : sombre, précis, professionnel. Évoque confiance et efficacité — pas créativité décorative.

### Couleur d'accent
```
Orange : oklch(65% 0.22 42) = #FF6B00
```
Utilisé pour : boutons primaires, badges actifs, highlights, icônes clés.
Pas utilisé pour : arrière-plans larges, textes courants, décorations.

### Palette CSS vars (définie dans `globals.css`)

```css
/* Dark mode (défaut) */
--bg-deep:      oklch(14% 0.025 255)   /* fond de page */
--bg-surface:   oklch(18% 0.025 255)   /* panneaux, cartes */
--bg-raised:    oklch(22% 0.025 255)   /* hover, inputs */
--border:       oklch(28% 0.02 255)    /* bordures */
--text-primary: oklch(94% 0.008 85)
--text-secondary: oklch(70% 0.01 255)
--text-muted:   oklch(50% 0.01 255)
--accent:       oklch(65% 0.22 42)     /* orange Aptely */
--accent-dim:   oklch(65% 0.22 42 / 15%)  /* fond orange teinté */

/* Light mode (.light sur <html>) */
--bg-deep:      oklch(97% 0.008 85)
--bg-surface:   oklch(100% 0 0)
--bg-raised:    oklch(94% 0.01 85)
--border:       oklch(88% 0.01 85)
--text-primary: oklch(15% 0.03 255)
--text-secondary: oklch(35% 0.02 255)
--accent:       oklch(58% 0.22 42)
```

**Règle absolue : jamais de couleur hardcodée dans le JSX/TSX.**
```tsx
// ✅ Correct
className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)]"

// ❌ Interdit
className="bg-gray-900 border-gray-700 text-white"
style={{ backgroundColor: '#1a1d2e' }}
```

---

## 2. Typographie

- **Famille principale** : `Space Grotesk` (titres), `system-ui` / `sans-serif` (corps)
- **Hiérarchie** :
  - Titres page : `text-2xl font-bold` ou `text-xl font-bold`
  - Labels sections : `text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]`
  - Corps : `text-sm`
  - Méta/captions : `text-xs` ou `text-[10px]`
- **Jamais** de `font-black` ou tailles > `text-3xl` dans les interfaces app (landing page uniquement)

---

## 3. Composants et patterns

### Bouton primaire
```tsx
className="bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
```

### Bouton secondaire
```tsx
className="border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-surface)] transition-colors"
```

### Card/panneau
```tsx
className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
```

### Input
```tsx
className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
```

### Item actif (sidebar, onglets)
```tsx
// Actif
className="bg-[var(--accent-dim)] text-[var(--accent)]"
// Inactif
className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
```

### Badge de statut
```tsx
// Succès
className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
// Erreur
className="bg-red-400/10 text-red-400 border border-red-400/20"
// Warning
className="bg-amber-400/10 text-amber-400 border border-amber-400/20"
// Accent
className="bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20"
```

---

## 4. Layout & espacement

- **Spacing scale** : utiliser Tailwind (gap-2, gap-4, p-4, p-6, etc.)
- **Border radius** : `rounded-xl` pour cartes/boutons, `rounded-lg` pour éléments secondaires, `rounded-full` pour badges/avatars
- **Max-width pages** : `max-w-2xl` à `max-w-4xl` selon contexte, jamais pleine largeur sans padding
- **Sidebar** : 64px collapsed, ~200px expanded — `h-screen fixed left-0 top-0`

---

## 5. Responsive

- Mobile-first : tester sur **375px** minimum
- Breakpoints actifs : `sm:` (640px), `md:` (768px), `lg:` (1024px)
- Sidebar : masquée sur mobile (`isMobile`), slide-in sur toggle
- Grilles : `grid-cols-1` mobile → `grid-cols-2` ou `grid-cols-3` desktop
- Overflow horizontal interdit sur mobile → `overflow-x-hidden` sur body

---

## 6. Landing page

- **Toujours dark mode** même si l'app est en light — c'est une déclaration de marque
- Pas de classes `.light` sur les sections landing
- Tagline style : `text-4xl font-bold text-white` + accent orange sur mot clé
- Testimonials, stats, hero — sobres et précis, pas de mise en scène excessive

---

## 7. 🚫 RED FLAGS — Patterns interdits

Ces patterns = AI smell = identité générique = à refuser systématiquement.

### Glassmorphisme
```tsx
// ❌ INTERDIT
className="backdrop-blur-xl bg-white/10 border border-white/20"
// Sauf cas fonctionnel : modal overlay (bg-black/50) — ok si pas décoratif
```

### Gradient text
```tsx
// ❌ INTERDIT
className="bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent"
// Texte = couleur pleine uniquement
```

### Orbs / blobs décoratifs
```tsx
// ❌ INTERDIT
<div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
// Pas de radial-gradient flottants en background
```

### Hero-metrics répétées
```tsx
// ❌ INTERDIT — grille de (grand chiffre + label) × N identiques
// Utiliser stat strip horizontal avec dividers
```

### Grilles de cards identiques
```tsx
// ❌ INTERDIT — même taille/structure répétée × N
// Varier la densité ou utiliser liste
```

### Side-stripe colorée
```tsx
// ❌ INTERDIT
className="border-l-4 border-orange-500"
// Remplacer par fond teinté : bg-[var(--accent-dim)]
```

### Couleurs hardcodées
```tsx
// ❌ INTERDIT
className="bg-gray-800 text-blue-400"
style={{ color: '#FF6B00' }}
// Toujours : var(--accent), var(--bg-surface), etc.
```

### Routes hardcodées
```tsx
// ❌ INTERDIT
href="/company/recruitment/roles"
router.push('/company/dashboard')
// Toujours : ROUTES.company.recruitment.roles, API.interviews, etc.
```

### Strings UI hardcodées
```tsx
// ❌ INTERDIT
<p>Créer une fiche de poste</p>
// Toujours : t(locale, "nav.roles", "Fiches de poste")
```

### Commentaires qui expliquent le WHAT
```tsx
// ❌ INTERDIT
// This function fetches the list of roles
// Écrire uniquement quand le WHY est non-évident
```

### `fetch()` direct côté frontend
```tsx
// ❌ INTERDIT
fetch('/api/roles')
// Toujours : apiFetch(API.roles, "HR", { method: "GET" })
```

---

## 8. Checklist avant commit UI

- [ ] Aucune couleur hardcodée → toutes via `var(--*)`
- [ ] Aucune route hardcodée → via `ROUTES.*` / `API.*`
- [ ] Aucune string UI hardcodée → via `t(locale, key, fallback)`
- [ ] Responsive testé 375px (mobile)
- [ ] Pas de glassmorphisme / gradient text / orbs
- [ ] Boutons disabled quand action impossible
- [ ] États loading / error / empty gérés
- [ ] `npm run build` → 0 erreurs
