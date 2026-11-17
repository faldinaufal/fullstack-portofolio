# Documentation

Every project is specified before it is built:

1. **PRD** (Product Requirements Document): *what* we build and *why*: users, goals, features, scope.
2. **FSD** (Functional Specification Document): *how* it works: roles, screens, flows, data model, API, business rules.
3. Code follows the FSD. When the implementation changes a decision, the FSD is updated in the same commit.

| Project | PRD | FSD |
|---|---|---|
| Booking & Invoicing SaaS | [PRD](booking-saas/PRD.md) | [FSD](booking-saas/FSD.md) |
| Company Website | [PRD](company-website/PRD.md) | [FSD](company-website/FSD.md) |
| AI Document Chat (RAG) | [PRD](ai-chat/PRD.md) | [FSD](ai-chat/FSD.md) |

Status values: `Draft` → `Approved` → `Implemented`.
