# Aptely Partie 2 — SUMMARY

**Overall:** Pass partiel (gaps S4/S7/invite complétés)  
**Date:** 2026-10-23  
**Branch:** `qa/demo-accounts-smoke-test`

## Scénarios

| ID | Résultat |
|----|----------|
| S1 Super Admin | Pass partial |
| S2 Enterprise/HR + invite | Pass (invite E2E sur Org B OWNER) |
| S3 Talent profile | Pass partial |
| S4 Talent apply + CV | **Pass** (API multipart + UI history) |
| S5 HR applications | Pass after fix |
| S6 Consistency | Pass partial |
| S7 Security 2-org | **Pass** after P2-S7-02 UI fix |

## Bugs

| | Count |
|--|------:|
| FIXED | **5** (3 prior + P2-S7-02 + CV path validated) |
| OPEN | 3 (P2-S1-01, P2-S3-01, P2-S2-01) |

### FIXED sécurité (gap retest)
- **P2-S7-01** MEMBER `applications.view` → 403  
- **P2-S7-02** Cross-org deep-link UI shell (403 traité comme app) → Access denied  

## Gap retest (précédemment non testé)

| Gap | Résultat | Preuve |
|-----|----------|--------|
| Nouvelle candidature + CV | Pass (API FormData + row `application_documents`) | `gap_s4_*.png`, app `35ba8169-…` |
| Isolation 2 enterprises | Pass (Org B créée) | `gap_s7_*.png` |
| Activation invitation | Pass (Org B OWNER → MEMBER) | `gap_s2_invitee_in_team.png` |

## Livrables

- PDF: `Documents/qa-partie2/APTELY_Partie2_E2E_Talent_Securite_REPORT.pdf`
- MD: `Documents/qa-partie2/APTELY_Partie2_E2E_Talent_Securite_REPORT.md`
- Notes gap: `Documents/qa-partie2/notes/gap_tests_result.json`
- Script: `Documents/qa-partie2/run-gap-tests.cjs`

## Comptes QA créés (staging, non détruits)

- `qa-owner-b-1792765999719@aptely.demo` / `AptelyDemo123!` — OWNER Org B  
- `qa-invitee-1792766132705@aptely.demo` / `AptelyDemo123!` — MEMBER Org B  

## Reste OPEN

- P2-S1-01 SA drawer jobs=0  
- P2-S3-01 Completeness %  
- P2-S2-01 Interviews assigned empty  
- Note: Aptely Demo HM n’a pas `members.invite` (RBAC) — invite validée via OWNER Org B  
